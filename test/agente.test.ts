/**
 * O laço do agente (planejar -> executar -> responder), sem modelo de verdade
 * e sem navegador. Um motor falso grava o que recebeu.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { criarAgente, type Motor, type Entrada, type Evento } from "../src/agent.ts";
import type { Plano } from "../src/contracts.ts";

function motorFalso(plano: Plano) {
  const recebido: Entrada[] = [];
  const motor: Motor = {
    nome: "falso",
    async plano(e) { recebido.push(e); return plano; },
    async resposta(e) { recebido.push(e); return { resposta: "ok", itens: [], fonte: "nenhuma" }; },
  };
  return { motor, recebido };
}

const PLANO_NOTA: Plano = {
  intencao: "notas",
  raciocinio: "ver o boletim",
  ferramentas: [{ nome: "ler_boletim", args: {} }],
};

function agenteCom(motor: Motor, executar = async () => ({ formato: "tabela", notas: [] })) {
  const eventos: Evento[] = [];
  const agente = criarAgente({
    emitir: (e) => eventos.push(e),
    request2faCode: async () => "000000",
    motor,
    garantirSessao: async () => {},
    executarFerramenta: executar as never,
  });
  return { agente, eventos };
}

describe("laco do agente", () => {
  test("conversas diferentes NAO compartilham historico", async () => {
    const { motor, recebido } = motorFalso(PLANO_NOTA);
    const { agente } = agenteCom(motor);

    await agente.perguntar("Qual minha nota de matematica?", "aluno-A");
    await agente.perguntar("E em fisica?", "aluno-B");

    const planoDoB = recebido.filter((e) => e.instrucao.startsWith("Monte"))[1];
    assert.deepEqual(planoDoB.historico, [], "o aluno B herdou a conversa do aluno A");
  });

  test("a mesma conversa LEMBRA a pergunta anterior", async () => {
    const { motor, recebido } = motorFalso(PLANO_NOTA);
    const { agente } = agenteCom(motor);

    await agente.perguntar("Qual minha nota de matematica?", "aluno-A");
    await agente.perguntar("E em fisica?", "aluno-A");

    const segundo = recebido.filter((e) => e.instrucao.startsWith("Monte"))[1];
    assert.equal(segundo.historico?.[0]?.pergunta, "Qual minha nota de matematica?");
  });

  test("passa os ARGUMENTOS do plano para a ferramenta", async () => {
    // este era o bug: o agente sempre chamava com {}
    const plano: Plano = {
      intencao: "tarefas",
      raciocinio: "diario de segunda",
      ferramentas: [{ nome: "ler_diario", args: { data: "28/09/2026" } }],
    };
    const { motor } = motorFalso(plano);
    const chamadas: unknown[] = [];
    const { agente } = agenteCom(motor, (async (_nome: string, args: unknown) => {
      chamadas.push(args);
      return { data: "28/09/2026", disciplinas: [] };
    }) as never);

    await agente.perguntar("Que tarefa passaram na segunda?", "x");
    assert.deepEqual(chamadas, [{ data: "28/09/2026" }]);
  });

  test("a fonte vem do plano, nao da opiniao do modelo", async () => {
    const { motor } = motorFalso(PLANO_NOTA); // o motor falso responde fonte "nenhuma"
    const { agente } = agenteCom(motor);
    const r = await agente.perguntar("nota?", "x");
    assert.equal(r.fonte, "Portal Activesoft");
  });

  test("ferramenta que falha nao derruba a resposta, e avisa a tela", async () => {
    const { motor } = motorFalso(PLANO_NOTA);
    const { agente, eventos } = agenteCom(motor, (async () => {
      throw new Error("portal fora do ar");
    }) as never);

    const r = await agente.perguntar("nota?", "x");
    assert.equal(r.resposta, "ok");
    const fim = eventos.find((e) => e.tipo === "ferramenta_fim");
    assert.ok(fim && fim.tipo === "ferramenta_fim");
    assert.equal(fim.ok, false);
    assert.match(fim.resumo, /portal fora do ar/);
  });

  test("conversa simples nao abre ferramenta nenhuma", async () => {
    const { motor } = motorFalso({ intencao: "conversa", raciocinio: "oi", ferramentas: [] });
    let abriu = false;
    const { agente } = agenteCom(motor, (async () => { abriu = true; return {}; }) as never);
    await agente.perguntar("Oi!", "x");
    assert.equal(abriu, false);
  });
});
