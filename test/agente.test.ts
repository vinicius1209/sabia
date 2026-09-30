/**
 * O laço do agente (planejar -> executar -> responder), sem modelo de verdade
 * e sem navegador. Um motor falso grava o que recebeu.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import sabia from "../src/agentes/sabia/index.ts";
import { criarAgente, PerguntaInterrompida } from "../src/nucleo/agente.ts";
import type { Motor } from "../src/nucleo/motores/index.ts";
import type { Entrada } from "../src/nucleo/prompt.ts";
import type { EventoDoTurno } from "../src/nucleo/protocolo.ts";
import { criarRegistro, type Plano } from "../src/nucleo/registro.ts";

const registro = criarRegistro(sabia.capacidades);

function motorFalso(plano: Plano, pedacos: string[] = []) {
  const recebido: Entrada[] = [];
  const motor: Motor = {
    nome: "falso",
    async plano(e) {
      recebido.push(e);
      return plano;
    },
    async resposta(e, aoEscrever) {
      recebido.push(e);
      for (const p of pedacos) aoEscrever?.(p);
      return { resposta: "ok", itens: [], fonte: "nenhuma" };
    },
  };
  return { motor, recebido };
}

const PLANO_NOTA: Plano = {
  intencao: "notas",
  mensagem: "ver o boletim",
  ferramentas: [{ nome: "ler_boletim", args: {} }],
};

function agenteCom(
  motor: Motor,
  executar: (nome: string, args: unknown) => Promise<unknown> = async () => ({ formato: "tabela", notas: [] }),
  preparar: () => Promise<void> = async () => {}
) {
  const eventos: EventoDoTurno[] = [];
  const agente = criarAgente({
    registro,
    motor: () => motor,
    preparar,
    executarFerramenta: executar,
  });
  const perguntar = (pergunta: string, extra: Partial<Parameters<typeof agente.perguntar>[0]> = {}) =>
    agente.perguntar({ pergunta, emitir: (e) => eventos.push(e), ...extra });
  return { perguntar, eventos };
}

describe("laco do agente", () => {
  test("o historico da conversa chega ao modelo, e so as 4 ultimas trocas", async () => {
    const { motor, recebido } = motorFalso(PLANO_NOTA);
    const { perguntar } = agenteCom(motor);
    const historico = Array.from({ length: 6 }, (_, i) => ({ pergunta: `p${i}`, intencao: "notas" }));

    await perguntar("E em fisica?", { historico });

    assert.deepEqual(recebido[0].historico?.map((h) => h.pergunta), ["p2", "p3", "p4", "p5"]);
  });

  test("sem historico, o modelo recebe lista vazia (conversas nao se misturam)", async () => {
    const { motor, recebido } = motorFalso(PLANO_NOTA);
    const { perguntar } = agenteCom(motor);
    await perguntar("Qual minha nota?");
    assert.deepEqual(recebido[0].historico, []);
  });

  test("passa os ARGUMENTOS do plano para a ferramenta", async () => {
    // este era o bug: o agente sempre chamava com {}
    const { motor } = motorFalso({
      intencao: "tarefas",
      mensagem: "diario de segunda",
      ferramentas: [{ nome: "ler_diario", args: { data: "28/09/2026" } }],
    });
    const chamadas: unknown[] = [];
    const { perguntar } = agenteCom(motor, async (_nome, args) => {
      chamadas.push(args);
      return { data: "28/09/2026", disciplinas: [] };
    });

    await perguntar("Que tarefa passaram na segunda?");
    assert.deepEqual(chamadas, [{ data: "28/09/2026" }]);
  });

  test("a fonte vem do plano, nao da opiniao do modelo", async () => {
    const { motor } = motorFalso(PLANO_NOTA); // o motor falso responde fonte "nenhuma"
    const { perguntar } = agenteCom(motor);
    const r = await perguntar("nota?");
    assert.equal(r.fonte, "Portal Activesoft");
  });

  test("ferramenta que falha nao derruba a resposta, e avisa a tela", async () => {
    const { motor } = motorFalso(PLANO_NOTA);
    const { perguntar, eventos } = agenteCom(motor, async () => {
      throw new Error("portal fora do ar");
    });

    const r = await perguntar("nota?");
    assert.equal(r.resposta, "ok");
    const fim = eventos.find((e) => e.tipo === "ferramenta_fim");
    assert.ok(fim && fim.tipo === "ferramenta_fim");
    assert.equal(fim.ok, false);
    assert.match(fim.resumo, /portal fora do ar/);
  });

  test("os dados lidos vao junto no evento, para a tela montar o cartao", async () => {
    const { motor } = motorFalso(PLANO_NOTA);
    const dados = { formato: "tabela", notas: [{ disciplina: "Física", media: "8,5", faltas: "6", valores: [] }] };
    const { perguntar, eventos } = agenteCom(motor, async () => dados);
    await perguntar("nota?");
    const fim = eventos.find((e) => e.tipo === "ferramenta_fim");
    assert.ok(fim && fim.tipo === "ferramenta_fim");
    assert.deepEqual(fim.dados, dados);
  });

  test("conversa simples nao abre ferramenta nenhuma", async () => {
    const { motor } = motorFalso({ intencao: "conversa", mensagem: "oi", ferramentas: [] });
    let abriu = false;
    const { perguntar } = agenteCom(motor, async () => {
      abriu = true;
      return {};
    });
    await perguntar("Oi!");
    assert.equal(abriu, false);
  });

  test("o texto chega aos pedacos enquanto o modelo escreve", async () => {
    const { motor } = motorFalso(PLANO_NOTA, ["Sua", "Sua nota", "Sua nota é 8,5"]);
    const { perguntar, eventos } = agenteCom(motor);
    await perguntar("nota?");
    const textos = eventos.flatMap((e) => (e.tipo === "texto" ? [e.parcial] : []));
    assert.deepEqual(textos, ["Sua", "Sua nota", "Sua nota é 8,5"]);
  });

  test("prepara as fontes ANTES de planejar (login antes de tudo)", async () => {
    const ordem: string[] = [];
    const { motor } = motorFalso(PLANO_NOTA);
    const original = motor.plano;
    motor.plano = async (e) => {
      ordem.push("plano");
      return original(e);
    };
    const { perguntar } = agenteCom(motor, undefined, async () => {
      ordem.push("preparar");
    });
    await perguntar("nota?");
    assert.deepEqual(ordem, ["preparar", "plano"]);
  });

  test("parar no meio nao executa mais nada", async () => {
    const { motor } = motorFalso(PLANO_NOTA);
    let executou = false;
    const parar = new AbortController();
    const original = motor.plano;
    motor.plano = async (e) => {
      parar.abort(); // a pessoa clicou em parar enquanto o modelo planejava
      return original(e);
    };
    const { perguntar } = agenteCom(motor, async () => {
      executou = true;
      return {};
    });
    await assert.rejects(perguntar("nota?", { sinal: parar.signal }), PerguntaInterrompida);
    assert.equal(executou, false);
  });
});
