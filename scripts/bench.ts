/**
 * Benchmark dos modelos no trabalho REAL do agente, sem navegador.
 *   npm run bench
 *   MODELOS="gpt-6-luna,gpt-5.6-luna" RODADAS=3 npm run bench
 *   MODELOS="gpt-6-luna,claude:haiku,claude:sonnet,codex:" npm run bench
 *   DIFICIL=1 npm run bench
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

// as mesmas chaves do app (~/.sabia/config.json, ou o .env na primeira vez)
carregarConfig(path.resolve(import.meta.dirname, ".."));
const registro = criarRegistro(sabia.capacidades);
const deps = { registro, sistema: () => montarSistema(sabia, registro, lerConfig) };

const CANDIDATOS = (process.env.MODELOS || "gpt-6-luna,gpt-5.6-luna,gpt-4.1-mini").split(",");
const RODADAS = Number(process.env.RODADAS || 1);

/* dados ficticios, no formato real dos leitores (hoje = 26/09/2026) */
const CAL = {
  mes: "September 2026 e October 2026",
  hoje: "2026-09-26",
  eventos: [
    { mes: "September 2026", dia: 17, evento: "Avaliação de Química e Redação - EM", data: "2026-09-17", passou: true },
    { mes: "September 2026", dia: 23, evento: "Prova de Segunda Chamada", data: "2026-09-23", passou: true },
    { mes: "October 2026", dia: 17, evento: "Simulado - 9° ao 3°EM", data: "2026-10-17", passou: false },
  ],
};
const BOL = {
  formato: "tabela",
  notas: [
    { disciplina: "Matemática", media: "7,3", faltas: "12", valores: [] },
    { disciplina: "Física", media: "8,5", faltas: "6", valores: [] },
    { disciplina: "História", media: "9,1", faltas: "3", valores: [] },
    { disciplina: "Língua Portuguesa e suas Literaturas", media: "5,8", faltas: "2", valores: [] },
    { disciplina: "Educação Física *", media: "CE", faltas: "1", valores: [] },
  ],
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
  precisa?: string;
  proibido?: string[];
}

const FACEIS: Caso[] = [
  { p: "Oi, tudo bem?", tools: [], dados: null },
  { p: "Qual minha nota de matematica?", tools: ["ler_boletim"], dados: { ler_boletim: BOL }, precisa: "7,3" },
  { p: "Quando e minha proxima prova?", tools: ["ler_calendario"], dados: { ler_calendario: CAL },
    precisa: "17", proibido: ["23 de setembro", "Segunda Chamada"] },
];

const DIFICEIS: Caso[] = [
  { p: "Tem alguma materia que eu preciso me preocupar?", tools: ["ler_boletim"],
    dados: { ler_boletim: BOL }, precisa: "5,8" },
  { p: "Qual minha nota de educacao fisica?", tools: ["ler_boletim"], dados: { ler_boletim: BOL },
    precisa: "CE", proibido: ["7,3", "8,5", "9,1", "5,8"] },
  { p: "Quando foi a prova de segunda chamada?", tools: ["ler_calendario"],
    dados: { ler_calendario: CAL }, precisa: "23", proibido: ["Simulado"] },
  // precisa escolher a DATA certa pela tabela de dias do cabecalho
  { p: "Que tarefa passaram na segunda-feira?", tools: ["ler_diario"],
    args: { data: "28/09/2026" }, dados: { ler_diario: DIA }, precisa: "Lista 7",
    proibido: ["Biologia: Sem tarefa"] },
];

const CASOS = process.env.DIFICIL ? DIFICEIS : FACEIS;

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
        const plano = await motor.plano({ pergunta: c.p, instrucao: "Monte o plano para responder." });

        let ok = JSON.stringify(nomes(plano)) === JSON.stringify(c.tools);
        if (!ok) falhas.add(`plano "${c.p.slice(0, 26)}": ${JSON.stringify(nomes(plano))}`);

        if (ok && c.args) {
          const achou = plano.ferramentas.find((f) => f.nome === c.tools[0]);
          if (JSON.stringify(achou?.args) !== JSON.stringify(c.args)) {
            ok = false;
            falhas.add(`args "${c.p.slice(0, 26)}": ${JSON.stringify(achou?.args)}`);
          }
        }

        const resp = await motor.resposta({
          pergunta: c.p,
          instrucao: c.dados ? "Responda com base APENAS nos dados abaixo." : "Responda apenas conversando.",
          dados: c.dados ?? undefined,
        });
        const txt = resp.resposta + JSON.stringify(resp.itens);
        let okResp = c.precisa ? txt.includes(c.precisa) : true;
        for (const bad of c.proibido ?? []) if (txt.includes(bad)) okResp = false;
        if (!okResp) falhas.add(`resposta "${c.p.slice(0, 26)}": ${resp.resposta.slice(0, 60)}`);

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
