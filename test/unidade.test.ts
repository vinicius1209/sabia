/**
 * Testes rapidos, sem rede e sem navegador.
 * Cobrem as regras que ja erraram de verdade neste projeto.
 *   npm test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { colunasDoBoletim, conferirNotas, ehDisciplina, extrairLegenda, interpretarBoletim, LAYOUT_CONHECIDO, montarNotas, type Nota } from "../src/agentes/sabia/capacidades/boletim.ts";
import { marcarEventos } from "../src/agentes/sabia/capacidades/calendario.ts";
import { acharTabelas, montarHorarios } from "../src/agentes/sabia/capacidades/horarios.ts";
import { montarDiario } from "../src/agentes/sabia/capacidades/diario.ts";
import sabia, { quemAtende } from "../src/agentes/sabia/index.ts";
import { criarRegistro, limparTexto } from "../src/nucleo/registro.ts";
import { agora, cabecalhoTemporal, tabelaDeDias } from "../src/nucleo/contexto.ts";
import { motorLocal } from "../src/nucleo/motores/local.ts";

const registro = criarRegistro(sabia.capacidades);
const { capacidades: CAPACIDADES, descricaoDasFontes, escolherLocal, ChamadaFerramenta, argsPadrao, Plano, Resposta, limparResposta } =
  registro;

/* O cabecalho real do boletim, em dois niveis (medido em set/2026). */
const GRUPOS = [
  { rotulo: "Disciplinas", colspan: 1, rowspan: 2 },
  { rotulo: "1º SEM", colspan: 9, rowspan: 1 },
  { rotulo: "2º SEM", colspan: 9, rowspan: 1 },
  { rotulo: "MA", colspan: 2, rowspan: 1 },
  { rotulo: "RECF", colspan: 4, rowspan: 1 },
  { rotulo: "MF", colspan: 2, rowspan: 1 },
  { rotulo: "Total de faltas", colspan: 1, rowspan: 2 },
  { rotulo: "Situação de conclusão na disciplina", colspan: 1, rowspan: 2 },
];
const SIGLAS = [
  "T1", "T2", "SIM", "P1", "P2", "RS", "AJUSTE", "MED", "F",
  "T1", "T2", "SIM", "P1", "P2", "RS", "AJUSTE", "MED", "F",
  "MED", "F", "REC", "Cons.Final", "MED", "F", "MED", "F",
];
const VAZIO_2SEM = ["-", "-", "-", "-", "-", "-", "-", "--", "-"];
const SEM_ANUAL = ["--", "-", "-", "-", "--", "-", "--", "-"]; // MA, RECF, MF ainda sem nada

/* Uma linha no layout real (disciplina + 28 colunas), com notas FICTICIAS. */
const linha = (nome: string, s1: string[], s2: string[], resto: string[], total: string) =>
  [nome, ...s1, ...s2, ...resto, total, "Cursando"];

/* Fisica: 8,5 de media no 1o sem e um 6,0 solto no 2o (o erro de verdade: o
   agente mostrava 6,0). */
const FISICA = linha("Física", ["9,0", "9,5", "8,0", "8,0", "0,0", "7,5", "*", "8,5", "6"],
  ["-", "-", "-", "6,0", "-", "-", "-", "--", "3"], SEM_ANUAL, "9");
/* Matematica: 12 faltas no 1o sem, 17 no ano. */
const MATEMATICA = linha("Matemática", ["9,5", "8,8", "7,6", "9,0", "3,0", "*", "*", "7,3", "12"],
  ["7,1", "-", "-", "-", "-", "-", "-", "--", "5"], SEM_ANUAL, "17");
/* Portugues: um 0,0 no T2 e 4,1 na P2, e a recuperacao (RS) 8,6. O agente
   dizia "notas baixas: 0,0 e 4,1" sem dizer de onde eram. */
const PORTUGUES = linha("Língua Portuguesa e suas Literaturas", ["8,0", "0,0", "7,9", "7,0", "4,1", "8,6", "*", "6,4", "3"],
  ["-", "-", "-", "6,8", "-", "-", "-", "--", "1"], SEM_ANUAL, "4");
const EDFISICA = linha("Educação Física *", ["CE", "CE", "CE", "CE", "CE", "*", "*", "CE", "1"], VAZIO_2SEM, SEM_ANUAL, "1");
const UCC = linha("UCC - NEA - Ciências da Natureza e suas Tecnologias *", ["CE", "CE", "CE", "CE", "CE", "*", "*", "CE", "14"],
  VAZIO_2SEM, SEM_ANUAL, "14");
