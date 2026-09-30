/**
 * O núcleo sem o Sabiá: um pacote de brinquedo prova que o harness não
 * depende de escola. Tudo sem rede e sem navegador, com o home apontado
 * para uma pasta temporária (nunca encosta no ~/.sabia de verdade).
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { z } from "zod";

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "sabia-teste-"));
process.env.SABIA_HOME = HOME;
process.env.LLM_PROVIDER = "local";

const { defineCapacidade } = await import("../src/nucleo/capacidade.ts");
const { definirAgente } = await import("../src/nucleo/pacote.ts");
const { criarRegistro } = await import("../src/nucleo/registro.ts");
const { extrairParcial } = await import("../src/nucleo/motores/tipos.ts");
const { carregarConfig, salvarConfig, lerConfig, caminhos } = await import("../src/nucleo/config.ts");
const conversas = await import("../src/nucleo/conversas.ts");
const { criarServidor } = await import("../src/nucleo/servidor.ts");
const { motorEscolhido } = await import("../src/nucleo/motores/index.ts");
const { conferirEstrutura, aceitarEstrutura, mudancas } = await import("../src/nucleo/estruturas.ts");
const { montarMemoria } = await import("../src/nucleo/memoria.ts");
type Troca = import("../src/nucleo/memoria.ts").Troca;

after(() => fs.rmSync(HOME, { recursive: true, force: true }));

/* ------------------- um agente que não é de escola ------------------- */

/** a forma da "página" da estação: o teste troca para simular a fonte mudando */
let formaDaEstacao = "colunas: temperatura | chuva";
/** quanto a "leitura" demora: o teste aumenta para simular uma pergunta em andamento */
let demoraDaEstacao = 0;
/** liga para o login de brinquedo pedir o código 2FA antes de responder */
let pedeCodigo = false;

const clima = defineCapacidade({
  nome: "ler_clima",
  rotulo: "Previsão do tempo",
  fonte: "Estação",
  icone: "🌦️",
  intencao: "clima",
  descricao: "a previsão do tempo de hoje, com temperatura e chuva.",
  entrada: z.object({}),
  saida: z.object({ temperatura: z.number(), chuva: z.boolean() }),
  ler: async (_args, passo, estrutura) => {
    passo("Olhando o céu");
    if (demoraDaEstacao) await new Promise((r) => setTimeout(r, demoraDaEstacao));
    estrutura?.(formaDaEstacao);
    return { temperatura: 23, chuva: false };
  },
  resumir: (d) => `${d.temperatura} graus`,
  local: {
    sinais: { forte: /tempo|clima|chuva/ },
    raciocinio: "Vou olhar a previsão.",
    responder: (_p, d) => ({
      resposta: `Hoje faz ${d.temperatura} graus.`,
      itens: [{ rotulo: "Temperatura", valor: `${d.temperatura}°` }],
    }),
  },
});

const pacoteClima = definirAgente({
  id: "clima",
  nome: "Tempinho",
  descricao: "Diz o tempo.",
  persona: () => "Voce diz o tempo.",
  saudacao: () => "Oi!",
  contexto: (cfg) => cfg("CIDADE"),
  atalhos: [{ titulo: "Chuva", descricao: "A previsão de hoje", pergunta: "Vai chover?", icone: "nuvem", cor: "azul" }],
  aviso: "Previsão de brinquedo.",
  capacidades: [clima],
  preparar: async ({ pedirCodigo }) => {
    if (pedeCodigo) await pedirCodigo();
  },
  campos: [{ chave: "CIDADE", rotulo: "Cidade", tipo: "texto", obrigatorio: true, grupo: "Onde" }],
  marca: {
    pasta: HOME,
    mascote: "m.png",
    poses: { ocioso: "o.png", pensando: "p.png", buscando: "b.png", aguardando: "a.png", pronto: "r.png", erro: "e.png" },
  },
});

