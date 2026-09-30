/**
 * Testes rapidos, sem rede e sem navegador.
 * Cobrem as regras que ja erraram de verdade neste projeto.
 *   npm test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { offsetDaMedia, ehDisciplina, montarNotas } from "../src/capacidades/boletim.ts";
import { marcarEventos } from "../src/capacidades/calendario.ts";
import { montarHorarios } from "../src/capacidades/horarios.ts";
import { montarDiario } from "../src/capacidades/diario.ts";
import { CAPACIDADES, descricaoDasFontes, escolherLocal, ChamadaFerramenta, argsPadrao } from "../src/capacidades/index.ts";
import { agora, cabecalhoTemporal, tabelaDeDias } from "../src/contexto.ts";
import { Plano, Resposta, limparTexto, limparResposta } from "../src/contracts.ts";
import { motorLocal } from "../src/local.ts";
import { iniciais, quemAtende } from "../src/perfil.ts";

/* Cabecalho real do Activesoft (uma linha so, como vem raspado). */
const CABECALHO = [
  "Disciplinas", "1º SEM", "2º SEM", "MA", "RECF", "MF", "Total de\nfaltas", "Situação",
  "T1", "T2", "SIM", "P1", "P2", "RS", "AJUSTE", "MED", "F",
  "T1", "T2", "SIM", "P1", "P2", "RS", "AJUSTE", "MED", "F",
];
/* Linhas no layout real, com notas ficticias. Fisica tem 8,5 no 1o sem e um
   6,0 solto no 2o semestre (o erro que o agente cometeu de verdade). */
const FISICA = ["Física", "9,0", "9,5", "8,0", "8,0", "0,0", "7,5", "*", "8,5", "6",
                "-", "-", "-", "6,0", "-", "-", "-", "--", "3"];
const MATEMATICA = ["Matemática", "9,5", "8,8", "7,6", "9,0", "3,0", "*", "*", "7,3", "12",
                    "7,1", "-", "-", "-", "-", "-", "-", "--", "4"];
const EDFISICA = ["Educação Física *", "CE", "CE", "CE", "CE", "CE", "*", "*", "CE", "1"];
const RODAPE = ["Declaro para os devidos fins que recebi o boletim escolar de Fulana de Tal", "x", "y", "z"];

describe("boletim: qual coluna e a media", () => {
  test("acha o offset da MED a partir do T1", () => {
    assert.equal(offsetDaMedia([CABECALHO]), 7);
  });

  test("sem cabecalho reconhecivel, usa o layout padrao", () => {
    assert.equal(offsetDaMedia([["lixo", "sem", "cabecalho"]]), 7);
  });

  test("Fisica e 8,5 (media do 1o sem), NAO 6,0 (prova solta do 2o sem)", () => {
    const [fisica] = montarNotas([CABECALHO, FISICA]);
    assert.equal(fisica.media, "8,5");
    assert.equal(fisica.faltas, "6");
  });

  test("Matematica e 7,3, NAO 9,5 (que e a nota do trabalho 1)", () => {
    const [mat] = montarNotas([CABECALHO, MATEMATICA]);
    assert.equal(mat.media, "7,3");
  });

  test("conceito (CE) vem como conceito, sem virar numero", () => {
    const [ed] = montarNotas([CABECALHO, EDFISICA]);
    assert.equal(ed.media, "CE");
  });

  test("rodape longo nao entra como disciplina (barrado pelo tamanho)", () => {
    assert.equal(ehDisciplina(RODAPE[0]), false);
    const notas = montarNotas([CABECALHO, FISICA, RODAPE]);
    assert.equal(notas.length, 1);
    assert.equal(notas[0].disciplina, "Física");
  });

  test("rodape CURTO tambem e barrado, pelo filtro de palavras", () => {
    // sem estes casos o teste acima passa so por causa do limite de tamanho,
    // e a gente nunca saberia se o filtro de palavras quebrou
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
    const r = Plano.safeParse({ intencao: "notas", raciocinio: "x", ferramentas: ["hackear_escola"] });
    assert.equal(r.success, false);
  });

  test("Plano recusa intencao inventada", () => {
    const r = Plano.safeParse({ intencao: "apagar_tudo", raciocinio: "x", ferramentas: [] });
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

describe("motor local (plano B da feira)", () => {
  const m = motorLocal();
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
          notas: [
            { disciplina: "Física", media: "8,5", faltas: "6", valores: [] },
            { disciplina: "História", media: "9,1", faltas: "3", valores: [] },
          ],
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
    const { executar } = await import("../src/capacidades/index.ts");
    const { default: diario } = await import("../src/capacidades/diario.ts");
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

describe("perfil da dona da conta (vem do .env, nunca do codigo)", () => {
  test("iniciais do avatar", () => {
    assert.equal(iniciais("Ana Beatriz Souza"), "AB");
    assert.equal(iniciais("  joana "), "J");
    assert.equal(iniciais(""), "EU");
  });

  test("sem .env, o prompt nao cita nome nenhum", () => {
    const antes = { ...process.env };
    delete process.env.ALUNO_NOME; delete process.env.ALUNO_SERIE; delete process.env.ESCOLA_NOME;
    try {
      assert.equal(quemAtende(), "Voce e o assistente escolar de uma aluna.");
      process.env.ALUNO_NOME = "Ana";
      process.env.ESCOLA_NOME = "Colégio Exemplo";
      assert.equal(quemAtende(), "Voce e o assistente escolar de Ana, aluna do Colégio Exemplo.");
    } finally {
      process.env = antes;
    }
  });
});