/* Um ano fechado: a media anual existe e vale mais que a de cada semestre. */
const ARTE = linha("Arte", ["8,0", "8,0", "8,0", "8,0", "8,0", "*", "*", "8,0", "1"],
  ["9,0", "9,0", "9,0", "9,0", "9,0", "*", "*", "9,0", "1"], ["8,5", "2", "-", "-", "--", "-", "--", "-"], "2");
const RODAPE = ["Declaro para os devidos fins que recebi o boletim escolar de Fulana de Tal", "x", "y", "z"];

describe("boletim: cada coluna com o nome certo", () => {
  test("o cabecalho em dois niveis vira as 29 colunas conhecidas", () => {
    assert.deepEqual(colunasDoBoletim(GRUPOS, SIGLAS), LAYOUT_CONHECIDO);
  });

  test("cabecalho que nao bate devolve null (e a saida avisa)", () => {
    assert.equal(colunasDoBoletim([{ rotulo: "lixo", colspan: 3, rowspan: 1 }], ["a", "b", "c"]), null);
  });

  test("Fisica e 8,5, a media do 1o SEMESTRE, e diz que e do semestre", () => {
    const [fisica] = montarNotas([FISICA]);
    assert.equal(fisica.media, "8,5");
    assert.equal(fisica.mediaDe, "1º semestre");
  });

  test("o 6,0 do 2o semestre aparece com o nome: P1 do 2o semestre", () => {
    const [fisica] = montarNotas([FISICA]);
    assert.deepEqual(fisica.semestre2.avaliacoes, [{ sigla: "P1", valor: "6,0" }]);
    assert.equal(fisica.semestre2.media, null, "o 2o semestre nao fechou");
  });

  test("Matematica e 7,3, NAO 9,5 (que e a nota do trabalho 1)", () => {
    const [mat] = montarNotas([MATEMATICA]);
    assert.equal(mat.media, "7,3");
  });

  test("faltas sao as do ANO (17), nao so do 1o semestre (12)", () => {
    const [mat] = montarNotas([MATEMATICA]);
    assert.equal(mat.faltasTotal, "17");
    assert.equal(mat.semestre1.faltas, "12");
  });

  test("o 0,0 vem com a sigla, junto da recuperacao, e a media continua a media", () => {
    const [pt] = montarNotas([PORTUGUES]);
    const s1 = Object.fromEntries(pt.semestre1.avaliacoes.map((a) => [a.sigla, a.valor]));
    assert.equal(s1.T2, "0,0");
    assert.equal(s1.RS, "8,6");
    assert.equal(pt.media, "6,4");
  });

  test('"-", "--" e "*" nunca viram avaliacao', () => {
    const [pt] = montarNotas([PORTUGUES]);
    for (const a of [...pt.semestre1.avaliacoes, ...pt.semestre2.avaliacoes]) {
      assert.doesNotMatch(a.valor, /^(-+|\*)$/, `${a.sigla} veio como avaliacao com "${a.valor}"`);
    }
    assert.equal(pt.semestre1.avaliacoes.some((a) => a.sigla === "AJUSTE"), false);
  });

  test("quando existe media anual, ela vence a do semestre", () => {
    const [arte] = montarNotas([ARTE]);
    assert.equal(arte.media, "8,5");
    assert.equal(arte.mediaDe, "média anual");
  });

  test("conceito (CE) vem como conceito, e o * vira itinerario, fora do nome", () => {
    const [ed] = montarNotas([EDFISICA]);
    assert.equal(ed.media, "CE");
    assert.equal(ed.disciplina, "Educação Física");
    assert.equal(ed.itinerario, true);
  });

  test("disciplina de nome longo NAO some (o limite antigo descartava a UCC de 53 letras)", () => {
    const notas = montarNotas([FISICA, UCC]);
    assert.equal(notas.length, 2);
    assert.equal(notas[1].disciplina, "UCC - NEA - Ciências da Natureza e suas Tecnologias");
  });

  test("rodape longo nao entra como disciplina (barrado pelo tamanho)", () => {
    const longo = "Esta e uma linha de rodape bem comprida que nao tem nenhuma palavra do filtro";
    assert.ok(longo.length > 60);
    assert.equal(ehDisciplina(longo), false);
    const notas = montarNotas([FISICA, RODAPE]);
    assert.equal(notas.length, 1);
    assert.equal(notas[0].disciplina, "Física");
  });

  test("rodape CURTO tambem e barrado, pelo filtro de palavras", () => {
    // um caso por palavra do filtro, senao uma delas pode sumir sem ninguem ver
    for (const curto of [
      "Declaro recebimento",   // declaro
      "Assinatura",            // assinatura
      "Itajai (SC)",           // itajai
      "LEGENDA:",              // legenda
      "REC - Recuperação",     // recupera
      "Trabalho 2",            // trabalho \d
      "Prova 1",               // prova \d
      "SIM - Simulado",        // simulado
    ]) {
      assert.equal(ehDisciplina(curto), false, `"${curto}" passou como disciplina`);
    }
  });

  test("nome de disciplina de verdade continua passando", () => {
    for (const bom of ["Física", "Matemática", "Ensino Religioso *", "Língua Portuguesa e suas Literaturas"]) {
      assert.equal(ehDisciplina(bom), true, `"${bom}" foi barrado indevidamente`);
    }
  });

  test("a propria linha de cabecalho nao entra como disciplina", () => {
    assert.equal(ehDisciplina("Disciplinas"), false);
    assert.equal(ehDisciplina("T1"), false);
  });
});