describe("registro generico", () => {
  const r = criarRegistro([clima]);

  test("intencoes e fontes vem do pacote, mais 'conversa' e 'nenhuma'", () => {
    assert.deepEqual(r.intencoes, ["clima", "conversa"]);
    assert.deepEqual(r.fontes, ["Estação", "nenhuma"]);
  });

  test("o plano so aceita as ferramentas do pacote", () => {
    assert.equal(r.Plano.safeParse({ intencao: "clima", mensagem: "x", ferramentas: [{ nome: "ler_clima", args: {} }] }).success, true);
    assert.equal(r.Plano.safeParse({ intencao: "clima", mensagem: "x", ferramentas: [{ nome: "ler_boletim", args: {} }] }).success, false);
  });

  test("capacidade repetida e recusada na hora de montar", () => {
    assert.throws(() => criarRegistro([clima, clima]), /duas vezes/);
  });

  test("dado fora do contrato NAO chega ao modelo: a ferramenta falha", async () => {
    const torta = defineCapacidade({
      ...clima,
      nome: "ler_torto",
      // a "pagina" mudou e a leitura devolveu outra coisa
      ler: async () => ({ temperatura: "vinte e tres" }) as never,
    });
    const r2 = criarRegistro([torta]);
    await assert.rejects(r2.executar("ler_torto", {}, () => {}), /formato que eu não reconheço/);
  });
});

/* ------------------------ texto aos pedaços ------------------------ */

describe("extrairParcial (resposta enquanto o modelo escreve)", () => {
  test("le o campo antes do JSON fechar", () => {
    assert.equal(extrairParcial('{"resposta":"Sua nota em Fí', "resposta"), "Sua nota em Fí");
  });
  test("ainda sem o campo, devolve null", () => {
    assert.equal(extrairParcial('{"resp', "resposta"), null);
  });
  test("campo completo para na aspa de fechamento", () => {
    assert.equal(extrairParcial('{"resposta":"ok","itens":[]}', "resposta"), "ok");
  });
  test("decodifica escapes, e segura um escape cortado", () => {
    assert.equal(extrairParcial('{"resposta":"a\\"b\\nc\\u00e9', "resposta"), 'a"b\ncé');
    assert.equal(extrairParcial('{"resposta":"caf\\u00e', "resposta"), "caf");
    assert.equal(extrairParcial('{"resposta":"fim\\', "resposta"), "fim");
  });
});

/* ------------------------------ config ------------------------------ */

describe("config no home", () => {
  test("importa o .env do projeto na primeira vez, e a env de verdade vence", () => {
    const projeto = fs.mkdtempSync(path.join(os.tmpdir(), "sabia-projeto-"));
    fs.writeFileSync(path.join(projeto, ".env"), "CIDADE=Itajaí\nLLM_PROVIDER=openai\n");
    const r = carregarConfig(projeto);
    assert.equal(r.importouDotEnv, true);
    assert.equal(lerConfig("CIDADE"), "Itajaí");
    // LLM_PROVIDER=local veio do ambiente antes de carregar: o .env não troca
    assert.equal(lerConfig("LLM_PROVIDER"), "local");
    fs.rmSync(projeto, { recursive: true, force: true });
  });

  test("salvar grava 0600 e aplica na hora; vazio apaga", () => {
    salvarConfig({ CIDADE: "Blumenau" });
    assert.equal(lerConfig("CIDADE"), "Blumenau");
    assert.equal(fs.statSync(caminhos.config()).mode & 0o777, 0o600);
    salvarConfig({ CIDADE: "" });
    assert.equal(lerConfig("CIDADE"), "");
    salvarConfig({ CIDADE: "Itajaí" });
  });

  test("variavel de ambiente nao pode ser trocada pela tela", () => {
    salvarConfig({ LLM_PROVIDER: "openai" });
    assert.equal(motorEscolhido().id, "local");
  });
});

/* ------------------------- motor automático ------------------------- */

