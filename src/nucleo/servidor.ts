import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express, { type Request, type Response } from "express";
import { criarAgente, PerguntaInterrompida } from "./agente.ts";
import { lerConfig, salvarConfig, veioDoAmbiente } from "./config.ts";
import { aceitarEstrutura, conferirEstrutura, mudancas } from "./estruturas.ts";
import * as conversas from "./conversas.ts";
import { criarPortao2FA } from "./doisfatores.ts";
import { CATALOGO, VAR_DO_MODELO, criarMotor, disponibilidade, motorEscolhido, type Motor } from "./motores/index.ts";
import type { PacoteDeAgente } from "./pacote.ts";
import { montarSistema } from "./prompt.ts";
import type {
  CampoPreenchido,
  EstadoDoServidor,
  EventoDoTurno,
  InfoDoAgente,
  Turno,
} from "./protocolo.ts";
import { criarRegistro } from "./registro.ts";

/* ==================================================================
 * O servidor HTTP. Não sabe de escola: veste o pacote que receber.
 *
 * Cada pergunta é um POST cuja resposta é um fluxo de eventos (SSE).
 * Antes havia um canal global para todas as abas, e cada evento
 * precisava dizer de qual aba era; uma aba animava pela pergunta da
 * outra quando alguém esquecia a etiqueta.
 * ================================================================== */

export interface OpcoesDoServidor {
  pacote: PacoteDeAgente;
  /** pasta com a tela compilada (web/dist) */
  pastaWeb: string;
  /** a tela antiga, servida em /classico enquanto a nova é validada */
  pastaClassica?: string;
}

/** O que a tela pode gravar pela rota de config. Nada fora disto. */
function chavesPermitidas(pacote: PacoteDeAgente): Set<string> {
  return new Set([
    ...pacote.campos.map((c) => c.chave),
    ...CATALOGO.flatMap((m) => (m.chave ? [m.chave] : [])),
    ...Object.values(VAR_DO_MODELO),
    "LLM_PROVIDER",
  ]);
}

