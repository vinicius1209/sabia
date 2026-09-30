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

after(() => fs.rmSync(HOME, { recursive: true, force: true }));

/* ------------------- um agente que não é de escola ------------------- */

const clima = defineCapacidade({
  nome: "ler_clima",
  rotulo: "Previsão do tempo",
  fonte: "Estação",
  icone: "🌦️",
  intencao: "clima",
  descricao: "a previsão do tempo de hoje, com temperatura e chuva.",
  entrada: z.object({}),
  saida: z.object({ temperatura: z.number(), chuva: z.boolean() }),
  ler: async (_args, passo) => {
    passo("Olhando o céu");
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

  test("o historico sai dos eventos de plano de cada turno", () => {
    const c = conversas.criar("nota?");
    conversas.salvarTurno(c.id, {
      id: "t1",
      pergunta: "nota de matematica?",
      criadoEm: new Date().toISOString(),
      eventos: [{ tipo: "plano", mensagem: "x", intencao: "notas", ferramentas: [] }],
    });
    conversas.salvarTurno(c.id, {
      id: "t2",
      pergunta: "deu erro",
      criadoEm: new Date().toISOString(),
      eventos: [{ tipo: "erro", mensagem: "caiu" }],
    });
    const lida = conversas.ler(c.id)!;
    assert.deepEqual(conversas.historicoDe(lida), [{ pergunta: "nota de matematica?", intencao: "notas" }]);
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