describe("motor automatico (o padrao: assinatura antes de chave)", () => {
  const comEnv = (vars: Record<string, string | undefined>, fn: () => void) => {
    const antes = { ...process.env };
    Object.assign(process.env, vars);
    for (const [k, v] of Object.entries(vars)) if (v === undefined) delete process.env[k];
    try {
      fn();
    } finally {
      process.env = antes;
    }
  };
  const so = (...clis: string[]) => (c: string) => clis.includes(c);

  test("pega a primeira assinatura instalada, na ordem do catalogo", () => {
    comEnv({ LLM_PROVIDER: "auto", OPENAI_API_KEY: "sk-x" }, () => {
      assert.deepEqual(motorEscolhido(so("claude", "codex")), { id: "claude", modelo: "sonnet", automatico: true });
      assert.equal(motorEscolhido(so("codex")).id, "codex");
      assert.equal(motorEscolhido(so("agy", "codex")).id, "agy");
    });
  });

  test("sem assinatura nenhuma, usa a chave que existir", () => {
    comEnv({ LLM_PROVIDER: undefined, OPENAI_API_KEY: "sk-x" }, () => {
      assert.equal(motorEscolhido(so()).id, "openai");
    });
  });

  test("sem assinatura e sem chave, cai no plano B em vez de quebrar", () => {
    comEnv({ LLM_PROVIDER: "auto", OPENAI_API_KEY: undefined, GEMINI_API_KEY: undefined }, () => {
      assert.equal(motorEscolhido(so()).id, "local");
    });
  });

  test("escolha explicita vale mesmo com assinatura instalada", () => {
    comEnv({ LLM_PROVIDER: "openai", OPENAI_MODEL: "gpt-4.1-mini" }, () => {
      assert.deepEqual(motorEscolhido(so("claude")), { id: "openai", modelo: "gpt-4.1-mini", automatico: false });
    });
  });
});

/* ----------------------- impressão digital ----------------------- */

describe("impressao digital da forma de cada fonte", () => {
  test("primeira vez vira referencia; igual nao avisa; diferente avisa e o aviso fica", () => {
    assert.equal(conferirEstrutura("fonte_a", "colunas: A | B"), "nova");
    assert.equal(conferirEstrutura("fonte_a", "colunas: A | B"), "igual");
    assert.equal(conferirEstrutura("fonte_a", "colunas: A | NOVA | B", new Date("2026-10-12T10:00:00Z")), "mudou");
    assert.equal(conferirEstrutura("fonte_a", "colunas: A | NOVA | B", new Date("2026-10-13T10:00:00Z")), "mudou");
    const m = mudancas().find((x) => x.capacidade === "fonte_a")!;
    assert.equal(m.desde, "2026-10-12T10:00:00.000Z", "o 'desde' e a primeira vez que a forma nova apareceu");
    assert.equal(m.antes, "colunas: A | B");
  });

  test("se a pagina voltar ao que era, o aviso some sozinho", () => {
    conferirEstrutura("fonte_b", "x");
    conferirEstrutura("fonte_b", "y");
    assert.ok(mudancas().some((x) => x.capacidade === "fonte_b"));
    assert.equal(conferirEstrutura("fonte_b", "x"), "igual");
    assert.ok(!mudancas().some((x) => x.capacidade === "fonte_b"));
  });

  test("aceitar faz a forma nova virar a referencia", () => {
    conferirEstrutura("fonte_c", "velha");
    conferirEstrutura("fonte_c", "nova");
    assert.equal(aceitarEstrutura("fonte_c"), true);
    assert.equal(conferirEstrutura("fonte_c", "nova"), "igual");
    assert.equal(aceitarEstrutura("fonte_c"), false, "nada para aceitar");
  });

  test("so a forma e guardada, e o arquivo e 0600", () => {
    const f = path.join(HOME, "estruturas.json");
    assert.equal(fs.statSync(f).mode & 0o777, 0o600);
  });
});

/* ------------------------------ memória ------------------------------ */

