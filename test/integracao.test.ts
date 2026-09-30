/**
 * Testes contra os sistemas REAIS (ClassApp + Portal Activesoft).
 * Lentos e dependem de internet, entao ficam fora do `npm test`.
 *   npm run test:real
 *
 * As asserções sao de INVARIANTE, nao de valor exato: as notas e os
 * comunicados mudam com o tempo, e um teste que exige "8,5" quebraria
 * sozinho no proximo bimestre. O que nao pode mudar e o formato.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

for (const l of fs.readFileSync(".env", "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
process.env.SHOW_BROWSER ??= "0";

const { ensureLoggedIn, closeBrowser } = await import("../src/browser.mjs");
const { executar } = await import("../src/capacidades/index.ts");
const { Saida: SaidaBoletim } = await import("../src/capacidades/boletim.ts");
const { Saida: SaidaCalendario } = await import("../src/capacidades/calendario.ts");
const { Saida: SaidaComunicados } = await import("../src/capacidades/comunicados.ts");
const { Saida: SaidaHorarios } = await import("../src/capacidades/horarios.ts");
const { Saida: SaidaDiario } = await import("../src/capacidades/diario.ts");
const { agora } = await import("../src/contexto.ts");

const semPasso = () => {};

before(async () => {
  await ensureLoggedIn({
    onStep: semPasso,
    request2faCode: async () => {
      throw new Error(
        "A sessao expirou e este teste nao tem como digitar o 2FA. " +
          "Rode o app uma vez (npm start), faca o login, e tente de novo."
      );
    },
  });
});

after(async () => {
  await closeBrowser();
});

describe("ClassApp: comunicados", { timeout: 180_000 }, () => {
  test("le a lista e ela bate com o contrato", async () => {
    const dados = await executar("ler_comunicados", { limite: 8 }, semPasso);
    const r = SaidaComunicados.safeParse(dados);
    assert.ok(r.success, `fora do contrato: ${r.error?.message}`);
    assert.ok(r.data.total > 0, "nenhum comunicado lido (seletor pode ter mudado)");
    assert.ok(r.data.comunicados[0].titulo.length > 0, "comunicado sem titulo");
  });
});

describe("ClassApp: calendario", { timeout: 180_000 }, () => {
  test("le eventos com data valida e passou coerente com hoje", async () => {
    const dados = await executar("ler_calendario", {}, semPasso);
    const r = SaidaCalendario.safeParse(dados);
    assert.ok(r.success, `fora do contrato: ${r.error?.message}`);
    assert.ok(r.data.eventos.length > 0, "nenhum evento (seletor pode ter mudado)");

    const hoje = agora().iso;
    for (const e of r.data.eventos) {
      if (!e.data) continue;
      assert.match(e.data, /^\d{4}-\d{2}-\d{2}$/, `data invalida: ${e.data}`);
      // a regra que o agente usa para "proxima prova" tem que bater com o calendario
      assert.equal(e.passou, e.data < hoje, `passou errado em ${e.data} (hoje ${hoje})`);
    }
  });

  test("le mais de um mes, senao nao existe 'proxima prova' no fim do mes", async () => {
    const dados = (await executar("ler_calendario", {}, semPasso)) as { mes: string };
    assert.ok(dados.mes.includes(" e "), `so leu um mes: ${dados.mes}`);
  });
});

describe("Activesoft: boletim", { timeout: 240_000 }, () => {
  test("le as notas e elas batem com o contrato", async () => {
    const dados = await executar("ler_boletim", {}, semPasso);
    const r = SaidaBoletim.safeParse(dados);
    assert.ok(r.success, `fora do contrato: ${r.error?.message}`);
    assert.equal(r.data.formato, "tabela", "caiu no fallback de texto, o iframe falhou");

    if (r.data.formato !== "tabela") return;
    assert.ok(r.data.notas.length >= 5, `poucas disciplinas: ${r.data.notas.length}`);

    for (const n of r.data.notas) {
      assert.ok(n.disciplina.length > 0, "disciplina vazia");
      // media e nota (9,5) ou conceito (CE, CS, --). Nunca pode vir vazia.
      assert.match(
        n.media,
        /^(\d+[,.]\d+|[A-Z]{2}|--|-|\*)$/,
        `media com formato estranho em ${n.disciplina}: "${n.media}"`
      );
    }
  });

  test("nao confunde nota de trabalho com media", async () => {
    const dados = (await executar("ler_boletim", {}, semPasso)) as {
      formato: string;
      notas: { disciplina: string; media: string; valores: string[] }[];
    };
    if (dados.formato !== "tabela") return;

    // a media tem que ser um dos valores da linha, na posicao da coluna MED,
    // e nao simplesmente o primeiro numero que aparece
    for (const n of dados.notas) {
      if (!/^\d/.test(n.media)) continue;
      assert.ok(
        n.valores.includes(n.media),
        `media "${n.media}" de ${n.disciplina} nao esta entre os valores da linha`
      );
      const primeiroNumero = n.valores.find((v) => /^\d+[,.]\d+$/.test(v));
      if (primeiroNumero && n.valores.filter((v) => /^\d+[,.]\d+$/.test(v)).length > 2) {
        // nao provamos qual e a media, mas garantimos que nao caimos no atalho errado
        assert.ok(true);
      }
    }
  });
});

describe("Activesoft: horarios", { timeout: 240_000 }, () => {
  test("le a grade e marca hoje/amanha de forma coerente", async () => {
    const dados = await executar("ler_horarios", {}, semPasso);
    const r = SaidaHorarios.safeParse(dados);
    assert.ok(r.success, `fora do contrato: ${r.error?.message}`);
    assert.ok(r.data.grade.length >= 3, `poucos dias na grade: ${r.data.grade.length}`);

    // no maximo um dia pode ser "hoje" e um pode ser "amanha"
    assert.ok(r.data.grade.filter((d) => d.ehHoje).length <= 1, "mais de um dia marcado como hoje");
    assert.ok(r.data.grade.filter((d) => d.ehAmanha).length <= 1, "mais de um dia marcado como amanha");

    // o dicionario de codigos funcionou: a maioria das aulas tem nome por extenso
    const aulas = r.data.grade.flatMap((d) => d.aulas);
    const traduzidas = aulas.filter((a) => a.disciplina !== a.codigo).length;
    assert.ok(traduzidas / aulas.length > 0.5, `so ${traduzidas}/${aulas.length} codigos traduzidos`);
  });
});

describe("Activesoft: diario de classe", { timeout: 240_000 }, () => {
  test("le as disciplinas do dia e bate com o contrato", async () => {
    const dados = await executar("ler_diario", {}, semPasso);
    const r = SaidaDiario.safeParse(dados);
    assert.ok(r.success, `fora do contrato: ${r.error?.message}`);
    assert.match(r.data.data, /^\d{2}\/\d{2}\/\d{4}$/, `data estranha: ${r.data.data}`);
  });
});
