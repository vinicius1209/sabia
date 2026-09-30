/**
 * Benchmark dos modelos no trabalho REAL do agente, sem navegador.
 *   npm run bench
 *   MODELOS="gpt-6-luna,gpt-5.6-luna" RODADAS=3 npm run bench
 *   MODELOS="gpt-6-luna,claude:haiku,claude:sonnet,codex:" npm run bench
 *   DIFICIL=1 npm run bench
 *   CASOS=interpretacao npm run bench   (as armadilhas de leitura que ja aconteceram)
 *
 * Usa o MESMO motor, o mesmo prompt e o mesmo contrato da produção
 * (criarMotor + montarSistema). A versão anterior tinha uma cópia própria do prompt, que
 * ficou para trás quando surgiram horários e diário: comparava modelos com
 * um prompt diferente do que roda de verdade.
 */
import path from "node:path";
import sabia from "../src/agentes/sabia/index.ts";
import { carregarConfig, lerConfig } from "../src/nucleo/config.ts";
import { criarMotor } from "../src/nucleo/motores/index.ts";
import { montarSistema } from "../src/nucleo/prompt.ts";
import { criarRegistro, type Plano } from "../src/nucleo/registro.ts";
import type { Troca } from "../src/nucleo/memoria.ts";
import { completarPlano } from "../src/nucleo/agente.ts";
import { congelarRelogio } from "../src/nucleo/contexto.ts";
import { extrairLegenda, montarNotas } from "../src/agentes/sabia/capacidades/boletim.ts";
import { marcarEventos } from "../src/agentes/sabia/capacidades/calendario.ts";

// as mesmas chaves do app (~/.sabia/config.json, ou o .env na primeira vez)
carregarConfig(path.resolve(import.meta.dirname, ".."));
const registro = criarRegistro(sabia.capacidades);
const deps = { registro, sistema: () => montarSistema(sabia, registro, lerConfig) };

const CANDIDATOS = (process.env.MODELOS || "gpt-6-luna,gpt-5.6-luna,gpt-4.1-mini").split(",");
const RODADAS = Number(process.env.RODADAS || 1);

/* Dados FICTICIOS, gerados pelos proprios leitores (montarNotas, marcarEventos)
   a partir de linhas no layout real: se o formato mudar, o bench muda junto.
   Hoje = 26/09/2026. */
const HOJE = new Date(2026, 8, 26);
// o cabeçalho do prompt ("Agora são...") tem que falar do mesmo dia dos dados
congelarRelogio(process.env.SABIA_AGORA || "2026-09-26T10:00:00-03:00");
const SEM_ANUAL = ["--", "-", "-", "-", "--", "-", "--", "-"];
const VAZIO_2SEM = ["-", "-", "-", "-", "-", "-", "-", "--", "-"];
const linha = (nome: string, s1: string[], s2: string[], total: string) =>
  [nome, ...s1, ...s2, ...SEM_ANUAL, total, "Cursando"];

const BOL = {
  formato: "tabela",
  notas: montarNotas([
    linha("Matemática", ["9,5", "8,8", "7,6", "9,0", "3,0", "*", "*", "7,3", "12"], ["7,1", "-", "-", "-", "-", "-", "-", "--", "5"], "17"),
    linha("Física", ["9,0", "9,5", "8,0", "8,0", "0,0", "7,5", "*", "8,5", "6"], ["-", "-", "-", "6,0", "-", "-", "-", "--", "3"], "9"),
    linha("História", ["9,0", "9,5", "9,0", "9,2", "9,0", "*", "*", "9,1", "3"], VAZIO_2SEM, "3"),
    // Portugues: um 0,0 no T2 e 4,1 na P2, e a recuperacao (RS) 8,6
    linha("Língua Portuguesa e suas Literaturas", ["8,0", "0,0", "7,9", "7,0", "4,1", "8,6", "*", "5,8", "2"], ["-", "-", "-", "6,8", "-", "-", "-", "--", "1"], "3"),
    linha("Educação Física *", ["CE", "CE", "CE", "CE", "CE", "*", "*", "CE", "1"], VAZIO_2SEM, "1"),
  ]),
  legenda: extrairLegenda(
    "* = Dispensado da avaliação\n-- = Disciplina não requer nota\n" +
      "CE - CONCLUIU COM EXCELÊNCIA   CS - CONCLUIU SATISFATORIAMENTE   CP - CONCLUIU PARCIALMENTE   NC - NÃO CONCLUIU\n" +
      "T1 - Trabalho 1\nT2 - Trabalho 2\nSIM - Simulado\nP1 - Prova 1\nP2 - Prova 2\nREC - Recuperação"
  ),
};
const CAL = {
  mes: "September 2026 e October 2026",
  hoje: "2026-09-26",
  eventos: marcarEventos(
    [
      { mes: "September 2026", dia: 17, evento: "Avaliação de Química e Redação - EM" },
      { mes: "September 2026", dia: 23, evento: "Prova de Segunda Chamada" },
      { mes: "October 2026", dia: 2, evento: "Prova de Segunda Chamada" },
      { mes: "October 2026", dia: 12, evento: "Feriado - Nossa Senhora Aparecida" },
      { mes: "October 2026", dia: 14, evento: "Oficina de Oratória" },
      { mes: "October 2026", dia: 17, evento: "Simulado - 9° ao 3°EM" },
    ],
    HOJE
  ),
};
const DIA = {
  data: "28/09/2026",
  disciplinas: [
    { disciplina: "Biologia", conteudo: "Células", tarefas: "Sem tarefa.", temTarefa: false },
    { disciplina: "Matemática", conteudo: "Funções", tarefas: "Lista 7", temTarefa: true },
  ],
};