describe("memoria da conversa (orcamento, nao despejo)", () => {
  const troca = (i: number, extra: Partial<Troca> = {}): Troca => ({
    pergunta: `pergunta ${i}`,
    intencao: "notas",
    resposta: `Resposta numero ${i}. Com uma segunda frase que so aparece por inteiro nas recentes.`,
    itens: [{ rotulo: `item ${i}`, valor: `${i},0` }],
    quando: `2026-09-30T1${i % 10}:00:00.000Z`,
    ...extra,
  });

  test("sem conversa, nada", () => {
    assert.equal(montarMemoria([]), "");
  });

  test("as 3 ultimas vao inteiras (com destaques); as antigas, em uma linha", () => {
    const m = montarMemoria([1, 2, 3, 4, 5].map((i) => troca(i)));
    for (const i of [3, 4, 5]) assert.match(m, new RegExp(`Voce respondeu: Resposta numero ${i}\\. Com uma segunda frase`));
    for (const i of [3, 4, 5]) assert.match(m, new RegExp(`item ${i}: ${i},0`));
    for (const i of [1, 2]) {
      assert.match(m, new RegExp(`"pergunta ${i}" → Resposta numero ${i}\\.`));
      assert.doesNotMatch(m, new RegExp(`item ${i}:`), "troca antiga nao leva destaques");
    }
  });

  test("nunca passa do orcamento, e diz quando cortou", () => {
    const longa = "x".repeat(3000);
    const trocas = Array.from({ length: 40 }, (_, i) => troca(i, { resposta: longa, pergunta: `p${i} ${longa}` }));
    const m = montarMemoria(trocas, 6000);
    assert.ok(m.length <= 6000, `memoria com ${m.length} caracteres`);
    assert.match(m, /ficaram de fora\]/);
  });

  test("troca que deu erro aparece como erro, nao como resposta", () => {
    const m = montarMemoria([troca(1, { resposta: "", itens: [], erro: "O boletim mudou de formato." })]);
    assert.match(m, /Nao consegui responder: O boletim mudou de formato\./);
    assert.doesNotMatch(m, /Voce respondeu/);
  });

  test("o prompt manda a conversa, e deixa claro que o dado de agora vence", async () => {
    const { montarPrompt } = await import("../src/nucleo/prompt.ts");
    const p = montarPrompt({ pergunta: "e em fisica?", instrucao: "x", historico: [troca(1)] });
    assert.match(p, /Conversa ate agora/);
    assert.match(p, /vale o de agora/);
    // o pedido atual aparece uma vez so, e depois da conversa
    assert.equal(p.split('Pergunta: "e em fisica?"').length, 2);
    assert.ok(p.indexOf("Conversa ate agora") < p.indexOf('Pergunta: "e em fisica?"'));
  });
});

/* ----------------------------- conversas ---------------------------- */

describe("conversas salvas", () => {
  test("titulo corta numa palavra inteira", () => {
    assert.equal(conversas.tituloDe("oi"), "oi");
    const t = conversas.tituloDe("Qual foi a tarefa de biologia que a professora passou na segunda passada?");
    assert.ok(t.endsWith("…") && t.length <= 49, t);
    assert.ok(!/\s…$/.test(t));
  });

  test("id com caminho nao vira arquivo fora da pasta", () => {
    // ler devolve "não existe"; apagar recusa na hora
    assert.equal(conversas.ler("../../etc/passwd"), null);
    assert.throws(() => conversas.apagar("../config"), /inválido/);
  });

  test("o historico traz a troca inteira (pergunta, resposta, destaques, hora)", () => {
    const c = conversas.criar("nota?");
    conversas.salvarTurno(c.id, {
      id: "t1",
      pergunta: "nota de matematica?",
      criadoEm: "2026-09-30T15:00:00.000Z",
      eventos: [
        { tipo: "plano", mensagem: "x", intencao: "notas", ferramentas: [] },
        { tipo: "resposta", resposta: "Sua media e 7,3.", itens: [{ rotulo: "Matemática", valor: "7,3" }], fonte: "Portal", duracaoMs: 1, motor: "m" },
      ],
    });
    conversas.salvarTurno(c.id, {
      id: "t2",
      pergunta: "e o boletim?",
      criadoEm: "2026-09-30T15:05:00.000Z",
      eventos: [
        { tipo: "plano", mensagem: "x", intencao: "notas", ferramentas: [] },
        { tipo: "erro", mensagem: "O boletim mudou de formato." },
      ],
    });
    conversas.salvarTurno(c.id, {
      id: "t3",
      pergunta: "parei antes do plano",
      criadoEm: "2026-09-30T15:06:00.000Z",
      eventos: [{ tipo: "erro", mensagem: "Parei a pergunta a pedido." }],
    });
    const h = conversas.historicoDe(conversas.ler(c.id)!);
    assert.deepEqual(h, [
      { pergunta: "nota de matematica?", intencao: "notas", resposta: "Sua media e 7,3.", itens: [{ rotulo: "Matemática", valor: "7,3" }], quando: "2026-09-30T15:00:00.000Z", erro: undefined },
      { pergunta: "e o boletim?", intencao: "notas", resposta: "", itens: [], quando: "2026-09-30T15:05:00.000Z", erro: "O boletim mudou de formato." },
    ]);
    assert.equal(conversas.listar()[0].id, c.id);
  });
});