describe("boletim: se a escola mudar a tabela, recusa em vez de adivinhar", () => {
  const lida = (grupos = GRUPOS, siglas = SIGLAS, linhas = [FISICA, MATEMATICA, PORTUGUES]) => ({
    grupos, siglas, linhas, rodape: "T1 - Trabalho 1",
  });

  test("com a tabela conhecida, le normalmente", () => {
    const r = interpretarBoletim(lida());
    assert.equal(r.formato, "tabela");
  });

  test("sem tabela na pagina: indisponivel, e NAO manda o texto cru (que tem nome e nascimento)", () => {
    const r = interpretarBoletim(null);
    assert.equal(r.formato, "indisponivel");
    assert.deepEqual(Object.keys(r).sort(), ["colunasEncontradas", "formato", "motivo"]);
  });

  // a escola acrescenta uma "P3" no 1o semestre
  const GRUPOS_P3 = GRUPOS.map((g) => (g.rotulo === "1º SEM" ? { ...g, colspan: 10 } : g));
  const SIGLAS_P3 = ["T1", "T2", "SIM", "P1", "P2", "P3", ...SIGLAS.slice(5)];

  test("coluna NOVA com dados coerentes: continua lendo certo, sozinho, pelo nome", () => {
    // mesma Fisica, agora com um 7,0 na P3: a media continua sendo a da coluna MED
    const fisicaP3 = [...FISICA.slice(0, 6), "7,0", ...FISICA.slice(6)];
    const r = interpretarBoletim(lida(GRUPOS_P3, SIGLAS_P3, [fisicaP3]));
    assert.equal(r.formato, "tabela");
    if (r.formato !== "tabela") return;
    assert.equal(r.notas[0].media, "8,5");
    assert.equal(r.notas[0].faltasTotal, "9");
    assert.ok(r.notas[0].semestre1.avaliacoes.some((a) => a.sigla === "P3" && a.valor === "7,0"));
  });

  test("cabecalho e linhas desencontrados (coluna deslocada): nunca vira tabela, e nenhum valor vaza", () => {
    // o cabecalho ganhou P3, mas as linhas nao: tudo depois dela deslocaria uma casa
    const r = interpretarBoletim(lida(GRUPOS_P3, SIGLAS_P3));
    if (r.formato === "tabela") {
      assert.fail(`leu uma tabela deslocada como se fosse boa: ${JSON.stringify(r.notas[0])}`);
    }
    assert.doesNotMatch(JSON.stringify(r), /8,5|7,3|6,4|\b17\b/, "valor de nota vazou no indisponivel");
  });

  test("cabecalho renomeado: indisponivel, dizendo o motivo", () => {
    const grupos = GRUPOS.map((g) => (g.rotulo === "1º SEM" ? { ...g, rotulo: "1º TRIMESTRE" } : g));
    const r = interpretarBoletim(lida(grupos));
    assert.equal(r.formato, "indisponivel");
    if (r.formato === "indisponivel") {
      assert.match(r.motivo, /mudou de formato/);
      assert.ok(r.colunasEncontradas.includes("1º TRIMESTRE"));
    }
  });

  test("a conferencia de valores pega coluna trocada: nota acima de 10 nao existe", () => {
    const [mat] = montarNotas([MATEMATICA]);
    assert.deepEqual(conferirNotas([mat]), []);
    assert.equal(conferirNotas([{ ...mat, media: "16" }]).length, 1, "16 (faltas) no lugar da media");
    assert.equal(conferirNotas([{ ...mat, media: "Cursando" }]).length, 1);
    assert.equal(conferirNotas([{ ...mat, faltasTotal: "7,3" }]).length, 1, "nota no lugar das faltas");
    assert.deepEqual(conferirNotas([]), ["nenhuma disciplina na tabela"]);
  });

  test("conceito (CE) e sem media ainda (-) passam na conferencia", () => {
    const [ed] = montarNotas([EDFISICA]);
    assert.deepEqual(conferirNotas([ed]), []);
  });
});