interface Caso {
  p: string;
  tools: string[];
  /** args esperados de alguma ferramenta, quando importa */
  args?: Record<string, unknown>;
  dados: Record<string, unknown> | null;
  /** tudo isto precisa aparecer na resposta */
  precisa?: string[];
  /** nada disto pode aparecer */
  proibido?: RegExp[];
  /** a conversa antes desta pergunta */
  historico?: Troca[];
  /** outros planos igualmente seguros (ex.: explicar de memoria OU ler de novo) */
  toolsAceitas?: string[][];
  /** proibido so quando NADA foi lido agora (numero novo sem fonte) */
  proibidoSemLeitura?: RegExp[];
}

const FACEIS: Caso[] = [
  { p: "Oi, tudo bem?", tools: [], dados: null },
  { p: "Qual minha nota de matematica?", tools: ["ler_boletim"], dados: { ler_boletim: BOL }, precisa: ["7,3"] },
  { p: "Quando e minha proxima prova?", tools: ["ler_calendario"], dados: { ler_calendario: CAL },
    precisa: ["17"], proibido: [/23 de setembro/i] },
];

const DIFICEIS: Caso[] = [
  { p: "Tem alguma materia que eu preciso me preocupar?", tools: ["ler_boletim"],
    dados: { ler_boletim: BOL }, precisa: ["5,8"] },
  { p: "Qual minha nota de educacao fisica?", tools: ["ler_boletim"], dados: { ler_boletim: BOL },
    precisa: ["CE"], proibido: [/7,3|8,5|9,1|5,8/] },
  { p: "Quando foi a prova de segunda chamada?", tools: ["ler_calendario"],
    dados: { ler_calendario: CAL }, precisa: ["23"], proibido: [/simulado/i] },
  // precisa escolher a DATA certa pela tabela de dias do cabecalho
  { p: "Que tarefa passaram na segunda-feira?", tools: ["ler_diario"],
    args: { data: "28/09/2026" }, dados: { ler_diario: DIA }, precisa: ["Lista 7"],
    proibido: [/Biologia: Sem tarefa/] },
];

/* As armadilhas de interpretacao que ja aconteceram de verdade (set/2026). */
const INTERPRETACAO: Caso[] = [
  // o 0,0 do T2 foi chamado de "nota baixa" sem dizer de onde era
  { p: "Tirei zero em alguma coisa?", tools: ["ler_boletim"], dados: { ler_boletim: BOL },
    precisa: ["T2", "5,8"], proibido: [/reprovad|aprovad/i] },
  // a media e do 1o semestre: nao pode virar "media do ano"
  { p: "Qual minha media anual de matematica?", tools: ["ler_boletim"], dados: { ler_boletim: BOL },
    precisa: ["7,3", "1º semestre"] },
  // faltas: o total do ano (17), nao so do 1o semestre (12)
  { p: "Quantas faltas eu tenho em matematica?", tools: ["ler_boletim"], dados: { ler_boletim: BOL },
    precisa: ["17"] },
  // a segunda chamada de 02/10 nao e a proxima prova de quem nao faltou
  { p: "Quando e minha proxima prova?", tools: ["ler_calendario"], dados: { ler_calendario: CAL },
    precisa: ["17"], proibido: [/pr[oó]xima (prova|avalia[cç][aã]o)[^.]{0,40}(segunda chamada|2 de outubro|02\/10)/i] },
  // os dados nao dizem a media minima: nada de aprovado/reprovado
  { p: "Eu vou passar de ano?", tools: ["ler_boletim"], dados: { ler_boletim: BOL },
    // afirmar aprovacao e proibido; dizer que NAO sabe "se voce esta aprovada" e o certo
    proibido: [/(?<!\bse )\bvoc[eê] (est[aá]|foi|ser[aá]|vai ser) (aprovad|reprovad)/i, /m[eé]dia m[ií]nima [eé] (de )?\d/i] },
];