/* --------------------- o servidor, ponta a ponta --------------------- */

describe("servidor com o pacote de brinquedo e o motor sem IA", () => {
  let base = "";
  let fechar = () => {};

  before(async () => {
    const pastaWeb = fs.mkdtempSync(path.join(os.tmpdir(), "sabia-web-"));
    fs.writeFileSync(path.join(pastaWeb, "index.html"), "<p>tela</p>");
    const { app } = criarServidor({ pacote: pacoteClima, pastaWeb });
    await new Promise<void>((ok) => {
      const s = app.listen(0, "127.0.0.1", () => {
        base = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
        fechar = () => s.close();
        ok();
      });
    });
  });
  after(() => fechar());

  /** Lê o fluxo SSE inteiro de um POST. */
  async function perguntar(corpo: object) {
    const r = await fetch(`${base}/api/perguntar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const texto = await r.text();
    return texto
      .split("\n\n")
      .filter((b) => b.startsWith("data: "))
      .map((b) => JSON.parse(b.slice(6)) as { tipo: string; [k: string]: unknown });
  }

  test("GET /api/agente veste a tela com o pacote", async () => {
    const info = await (await fetch(`${base}/api/agente`)).json();
    assert.equal(info.nome, "Tempinho");
    assert.equal(info.capacidades[0].nome, "ler_clima");
    assert.equal(info.marca.poses.pensando, "/marca/p.png");
  });

  test("a config recusa campo que o pacote nao declarou", async () => {
    const r = await fetch(`${base}/api/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valores: { PATH: "/tmp" } }),
    });
    assert.equal(r.status, 400);
  });

  test("uma pergunta vira um fluxo com plano, ferramenta, resposta, e fica salva", async () => {
    const eventos = await perguntar({ pergunta: "Vai ter chuva hoje?" });
    const tipos = eventos.map((e) => e.tipo);
    assert.deepEqual(
      tipos.filter((t) => t !== "passo"),
      ["conversa", "plano", "ferramenta_inicio", "ferramenta_fim", "resposta"]
    );
    const resposta = eventos.find((e) => e.tipo === "resposta")!;
    assert.equal(resposta.resposta, "Hoje faz 23 graus.");
    assert.equal(resposta.fonte, "Estação");

    const id = eventos[0].id as string;
    const salva = await (await fetch(`${base}/api/conversas/${id}`)).json();
    assert.equal(salva.turnos.length, 1);
    assert.equal(salva.titulo, "Vai ter chuva hoje?");
  });

  test("a segunda pergunta na mesma conversa usa o historico salvo", async () => {
    const primeira = await perguntar({ pergunta: "E o clima?" });
    const id = primeira[0].id as string;
    const segunda = await perguntar({ conversa: id, pergunta: "e amanha?" });
    assert.equal(segunda[0].id, id);
    const salva = await (await fetch(`${base}/api/conversas/${id}`)).json();
    assert.equal(salva.turnos.length, 2);
  });

  test("a fonte mudou de forma: aparece no estado, avisa na trilha, e pode ser aceita", async () => {
    formaDaEstacao = "colunas: temperatura | chuva";
    await perguntar({ pergunta: "Vai ter chuva?" });
    formaDaEstacao = "colunas: temperatura | umidade | chuva";
    const eventos = await perguntar({ pergunta: "E a chuva agora?" });
    assert.ok(eventos.some((e) => e.tipo === "passo" && /mudou de formato/.test(String(e.mensagem))));

    let estado = await (await fetch(`${base}/api/estado`)).json();
    assert.deepEqual(estado.mudancas.map((m: { capacidade: string }) => m.capacidade), ["ler_clima"]);
    assert.equal(estado.mudancas[0].rotulo, "Previsão do tempo");

    const r = await fetch(`${base}/api/estruturas/ler_clima/aceitar`, { method: "POST" });
    estado = await r.json();
    assert.deepEqual(estado.mudancas, []);
    assert.equal((await fetch(`${base}/api/estruturas/nao_existe/aceitar`, { method: "POST" })).status, 404);
  });

  test("apagar a conversa que esta respondendo e recusado (antes derrubava o servidor)", async () => {
    demoraDaEstacao = 400;
    try {
      const primeira = await perguntar({ pergunta: "Vai ter chuva?" });
      const id = primeira[0].id as string;
      const emAndamento = perguntar({ conversa: id, pergunta: "E a chuva de novo?" });
      await new Promise((r) => setTimeout(r, 120));
      const r = await fetch(`${base}/api/conversas/${id}`, { method: "DELETE" });
      assert.equal(r.status, 409);
      await emAndamento;
      assert.equal((await fetch(`${base}/api/conversas/${id}`, { method: "DELETE" })).status, 200);
    } finally {
      demoraDaEstacao = 0;
    }
  });

  test("se o arquivo da conversa sumir no meio, a pergunta termina e o servidor segue vivo", async () => {
    demoraDaEstacao = 300;
    try {
      const primeira = await perguntar({ pergunta: "Vai ter chuva?" });
      const id = primeira[0].id as string;
      const emAndamento = perguntar({ conversa: id, pergunta: "E agora?" });
      await new Promise((r) => setTimeout(r, 100));
      fs.rmSync(path.join(HOME, "conversas", `${id}.json`));
      const eventos = await emAndamento;
      assert.ok(eventos.some((e) => e.tipo === "resposta"), "a pergunta nao terminou");
    } finally {
      demoraDaEstacao = 0;
    }
    // o servidor continua respondendo, e a trava de "ocupado" foi liberada
    const estado = await (await fetch(`${base}/api/estado`)).json();
    assert.equal(estado.ocupado, false);
    const depois = await perguntar({ pergunta: "Vai ter chuva amanha?" });
    assert.ok(depois.some((e) => e.tipo === "resposta"));
  });

  test("fechar a aba enquanto ele espera o codigo 2FA libera o Sabia na hora", async () => {
    pedeCodigo = true;
    try {
      const aba = new AbortController();
      const pedido = fetch(`${base}/api/perguntar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta: "Vai ter chuva?" }),
        signal: aba.signal,
      }).then((r) => r.text()).catch(() => "");
      await new Promise((r) => setTimeout(r, 150));
      assert.equal((await (await fetch(`${base}/api/estado`)).json()).ocupado, true);
      aba.abort(); // a pessoa fechou a aba
      await pedido;
      // antes, ficava "ocupado" esperando o código por 3 minutos
      let ocupado = true;
      for (let i = 0; i < 20 && ocupado; i++) {
        await new Promise((r) => setTimeout(r, 50));
        ocupado = (await (await fetch(`${base}/api/estado`)).json()).ocupado;
      }
      assert.equal(ocupado, false, "o servidor ficou preso esperando um código que ninguém vai digitar");
    } finally {
      pedeCodigo = false;
    }
  });

  test("caminho que nao e API cai na tela", async () => {
    const r = await fetch(`${base}/qualquer/coisa`);
    assert.equal(await r.text(), "<p>tela</p>");
  });
});

/* ------------------------- guarda de regressão ------------------------ */

test("nenhum U+2028/U+2029 literal no codigo (quebra o Node e passa no tsc)", () => {
  const achados: string[] = [];
  const varrer = (dir: string) => {
    for (const nome of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, nome.name);
      if (nome.isDirectory()) varrer(p);
      else if (/\.(ts|tsx|mjs)$/.test(nome.name) && /[\u2028\u2029]/.test(fs.readFileSync(p, "utf8"))) {
        achados.push(p);
      }
    }
  };
  varrer(path.resolve(import.meta.dirname, "..", "src"));
  varrer(path.resolve(import.meta.dirname));
  assert.deepEqual(achados, []);
});