export function criarServidor({ pacote, pastaWeb, pastaClassica }: OpcoesDoServidor) {
  const registro = criarRegistro(pacote.capacidades);
  const sistema = () => montarSistema(pacote, registro, lerConfig);

  /* ---- o motor: recriado quando a escolha muda na tela ---- */
  let motorAtual: { chave: string; motor: Motor } | null = null;
  function motor(): Motor {
    const escolha = motorEscolhido();
    const chave = `${escolha.id}:${escolha.modelo}`;
    if (motorAtual?.chave !== chave) {
      motorAtual = { chave, motor: criarMotor({ sistema, registro }, escolha) };
    }
    return motorAtual.motor;
  }

  /* ---- quem está recebendo os eventos agora (uma pergunta por vez) ---- */
  let emAndamento: { emitir: (e: EventoDoTurno | { tipo: "conectado" }) => void; parar: AbortController } | null =
    null;

  const portao2fa = criarPortao2FA({
    prazoMs: Number(process.env.PRAZO_2FA_MS || 3 * 60 * 1000),
    aoPedir: () => emAndamento?.emitir({ tipo: "2fa_pedido" }),
    aoEncerrar: (motivo) => emAndamento?.emitir({ tipo: "2fa_fim", motivo }),
  });

  const log = (m: string) => console.log(`[${new Date().toTimeString().slice(0, 8)}] ${m}`);

  const agente = criarAgente({
    registro,
    motor,
    preparar: (passo) =>
      pacote.preparar?.({ passo, pedirCodigo: () => portao2fa.pedir() }) ?? Promise.resolve(),
    // cada leitura confere a FORMA da página com a conhecida (ver estruturas.ts)
    executarFerramenta: (nome, args, passo) =>
      registro.executar(nome, args, passo, (descricao) => {
        if (conferirEstrutura(nome, descricao) === "mudou") {
          passo(`Aviso: a página de "${registro.capacidade(nome).rotulo}" mudou de formato`);
        }
      }),
  });

  function faltando(): string[] {
    return pacote.campos.filter((c) => c.obrigatorio && !lerConfig(c.chave)).map((c) => c.rotulo);
  }

  async function estado(): Promise<EstadoDoServidor> {
    const motores = await disponibilidade();
    const escolha = motorEscolhido();
    const atual = motores.find((m) => m.id === escolha.id);
    const falta = faltando();
    return {
      configurado: falta.length === 0 && Boolean(atual?.disponivel),
      faltando: falta,
      motor: { ...escolha, nome: motor().nome },
      motores,
      ocupado: emAndamento !== null,
      // só as fontes DESTE pacote: o arquivo é do home, e outro agente
      // (SABIA_AGENTE) pode ter deixado as dele lá
      mudancas: mudancas().flatMap((m) => {
        const c = registro.capacidades.find((x) => x.nome === m.capacidade);
        return c ? [{ capacidade: m.capacidade, rotulo: c.rotulo, desde: m.desde }] : [];
      }),
    };
  }

  /** Abre um fluxo SSE na resposta desta requisição. */
  function abrirFluxo(res: Response) {
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.flushHeaders();
    return (e: object) => res.write(`data: ${JSON.stringify(e)}\n\n`);
  }

  const app = express();
  app.use(express.json());

  /* ---------------------------- o agente ---------------------------- */

  app.get("/api/agente", (_req, res) => {
    const url = (arq: string) => `/marca/${arq}`;
    const info: InfoDoAgente = {
      id: pacote.id,
      nome: pacote.nome,
      descricao: pacote.descricao,
      saudacao: pacote.saudacao(lerConfig),
      contexto: pacote.contexto(lerConfig),
      aviso: pacote.aviso,
      atalhos: pacote.atalhos,
      capacidades: registro.capacidades.map((c) => registro.metadados(c.nome)),
      marca: {
        mascote: url(pacote.marca.mascote),
        poses: Object.fromEntries(
          Object.entries(pacote.marca.poses).map(([k, v]) => [k, url(v)])
        ) as InfoDoAgente["marca"]["poses"],
      },
    };
    res.json(info);
  });

  app.get("/api/estado", async (_req, res) => {
    res.json(await estado());
  });

  /* ----------------------------- config ----------------------------- */

  app.get("/api/config", (_req, res) => {
    const campos: CampoPreenchido[] = pacote.campos.map((c) => {
      const valor = lerConfig(c.chave);
      return {
        ...c,
        // senha nunca volta para a tela, nem mascarada
        valor: c.tipo === "senha" ? "" : valor,
        preenchido: Boolean(valor),
        travado: veioDoAmbiente(c.chave),
      };
    });
    res.json(campos);
  });

  app.post("/api/config", async (req: Request, res: Response) => {
    const valores = (req.body?.valores ?? {}) as Record<string, unknown>;
    const permitidas = chavesPermitidas(pacote);
    const recusadas = Object.keys(valores).filter((k) => !permitidas.has(k));
    if (recusadas.length) return res.status(400).json({ erro: `Campo desconhecido: ${recusadas.join(", ")}` });
    salvarConfig(Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, String(v ?? "").trim()])));
    res.json(await estado());
  });

  app.post("/api/motor", async (req: Request, res: Response) => {
    const id = String(req.body?.id ?? "");
    // "auto": volta a escolher sozinho a primeira assinatura instalada
    if (id === "auto") {
      salvarConfig({ LLM_PROVIDER: "auto" });
      return res.json(await estado());
    }
    const opcao = CATALOGO.find((m) => m.id === id);
    if (!opcao) return res.status(400).json({ erro: "motor desconhecido" });
    const modelo = String(req.body?.modelo ?? opcao.modelos[0].id);
    if (!opcao.modelos.some((m) => m.id === modelo)) return res.status(400).json({ erro: "modelo desconhecido" });
    const valores: Record<string, string> = { LLM_PROVIDER: id };
    if (VAR_DO_MODELO[id]) valores[VAR_DO_MODELO[id]] = modelo;
    salvarConfig(valores);
    res.json(await estado());
  });

  /** Uma pergunta boba só para saber se a chave e o modelo respondem. */
  app.post("/api/motor/testar", async (_req, res) => {
    const inicio = Date.now();
    try {
      await motor().plano({ pergunta: "oi", instrucao: "Monte o plano para responder." });
      res.json({ ok: true, duracaoMs: Date.now() - inicio, motor: motor().nome });
    } catch (e) {
      res.json({ ok: false, erro: e instanceof Error ? e.message : String(e) });
    }
  });

  /** Prepara as fontes (login) com a pessoa acompanhando, no primeiro uso. */
  app.post("/api/conectar", async (_req, res) => {
    if (emAndamento) return res.status(429).json({ erro: "Estou no meio de outra tarefa." });
    const enviar = abrirFluxo(res);
    emAndamento = { emitir: enviar, parar: new AbortController() };
    try {
      await pacote.preparar?.({
        passo: (mensagem) => {
          log(mensagem);
          enviar({ tipo: "passo", mensagem });
        },
        pedirCodigo: () => portao2fa.pedir(),
      });
      enviar({ tipo: "conectado" });
    } catch (e) {
      enviar({ tipo: "erro", mensagem: e instanceof Error ? e.message : String(e) });
    } finally {
      emAndamento = null;
      res.end();
    }
  });

  /** Alguém conferiu que a página nova está sendo lida certo: vira a referência. */
  app.post("/api/estruturas/:nome/aceitar", async (req, res) => {
    const nome = String(req.params.nome);
    if (!registro.capacidades.some((c) => c.nome === nome)) return res.status(404).json({ erro: "fonte desconhecida" });
    aceitarEstrutura(nome);
    res.json(await estado());
  });

  /* ---------------------------- conversas --------------------------- */

  app.get("/api/conversas", (_req, res) => {
    res.json(conversas.listar());
  });

  app.get("/api/conversas/:id", (req, res) => {
    try {
      const c = conversas.ler(String(req.params.id));
      if (!c) return res.status(404).json({ erro: "conversa não encontrada" });
      res.json(c);
    } catch {
      res.status(400).json({ erro: "id inválido" });
    }
  });

  app.patch("/api/conversas/:id", (req, res) => {
    try {
      const ok = conversas.renomear(String(req.params.id), String(req.body?.titulo ?? ""));
      res.status(ok ? 200 : 404).json({ ok });
    } catch {
      res.status(400).json({ erro: "id inválido" });
    }
  });

  app.delete("/api/conversas/:id", (req, res) => {
    try {
      conversas.apagar(String(req.params.id));
      res.json({ ok: true });
    } catch {
      res.status(400).json({ erro: "id inválido" });
    }
  });

  /* ---------------------------- perguntar --------------------------- */

  app.post("/api/perguntar", async (req: Request, res: Response) => {
    const pergunta = String(req.body?.pergunta ?? "").trim();
    if (!pergunta) return res.status(400).json({ erro: "pergunta vazia" });
    // Uma por vez: o navegador do agente é um só, e duas perguntas ao mesmo
    // tempo brigariam pelas mesmas abas.
    if (emAndamento) return res.status(429).json({ erro: "Já estou respondendo outra pergunta." });

    let conversa = req.body?.conversa ? conversas.ler(String(req.body.conversa)) : null;
    if (!conversa) conversa = conversas.criar(pergunta);

    const enviar = abrirFluxo(res);
    const eventos: EventoDoTurno[] = [];
    const parar = new AbortController();
    const emitir = (e: EventoDoTurno | { tipo: "conectado" }) => {
      if (e.tipo === "conectado") return;
      if (e.tipo === "passo") log(e.mensagem);
      // os pedaços de texto só servem ao vivo: a resposta final tem o texto todo
      if (e.tipo !== "texto") eventos.push(e);
      enviar(e);
    };
    emAndamento = { emitir, parar };
    // fechar a aba no meio também para a pergunta
    res.on("close", () => {
      if (!res.writableFinished) parar.abort();
    });

    emitir({ tipo: "conversa", id: conversa.id, titulo: conversa.titulo });
    const inicio = Date.now();
    try {
      const r = await agente.perguntar({
        pergunta,
        historico: conversas.historicoDe(conversa),
        emitir,
        sinal: parar.signal,
      });
      emitir({
        tipo: "resposta",
        resposta: r.resposta,
        itens: r.itens,
        fonte: r.fonte,
        duracaoMs: Date.now() - inicio,
        motor: motor().nome,
      });
    } catch (e) {
      const mensagem =
        e instanceof PerguntaInterrompida ? e.message : e instanceof Error ? e.message : String(e);
      emitir({ tipo: "erro", mensagem });
    } finally {
      const turno: Turno = {
        id: crypto.randomUUID(),
        pergunta,
        criadoEm: new Date(inicio).toISOString(),
        eventos,
      };
      conversas.salvarTurno(conversa.id, turno);
      emAndamento = null;
      res.end();
    }
  });

  app.post("/api/parar", (_req, res) => {
    const havia = Boolean(emAndamento);
    emAndamento?.parar.abort();
    // se estava esperando o código 2FA, a espera também termina
    portao2fa.cancelar();
    res.json({ parado: havia });
  });

  /* ------------------------------ 2FA ------------------------------ */

  app.post("/api/2fa", (req: Request, res: Response) => {
    const codigo = String(req.body?.codigo ?? req.body?.code ?? "").trim();
    if (!codigo) return res.status(400).json({ erro: "código vazio" });
    if (!portao2fa.responder(codigo)) return res.status(409).json({ erro: "não estou esperando código" });
    res.json({ ok: true });
  });

  app.post("/api/2fa/cancelar", (_req, res) => {
    res.json({ cancelado: portao2fa.cancelar() });
  });

  /* Só para teste: derruba a sessão para verificar que o agente se recupera
     sozinho. Fica atrás de DEBUG_ENDPOINTS=1. */
  if (process.env.DEBUG_ENDPOINTS === "1" && pacote.derrubarSessao) {
    app.post("/api/debug/derrubar-sessao", async (_req, res) => {
      res.json(await pacote.derrubarSessao!());
    });
  }

  /* ------------------------ a tela antiga ------------------------- */

  if (pastaClassica && fs.existsSync(pastaClassica)) {
    montarClassico(app, {
      pastaClassica,
      agente,
      pacote,
      reservar: (emitir) => {
        if (emAndamento) return false;
        emAndamento = { emitir, parar: new AbortController() };
        return true;
      },
      liberar: () => {
        emAndamento = null;
      },
    });
  }

  /* ---------------------------- arquivos ---------------------------- */

  app.use("/marca", express.static(pacote.marca.pasta, { maxAge: "1h" }));
  app.use(express.static(pastaWeb));
  // a tela é uma página só: qualquer caminho que não é API cai no index
  app.get(/^\/(?!api\/|marca\/|classico).*/, (_req, res, next) => {
    const index = path.join(pastaWeb, "index.html");
    if (fs.existsSync(index)) res.sendFile(index);
    else next();
  });

  return { app, motor, encerrar: () => pacote.encerrar?.() ?? Promise.resolve() };
}