/* Continuacao: a pista SO existe na resposta anterior, nao na pergunta. */
const antes = (pergunta: string, resposta: string, itens: Troca["itens"] = []): Troca => ({
  pergunta, intencao: "notas", resposta, itens, quando: "2026-09-26T13:00:00.000Z",
});
const JA_FALOU_DE_PORTUGUES = [
  antes(
    "Tem alguma materia que eu preciso me preocupar?",
    "Pelas medias do 1º semestre, o ponto de atencao e Lingua Portuguesa, com 5,8.",
    [{ rotulo: "Língua Portuguesa (média 1º sem.)", valor: "5,8" }]
  ),
];
const CONTINUACAO: Caso[] = [
  // "nessa materia" so se resolve pela RESPOSTA anterior (Portugues tem 3 faltas; Matematica, 17)
  { p: "E quantas faltas eu tenho nessa materia?", tools: ["ler_boletim"], dados: { ler_boletim: BOL },
    historico: JA_FALOU_DE_PORTUGUES, precisa: ["3"], proibido: [/\b17\b/] },
  // explicar o que ja disse: sem consultar de novo, e sem numero novo
  { p: "Por que voce disse isso?", tools: [], toolsAceitas: [["ler_boletim"]], dados: null,
    historico: JA_FALOU_DE_PORTUGUES, precisa: ["5,8"], proibidoSemLeitura: [/\b(7,3|8,5|9,1)\b/] },
  // a memoria diz 6,4, a fonte de agora diz 5,8: vale a de agora
  { p: "E qual e mesmo a media de portugues?", tools: ["ler_boletim"], dados: { ler_boletim: BOL },
    historico: [antes("Qual minha nota de portugues?", "Sua media de Portugues no 1º semestre e 6,4.")],
    precisa: ["5,8"] },
];

const CASOS =
  process.env.CASOS === "interpretacao" ? INTERPRETACAO
  : process.env.CASOS === "continuacao" ? CONTINUACAO
  : process.env.DIFICIL ? DIFICEIS
  : FACEIS;

const nomes = (p: Plano) => p.ferramentas.map((f) => f.nome);

for (const candidato of CANDIDATOS) {
  // "gpt-6-luna" (OpenAI), ou "provedor:modelo": claude:haiku, codex:, gemini:gemini-2.5-flash
  const [provedor, modelo] = candidato.includes(":") ? candidato.split(":") : ["openai", candidato];
  const motor = criarMotor(deps, { id: provedor, modelo });
  const t0 = Date.now();
  let acertos = 0, total = 0;
  const falhas = new Set<string>();

  try {
    for (let r = 0; r < RODADAS; r++) {
      for (const c of CASOS) {
        total++;
        const planoDoModelo = await motor.plano({
          pergunta: c.p,
          instrucao:
            "Monte o plano para responder. Se a pergunta precisa de um dado, consulte a fonte agora, " +
            "mesmo que a conversa ja tenha falado dele. So dispense a consulta se ela pede para " +
            "explicar ou retomar o que voce ja respondeu.",
          historico: c.historico,
        });
        // o que o AGENTE faz: o plano do modelo mais a regra do codigo
        const { plano } = completarPlano(planoDoModelo, registro, c.p);

        const aceitos = [c.tools, ...(c.toolsAceitas ?? [])].map((t) => JSON.stringify(t));
        let ok = aceitos.includes(JSON.stringify(nomes(plano)));
        if (!ok) falhas.add(`plano "${c.p.slice(0, 26)}": ${JSON.stringify(nomes(plano))}`);

        if (ok && c.args) {
          const achou = plano.ferramentas.find((f) => f.nome === c.tools[0]);
          if (JSON.stringify(achou?.args) !== JSON.stringify(c.args)) {
            ok = false;
            falhas.add(`args "${c.p.slice(0, 26)}": ${JSON.stringify(achou?.args)}`);
          }
        }

        // como no agente: a resposta recebe o que o PLANO leu
        const FIXTURES: Record<string, unknown> = { ler_boletim: BOL, ler_calendario: CAL, ler_diario: DIA };
        const lidos = plano.ferramentas.length
          ? Object.fromEntries(plano.ferramentas.map((f) => [f.nome, FIXTURES[f.nome] ?? {}]))
          : undefined;
        const resp = await motor.resposta({
          pergunta: c.p,
          instrucao: lidos
            ? "Responda com base APENAS nos dados abaixo (a conversa so ajuda a entender a pergunta)."
            : "Nenhuma fonte foi consultada agora. Converse, ou retome o que voce ja respondeu nesta " +
              "conversa dizendo de que horas e aquela leitura. Nao afirme dado novo.",
          dados: lidos,
          historico: c.historico,
        });
        const txt = resp.resposta + JSON.stringify(resp.itens);
        let okResp = (c.precisa ?? []).every((x) => txt.includes(x));
        for (const bad of c.proibido ?? []) if (bad.test(txt)) okResp = false;
        if (!lidos) for (const bad of c.proibidoSemLeitura ?? []) if (bad.test(txt)) okResp = false;
        if (!okResp) {
          const itens = resp.itens.map((i) => `${i.rotulo}=${i.valor}`).join("; ");
          falhas.add(`resposta "${c.p.slice(0, 26)}": ${resp.resposta.slice(0, 220)}${itens ? ` [itens: ${itens.slice(0, 200)}]` : ""}`);
        }

        if (ok && okResp) acertos++;
      }
    }
    const seg = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`${candidato.padEnd(15)} ${acertos}/${total} acertos | ${seg}s`);
    falhas.forEach((f) => console.log(`                  x ${f}`));
  } catch (e) {
    console.log(`${candidato.padEnd(15)} ERRO: ${String(e instanceof Error ? e.message : e).slice(0, 90)}`);
  }
}