describe("boletim: a legenda oficial", () => {
  const RODAPE_REAL = [
    "* = Dispensado da avaliação",
    "|",
    "2CH = 2ª Chamada",
    "-- = Disciplina não requer nota",
    "Disciplinas sinalizadas com * são itinerários formativos obrigatórios",
    "CE    -    CONCLUIU COM EXCELÊNCIA     CS    -    CONCLUIU SATISFATORIAMENTE    CP   -    CONCLUIU PARCIALMENTE   NC   -    NÃO CONCLUIU",
    "LEGENDA:",
    "T1 - Trabalho 1",
    "P2 - Prova 2",
    "REC - Recuperação",
    "Ajuste.",
    "Declaro para os devidos fins que recebi o boletim escolar de Fulana de Tal, matrícula 12345678.",
    "Itajai (SC), 30 de setembro de 2026 às 16:05",
    "Assinatura",
  ].join("\n");

  test("traz as siglas como a escola escreveu, e separa os conceitos", () => {
    const l = extrairLegenda(RODAPE_REAL);
    for (const esperado of [
      "* = Dispensado da avaliação",
      "2CH = 2ª Chamada",
      "-- = Disciplina não requer nota",
      "T1 - Trabalho 1",
      "REC - Recuperação",
      "CE - CONCLUIU COM EXCELÊNCIA",
      "NC - NÃO CONCLUIU",
    ]) {
      assert.ok(l.includes(esperado), `faltou "${esperado}" em ${JSON.stringify(l)}`);
    }
  });

  test("a linha com nome e matricula da aluna NAO entra na legenda", () => {
    const l = extrairLegenda(RODAPE_REAL).join(" | ");
    assert.doesNotMatch(l, /Fulana|matr[ií]cula|Declaro|Itajai|Assinatura|2026/i);
  });
});

describe("calendario: passado x futuro", () => {
  const hoje = new Date(2026, 8, 26); // 26/set/2026
  const brutos = [
    { mes: "October 2026", dia: 17, evento: "Simulado - 9° ao 3°EM" },
    { mes: "September 2026", dia: 23, evento: "Prova de Segunda Chamada" },
    { mes: "September 2026", dia: 9, evento: "Avaliação de Português" },
  ];

  test("ordena por data, do mais antigo para o mais novo", () => {
    const e = marcarEventos(brutos, hoje);
    assert.deepEqual(e.map((x) => x.data), ["2026-09-09", "2026-09-23", "2026-10-17"]);
  });

  test("marca corretamente o que ja passou", () => {
    const e = marcarEventos(brutos, hoje);
    assert.equal(e.find((x) => x.dia === 9)!.passou, true);
    assert.equal(e.find((x) => x.dia === 23)!.passou, true);
    assert.equal(e.find((x) => x.dia === 17)!.passou, false);
  });

  test("o primeiro futuro e o Simulado de outubro", () => {
    const futuros = marcarEventos(brutos, hoje).filter((x) => !x.passou);
    assert.equal(futuros[0].evento, "Simulado - 9° ao 3°EM");
  });

  test("evento de hoje NAO conta como passado", () => {
    const e = marcarEventos([{ mes: "September 2026", dia: 26, evento: "Hoje" }], hoje);
    assert.equal(e[0].passou, false);
  });

  test("marca o que e avaliacao: o calendario mistura prova com festa e feriado", () => {
    const e = marcarEventos(
      [
        { mes: "October 2026", dia: 12, evento: "Feriado - Nossa Senhora Aparecida" },
        { mes: "October 2026", dia: 14, evento: "Oficina de Oratória" },
        { mes: "October 2026", dia: 17, evento: "Simulado - 9° ao 3°EM" },
        { mes: "October 2026", dia: 20, evento: "Avaliação de Química" },
      ],
      hoje
    );
    assert.deepEqual(e.map((x) => x.ehAvaliacao), [false, false, true, true]);
  });

  test("segunda chamada e avaliacao, mas marcada a parte (so vale para quem faltou)", () => {
    const [e] = marcarEventos([{ mes: "October 2026", dia: 2, evento: "Prova de Segunda Chamada" }], hoje);
    assert.equal(e.ehAvaliacao, true);
    assert.equal(e.ehSegundaChamada, true);
  });

  test("evento sem data entendivel vai para o FIM, e nao vira o proximo", () => {
    const e = marcarEventos(
      [
        { mes: "???", dia: 5, evento: "Sem data" },
        { mes: "October 2026", dia: 17, evento: "Simulado" },
      ],
      hoje
    );
    assert.deepEqual(e.map((x) => x.evento), ["Simulado", "Sem data"]);
  });

  test("mes que nao da para interpretar nao quebra", () => {
    const e = marcarEventos([{ mes: "???", dia: 5, evento: "X" }], hoje);
    assert.equal(e[0].data, "");
  });
});

