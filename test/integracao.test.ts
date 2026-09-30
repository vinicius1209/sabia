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
import path from "node:path";
import { carregarConfig, migrarNavegador } from "../src/nucleo/config.ts";

// a mesma config e a mesma sessão do app (~/.sabia): sem refazer login
const raiz = path.resolve(import.meta.dirname, "..");
carregarConfig(raiz);
migrarNavegador(raiz);
process.env.SHOW_BROWSER ??= "0";

const { ensureLoggedIn, closeBrowser } = await import("../src/agentes/sabia/browser.mjs");
const { default: sabia } = await import("../src/agentes/sabia/index.ts");
const { criarRegistro } = await import("../src/nucleo/registro.ts");
const { executar } = criarRegistro(sabia.capacidades);
const { Saida: SaidaBoletim } = await import("../src/agentes/sabia/capacidades/boletim.ts");
const { Saida: SaidaCalendario } = await import("../src/agentes/sabia/capacidades/calendario.ts");
const { Saida: SaidaComunicados } = await import("../src/agentes/sabia/capacidades/comunicados.ts");
const { Saida: SaidaHorarios } = await import("../src/agentes/sabia/capacidades/horarios.ts");
const { Saida: SaidaDiario } = await import("../src/agentes/sabia/capacidades/diario.ts");
const { agora } = await import("../src/nucleo/contexto.ts");

const semPasso = () => {};

before(async () => {
  await ensureLoggedIn({
    onStep: semPasso,
    request2faCode: async () => {
      throw new Error(
        "A sessao expirou e este teste nao tem como digitar o 2FA. " +
          "Rode o app uma vez (npm start), faca o login pela tela, e tente de novo."
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

  test("cada coluna com o nome certo, e nada de dado pessoal na legenda", async () => {
    const dados = await executar("ler_boletim", {}, semPasso);
    const r = SaidaBoletim.safeParse(dados);
    assert.ok(r.success && r.data.formato === "tabela");
    if (!r.success || r.data.formato !== "tabela") return;
    const b = r.data;

    // se a escola mudar a tabela, isto acusa antes da feira
    assert.equal(b.colunasConferidas, true, "o cabeçalho do boletim não bateu com o layout conhecido");

    assert.ok(b.legenda.some((l) => /^CE - /.test(l)), `legenda sem os conceitos: ${JSON.stringify(b.legenda)}`);
    assert.doesNotMatch(b.legenda.join(" | "), /declaro|matr[ií]cula|assinatura|\d{8}/i, "dado pessoal vazou na legenda");

    const num = (v: string | null) => (v && /^\d+([,.]\d+)?$/.test(v) ? Number(v.replace(",", ".")) : null);
    for (const n of b.notas) {
      // a "media" é exatamente a coluna que ela diz ser
      const esperada =
        n.mediaDe === "média final" ? n.mediaFinal
        : n.mediaDe === "média anual" ? n.mediaAnual
        : n.mediaDe === "2º semestre" ? n.semestre2.media
        : n.mediaDe === "1º semestre" ? n.semestre1.media
        : null;
      if (n.mediaDe !== "sem média") assert.equal(n.media, esperada, `${n.disciplina}: média não bate com ${n.mediaDe}`);

      // o total do ano nunca é menor que o de um semestre
      const total = num(n.faltasTotal);
      for (const s of [n.semestre1.faltas, n.semestre2.faltas]) {
        const f = num(s);
        if (total !== null && f !== null) assert.ok(total >= f, `${n.disciplina}: total ${total} < semestre ${f}`);
      }

      // parcial nunca é "-", "--" ou "*"
      for (const a of [...n.semestre1.avaliacoes, ...n.semestre2.avaliacoes]) {
        assert.doesNotMatch(a.valor, /^(-+|\*)$/, `${n.disciplina} ${a.sigla}: "${a.valor}"`);
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