/**
 * A tela antiga (ui/index.html) fala o protocolo antigo: um canal global
 * em /api/events e o POST /api/chat. Fica viva em /classico só enquanto a
 * tela nova é validada.
 */
function montarClassico(
  app: express.Express,
  {
    pastaClassica,
    agente,
    pacote,
    reservar,
    liberar,
  }: {
    pastaClassica: string;
    agente: ReturnType<typeof criarAgente>;
    pacote: PacoteDeAgente;
    /** ocupa a mesma vez da tela nova: as duas nunca rodam juntas */
    reservar: (emitir: (e: EventoDoTurno | { tipo: "conectado" }) => void) => boolean;
    liberar: () => void;
  }
) {
  const clientes = new Set<Response>();
  const difundir = (e: object) => {
    for (const c of clientes) c.write(`data: ${JSON.stringify(e)}\n\n`);
  };

  app.get("/api/events", (req, res) => {
    res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.flushHeaders();
    res.write(": ok\n\n");
    clientes.add(res);
    req.on("close", () => clientes.delete(res));
  });

  app.get("/api/perfil", (_req, res) => {
    res.json({ escola: "", aluno: pacote.contexto(lerConfig), iniciais: "EU" });
  });

  app.post("/api/chat", async (req, res) => {
    const pergunta = String(req.body?.mensagem ?? "").trim();
    const conversa = String(req.body?.conversa ?? "padrao").slice(0, 64);
    if (!pergunta) return res.status(400).json({ erro: "mensagem vazia" });
    const emitir = (e: EventoDoTurno | { tipo: "conectado" }) => {
      if (e.tipo === "texto" || e.tipo === "conectado") return;
      // o protocolo antigo chamava a mensagem do plano de "raciocinio" e o
      // pedido de código de "2fa"
      const antigo =
        e.tipo === "plano" ? { ...e, raciocinio: e.mensagem } : e.tipo === "2fa_pedido" ? { tipo: "2fa" } : e;
      difundir({ ...antigo, conversa });
    };
    if (!reservar(emitir)) return res.status(429).json({ erro: "ja estou respondendo outra pergunta" });
    difundir({ tipo: "pensando", conversa });
    try {
      const r = await agente.perguntar({ pergunta, emitir });
      difundir({ tipo: "resposta", ...r, conversa });
      res.json(r);
    } catch (e) {
      const erro = e instanceof Error ? e.message : String(e);
      difundir({ tipo: "erro", mensagem: erro, conversa });
      res.status(500).json({ erro });
    } finally {
      liberar();
    }
  });

  app.use("/classico", express.static(pastaClassica));
}