describe("contexto temporal", () => {
  test("agora() devolve data ISO valida e coerente", () => {
    const a = agora();
    assert.match(a.iso, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(a.hora, /^\d{2}:\d{2}$/);
    assert.equal(a.inicioDoDia.getHours(), 0);
  });

  test("o cabecalho do prompt cita a data de hoje", () => {
    assert.ok(cabecalhoTemporal().includes(agora().iso));
  });
});

describe("contratos", () => {
  test("Plano recusa ferramenta inventada", () => {
    const r = Plano.safeParse({ intencao: "notas", mensagem: "x", ferramentas: ["hackear_escola"] });
    assert.equal(r.success, false);
  });

  test("Plano recusa intencao inventada", () => {
    const r = Plano.safeParse({ intencao: "apagar_tudo", mensagem: "x", ferramentas: [] });
    assert.equal(r.success, false);
  });

  test("Resposta exige os campos da tela", () => {
    assert.equal(Resposta.safeParse({ resposta: "oi" }).success, false);
    assert.equal(
      Resposta.safeParse({ resposta: "oi", itens: [], fonte: "ClassApp" }).success,
      true
    );
  });

  test("entrada da ferramenta rejeita limite fora da faixa", () => {
    const c = CAPACIDADES.find((x) => x.nome === "ler_comunicados")!;
    assert.equal(c.entrada.safeParse({ limite: 999 }).success, false);
    assert.equal(c.entrada.safeParse({ limite: 5 }).success, true);
  });

  test("limpa caractere de controle que quebra o JSON da resposta", () => {
    assert.equal(limparTexto("linha\u000bcom\u0001controle "), "linha com controle");
    const r = limparResposta({
      resposta: "a\u0001b",
      itens: [{ rotulo: "c\u000bd", valor: "e" }],
      fonte: "ClassApp",
    });
    assert.equal(r.resposta, "a b");
    assert.equal(r.itens[0].rotulo, "c d");
  });
});

/** uma disciplina no formato do boletim, so com o que o teste precisa */
const nota = (disciplina: string, media: string): Nota => ({
  disciplina,
  itinerario: false,
  media,
  mediaDe: "1º semestre",
  faltasTotal: "0",
  situacao: "Cursando",
  semestre1: { avaliacoes: [], media, faltas: "0" },
  semestre2: { avaliacoes: [], media: null, faltas: null },
  mediaAnual: null,
  recuperacaoFinal: null,
  mediaFinal: null,
});

describe("motor local (plano B da feira)", () => {
  const m = motorLocal({ registro });
  const casos: [string, string[]][] = [
    ["Qual minha nota de matematica?", ["ler_boletim"]],
    ["Como estou no boletim?", ["ler_boletim"]],
    ["Quando e minha proxima prova?", ["ler_calendario"]],
    ["Quais os avisos da escola?", ["ler_comunicados"]],
    ["Que aula eu tenho amanha?", ["ler_horarios"]],
    ["Qual meu horario de segunda?", ["ler_horarios"]],
    ["Oi, tudo bem?", []],
  ];
  for (const [pergunta, esperado] of casos) {
    test(`planeja "${pergunta}" -> ${JSON.stringify(esperado)}`, async () => {
      const p = await m.plano({ pergunta, instrucao: "" });
      assert.deepEqual(p.ferramentas.map((f) => f.nome), esperado);
    });
  }

  test("acha a materia mesmo sem acento na pergunta", async () => {
    await m.plano({ pergunta: "Qual minha nota de fisica?", instrucao: "" });
    const r = await m.resposta({
      pergunta: "Qual minha nota de fisica?",
      instrucao: "",
      dados: {
        ler_boletim: {
          formato: "tabela",
          notas: [nota("Física", "8,5"), nota("História", "9,1")],
          legenda: [],
        },
      },
    });
    assert.equal(r.itens.length, 1);
    assert.equal(r.itens[0].rotulo, "Física");
    assert.equal(r.itens[0].valor, "8,5");
  });
});

/* Tabelas no formato real da tela de horarios do Activesoft. */
const DICIONARIO = [
  ["Turma", "Código", "Disciplina", "Situação"],
  ["3BEM", "BIO", "Biologia", "Matriculado"],
  ["3BEM", "MAT", "Matemática", "Matriculado"],
  ["3BEM", "His", "História", "Matriculado"],
];
const GRADE = [
  ["Horário", "Segunda", "Terça", "Quarta", "Sábado"],
  ["M1 - 07:25 às 08:10", "MAT", "GEO", "MAT", "---"],
  ["M2 - 08:10 às 08:55", "BIO", "---", "QUIM", "---"],
  ["M6 - 11:40 às 12:25", "MAT", "His", "MAT", ""],
];

describe("horarios: grade da semana", () => {
  const segunda = new Date(2026, 8, 28); // 28/set/2026 e uma segunda

  test("traduz o codigo para o nome da disciplina", () => {
    const { grade } = montarHorarios([DICIONARIO, GRADE], segunda);
    const seg = grade.find((d) => d.dia === "Segunda")!;
    assert.equal(seg.aulas[0].codigo, "MAT");
    assert.equal(seg.aulas[0].disciplina, "Matemática");
  });

  test("codigo sem traducao vira o proprio codigo, e nao some", () => {
    const { grade } = montarHorarios([DICIONARIO, GRADE], segunda);
    const ter = grade.find((d) => d.dia === "Terça")!;
    assert.equal(ter.aulas[0].disciplina, "GEO");
  });

  test("celula vazia ('---') nao vira aula", () => {
    const { grade } = montarHorarios([DICIONARIO, GRADE], segunda);
    const ter = grade.find((d) => d.dia === "Terça")!;
    assert.equal(ter.aulas.length, 2); // GEO e His, sem o "---"
  });

  test("dia inteiro sem aula nao aparece na grade", () => {
    const { grade } = montarHorarios([DICIONARIO, GRADE], segunda);
    assert.equal(grade.some((d) => d.dia === "Sábado"), false);
  });

  test("marca hoje e amanha no codigo, sem depender do modelo", () => {
    const { grade, hoje, amanha } = montarHorarios([DICIONARIO, GRADE], segunda);
    assert.equal(hoje, "Segunda");
    assert.equal(amanha, "Terça");
    assert.equal(grade.find((d) => d.dia === "Segunda")!.ehHoje, true);
    assert.equal(grade.find((d) => d.dia === "Terça")!.ehAmanha, true);
    assert.equal(grade.find((d) => d.dia === "Quarta")!.ehHoje, false);
  });

  test("acento nao atrapalha (Terça x Terca)", () => {
    const domingo = new Date(2026, 8, 27);
    const { amanha } = montarHorarios([DICIONARIO, GRADE], domingo);
    assert.equal(amanha, "Segunda");
  });

  test("acha a grade e o dicionario pelo cabecalho; sem a grade, a leitura recusa", () => {
    assert.ok(acharTabelas([DICIONARIO, GRADE]).grade);
    assert.equal(acharTabelas([DICIONARIO]).grade, undefined);
  });

  test("sem a tabela de grade, devolve vazio sem quebrar", () => {
    const { grade } = montarHorarios([DICIONARIO], segunda);
    assert.deepEqual(grade, []);
  });
});

describe("registro de capacidades", () => {
  test("toda capacidade tem o que a tela precisa", () => {
    for (const c of CAPACIDADES) {
      assert.ok(c.rotulo, `${c.nome} sem rotulo`);
      assert.ok(c.fonte, `${c.nome} sem fonte`);
      assert.ok(c.icone, `${c.nome} sem icone`);
    }
  });

  test("toda capacidade se descreve para o modelo", () => {
    // sem isto a ferramenta existe e o modelo nunca escolhe ela
    for (const c of CAPACIDADES) {
      assert.ok(c.descricao.length > 20, `${c.nome} com descricao fraca`);
    }
  });

  test("o prompt cita TODAS as capacidades, sem esquecer nenhuma", () => {
    const texto = descricaoDasFontes();
    for (const c of CAPACIDADES) {
      assert.ok(texto.includes(c.nome), `${c.nome} nao aparece no prompt`);
    }
  });

  test("nomes de capacidade nao se repetem", () => {
    const nomes = CAPACIDADES.map((c) => c.nome);
    assert.equal(new Set(nomes).size, nomes.length);
  });

  test("o plano B roteia cada tipo de pergunta", () => {
    const casos: [string, string][] = [
      ["qual minha nota de matematica?", "ler_boletim"],
      ["Como estou em física?", "ler_boletim"],
      ["Tem alguma matéria que preciso me preocupar?", "ler_boletim"],
      ["quando e minha proxima prova?", "ler_calendario"],
      ["Tem simulado esse mês?", "ler_calendario"],
      ["quais os avisos da escola?", "ler_comunicados"],
      ["que aula eu tenho amanha?", "ler_horarios"],
      ["Quando é a próxima aula de química?", "ler_horarios"],
      ["que tarefa passaram hoje?", "ler_diario"],
      // os quatro abaixo caiam no quadro de horarios so por conterem "aula"
      ["O que foi dado na aula hoje?", "ler_diario"],
      ["Qual a tarefa da aula de física?", "ler_diario"],
      ["Teve tarefa na aula de hoje?", "ler_diario"],
      ["Qual o conteúdo da aula de biologia?", "ler_diario"],
    ];
    const erros = casos
      .map(([p, esperado]) => [p, esperado, escolherLocal(p)?.nome ?? "(nenhuma)"])
      .filter(([, esperado, veio]) => esperado !== veio)
      .map(([p, esperado, veio]) => `"${p}" -> ${veio} (esperado ${esperado})`);
    assert.deepEqual(erros, []);
  });

  test("conversa simples nao aciona capacidade nenhuma", () => {
    assert.equal(escolherLocal("oi, tudo bem?"), null);
  });
});

describe("diario de classe", () => {
  const TEXTO = [
    "Diário de classe", "Fulana de Tal", "Matrícula: 12345678",
    "Ensino Médio / 3ª Série / 2026 / 3BEM",
    "Língua Inglesa - Conversação",
    "Conteúdo ministrado:", "Festival esportivo.",
    "Tarefas:", "Não houve.",
    "Frequência:", "Não informado",
    "Matemática",
    "Conteúdo ministrado:", "Função exponencial.",
    "Tarefas:", "Lista 7, exercícios 1 a 10.",
    "Frequência:", "Presente",
  ].join("\n");

  test("separa as disciplinas em blocos", () => {
    const d = montarDiario(TEXTO);
    assert.equal(d.length, 2);
    assert.equal(d[0].disciplina, "Língua Inglesa - Conversação");
    assert.equal(d[1].disciplina, "Matemática");
  });

  test("le o conteudo e a tarefa de cada uma", () => {
    const d = montarDiario(TEXTO);
    assert.equal(d[1].conteudo, "Função exponencial.");
    assert.equal(d[1].tarefas, "Lista 7, exercícios 1 a 10.");
  });

  test('"Nao houve" NAO conta como tarefa', () => {
    // sem isto o agente anunciaria tarefa onde nao existe nenhuma
    const d = montarDiario(TEXTO);
    assert.equal(d[0].temTarefa, false);
    assert.equal(d[1].temTarefa, true);
  });

  test("texto sem nenhum bloco nao quebra", () => {
    assert.deepEqual(montarDiario("Diário de classe\nnada aqui"), []);
  });

  test("todos os jeitos de escrever 'nao teve tarefa' contam como sem tarefa", () => {
    // "Sem tarefa." apareceu no diario real e passava como tarefa de verdade
    for (const vazio of ["Não houve.", "Nao houve", "Sem tarefa.", "Sem tarefas", "Não há.",
                         "Nenhuma.", "Não houve registro.", "Não informado", "---", "Sem atividade."]) {
      const texto = `Biologia\nConteúdo ministrado:\nCélulas\nTarefas:\n${vazio}\nFrequência:\nPresente`;
      assert.equal(montarDiario(texto)[0].temTarefa, false, `"${vazio}" virou tarefa`);
    }
  });

  test("tarefa de verdade continua sendo tarefa", () => {
    for (const real of ["Lista 7, exercícios 1 a 10.", "Ler o capítulo 3", "Sem consulta: resumo do cap. 2"]) {
      const texto = `Biologia\nConteúdo ministrado:\nCélulas\nTarefas:\n${real}\nFrequência:\nPresente`;
      assert.equal(montarDiario(texto)[0].temTarefa, true, `"${real}" sumiu`);
    }
  });
});

describe("argumentos das ferramentas no plano", () => {
  test("aceita o diario com uma data", () => {
    const r = ChamadaFerramenta.safeParse({ nome: "ler_diario", args: { data: "28/09/2026" } });
    assert.equal(r.success, true);
  });

  test("recusa data em formato errado, antes de virar navegacao", () => {
    const r = ChamadaFerramenta.safeParse({ nome: "ler_diario", args: { data: "segunda" } });
    assert.equal(r.success, false);
  });

  test("recusa argumento de uma ferramenta usado em outra", () => {
    // "data" nao existe no boletim: o contrato de cada uma e independente
    const r = ChamadaFerramenta.safeParse({ nome: "ler_boletim", args: { data: "28/09/2026" } });
    assert.equal(r.success, true); // chave extra e descartada pelo zod...
    assert.deepEqual(r.success && r.data.args, {}); // ...e nao chega na ferramenta
  });

  test("plano B manda tudo no padrao (nulo)", () => {
    assert.deepEqual(argsPadrao("ler_diario"), { data: null });
    assert.deepEqual(argsPadrao("ler_comunicados"), { limite: null });
    assert.deepEqual(argsPadrao("ler_boletim"), {});
  });

  test("os args padrao passam no contrato de cada capacidade", () => {
    for (const c of CAPACIDADES) {
      const r = c.entrada.safeParse(argsPadrao(c.nome));
      assert.equal(r.success, true, `${c.nome}: args padrao recusados`);
    }
  });

  test("nenhuma entrada usa .optional() (o modo estrito da OpenAI recusa)", async () => {
    const { zodResponseFormat } = await import("openai/helpers/zod");
    // se alguem criar uma capacidade com campo opcional, isto quebra aqui,
    // e nao na primeira pergunta da feira
    assert.doesNotThrow(() => zodResponseFormat(Plano as never, "plano"));
  });
});

describe("tabela de dias do cabecalho", () => {
  const quarta = new Date(2026, 8, 30);

  test("marca hoje, ontem e amanha", () => {
    const t = tabelaDeDias(quarta, 1, 1);
    assert.equal(t, "terça 29/09/2026 (ontem)\nquarta 30/09/2026 (HOJE)\nquinta 01/10/2026 (amanhã)");
  });

  test("atravessa a virada de mes e de ano", () => {
    const t = tabelaDeDias(new Date(2026, 11, 31), 0, 1);
    assert.match(t, /quinta 31\/12\/2026 \(HOJE\)/);
    assert.match(t, /sexta 01\/01\/2027/);
  });

  test("o cabecalho do prompt inclui a tabela", () => {
    assert.match(cabecalhoTemporal(), /\(HOJE\)/);
  });
});

describe("executar com parametros ausentes", () => {
  test("{} vale como 'tudo no padrao' e nao e recusado", async () => {
    // regressao pega pelo teste de integracao: depois de trocar .optional()
    // por .nullable(), chamar o diario com {} passou a falhar
    const { executar } = registro;
    const diario = registro.capacidade("ler_diario");
    const original = diario.ler;
    let recebeu: unknown = "nada";
    (diario as { ler: unknown }).ler = async (args: unknown) => {
      recebeu = args;
      return { data: "30/09/2026", disciplinas: [] };
    };
    try {
      await executar("ler_diario", {}, () => {});
      assert.deepEqual(recebeu, { data: null });
    } finally {
      (diario as { ler: unknown }).ler = original;
    }
  });
});

describe("perfil da dona da conta (vem da config local, nunca do codigo)", () => {
  const cfg = (valores: Record<string, string>) => (k: string) => valores[k] ?? "";

  test("sem config, o prompt nao cita nome nenhum", () => {
    assert.equal(quemAtende(cfg({})), "Voce e o assistente escolar de uma aluna.");
  });

  test("com config, cita nome e escola", () => {
    assert.equal(
      quemAtende(cfg({ ALUNO_NOME: "Ana", ESCOLA_NOME: "Colégio Exemplo" })),
      "Voce e o assistente escolar de Ana, aluna do Colégio Exemplo."
    );
  });

  test("a saudacao usa so o primeiro nome", () => {
    assert.match(sabia.saudacao(cfg({ ALUNO_NOME: "Ana Beatriz" })), /^Oi, Ana!/);
    assert.match(sabia.saudacao(cfg({})), /^Oi! /);
  });
});
