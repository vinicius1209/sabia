import { z } from "zod";
import { defineCapacidade } from "../../../nucleo/capacidade.ts";
import { abrirPortal, irParaItemDoMenu, lerTabelas, clicarBuscar } from "./_portal.ts";
import { agora } from "../../../nucleo/contexto.ts";
import { semAcento } from "../../../nucleo/texto.ts";
import { celulaVazia, type Linha } from "../util.ts";

/* ----------------------------- contrato ---------------------------- */

export const Saida = z.object({
  turma: z.string(),
  /** nome do dia de hoje, já calculado: o modelo não precisa deduzir */
  hoje: z.string(),
  amanha: z.string(),
  grade: z.array(
    z.object({
      dia: z.string(),
      ehHoje: z.boolean(),
      ehAmanha: z.boolean(),
      aulas: z.array(
        z.object({ horario: z.string(), codigo: z.string(), disciplina: z.string() })
      ),
    })
  ),
});

/* --------------------------- lógica pura --------------------------- */

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/**
 * Monta a grade a partir das DUAS tabelas da tela:
 *  - dicionário de códigos (BIO -> Biologia)
 *  - grade (Horário x dias), que usa só os códigos
 * Sem juntar as duas, o agente responderia "amanhã você tem BIO, MAT, FIS".
 */
/** As duas tabelas da tela: a grade (cabeçalho "Horário") e o dicionário de códigos. */
export function acharTabelas(tabelas: Linha[][]) {
  const temCabecalho = (t: Linha[], re: RegExp) =>
    t.length > 1 && t[0].some((c) => re.test(semAcento(c)));
  return {
    dicionario: tabelas.find((t) => temCabecalho(t, /^(codigo|disciplina)$/)),
    grade: tabelas.find((t) => temCabecalho(t, /^horario$/)),
  };
}

export function montarHorarios(tabelas: Linha[][], hojeData: Date) {
  const { dicionario, grade } = acharTabelas(tabelas);

  const hoje = DIAS[hojeData.getDay()];
  const amanha = DIAS[(hojeData.getDay() + 1) % 7];
  if (!grade) return { grade: [] as z.infer<typeof Saida>["grade"], hoje, amanha };

  const nomes = new Map<string, string>();
  if (dicionario) {
    const cab = dicionario[0].map(semAcento);
    const iCod = cab.indexOf("codigo");
    const iDis = cab.indexOf("disciplina");
    if (iCod >= 0 && iDis >= 0) {
      for (const l of dicionario.slice(1)) {
        if (l[iCod] && l[iDis]) nomes.set(semAcento(l[iCod]), l[iDis]);
      }
    }
  }

  const out: z.infer<typeof Saida>["grade"] = [];
  const cabecalho = grade[0];
  for (let col = 1; col < cabecalho.length; col++) {
    const dia = cabecalho[col]?.trim();
    if (!dia) continue;

    const aulas = grade
      .slice(1)
      .filter((l) => !celulaVazia(l[col] ?? ""))
      .map((l) => {
        const codigo = (l[col] ?? "").trim();
        return {
          horario: (l[0] ?? "").trim(),
          codigo,
          disciplina: nomes.get(semAcento(codigo)) ?? codigo,
        };
      });

    if (!aulas.length) continue; // dia sem aula (sábado) não entra
    out.push({
      dia,
      ehHoje: semAcento(dia) === semAcento(hoje),
      ehAmanha: semAcento(dia) === semAcento(amanha),
      aulas,
    });
  }
  return { grade: out, hoje, amanha };
}

type Dados = z.infer<typeof Saida>;

/**
 * O dia que a pergunta pede, e a resposta quando esse dia não tem aula.
 * Nunca troca por outro dia: numa sexta, "amanhã" é sábado. Antes caía no
 * primeiro dia da grade e a resposta dizia as aulas de segunda como se fossem
 * de amanhã.
 */
export function diaPedido(pergunta: string, d: Dados): { dia: Dados["grade"][number] } | { semAula: string } {
  const p = semAcento(pergunta);
  const nomeado = DIAS.find((n) => new RegExp(`\\b${semAcento(n)}\\b`).test(p));
  const alvo = /amanh/.test(p) ? d.amanha : nomeado ?? d.hoje;
  const rotulo = /amanh/.test(p) ? `Amanhã (${alvo.toLowerCase()})` : nomeado ? alvo : `Hoje (${alvo.toLowerCase()})`;
  const dia = d.grade.find((x) => semAcento(x.dia) === semAcento(alvo));
  return dia ? { dia } : { semAula: `${rotulo} não tem aula no quadro de horários.` };
}

/* -------------------------- a capacidade --------------------------- */

export default defineCapacidade({
  nome: "ler_horarios",
  rotulo: "Quadro de horários",
  fonte: "Portal Activesoft",
  icone: "🕐",
  intencao: "horarios",
  descricao:
    "o quadro de horários da semana (que aula tem em cada dia). Cada dia já vem " +
    'marcado com "ehHoje" e "ehAmanha": use esses campos, não tente deduzir o dia. ' +
    "É a grade PADRÃO da semana: não sabe de feriado, passeio ou troca de aula. Se " +
    '"disciplina" vier igual ao "codigo" (ex.: GEO), cite o código, não adivinhe o nome. ' +
    'Se nenhum dia vier com "ehAmanha" (ex.: hoje é sexta e amanhã é sábado), amanhã não ' +
    "tem aula na grade: diga isso, nunca mostre outro dia no lugar.",
  entrada: z.object({}),
  saida: Saida,

  async ler(_args, passo, estrutura) {
    const alvo = await abrirPortal(passo);
    passo("Abrindo o quadro de horários");
    await irParaItemDoMenu(alvo, /quadroHorarios/, passo);

    const turma = await alvo
      .evaluate(() => document.body.innerText.match(/Ensino M[eé]dio[^\n]*/)?.[0] ?? "")
      .catch(() => "");

    passo("Lendo a grade da semana");
    await clicarBuscar(alvo);
    const tabelas = await lerTabelas(alvo);
    await alvo.close().catch(() => {});

    // Sem a grade, a resposta seria "amanhã você não tem aula". É erro, não vazio.
    const achadas = acharTabelas(tabelas);
    if (!achadas.grade) {
      throw new Error("Não achei o quadro de horários na página. Ela pode ter mudado de formato.");
    }
    estrutura?.(
      `grade: ${achadas.grade[0].join(" | ")}\ndicionario: ${achadas.dicionario?.[0].join(" | ") ?? "ausente"}`
    );
    const { grade, hoje, amanha } = montarHorarios(tabelas, agora().inicioDoDia);
    return { turma: String(turma).trim(), hoje, amanha, grade };
  },

  resumir: (d) => {
    const aulas = d.grade.reduce((n, x) => n + x.aulas.length, 0);
    return `${d.grade.length} dias, ${aulas} aulas na semana`;
  },

  local: {
    sinais: { forte: /horario|grade|proxima aula|que aula|quais aulas|aulas? (de )?amanha|tenho amanha/, fraco: /aula/ },
    raciocinio: "Vou abrir o quadro de horários da semana.",
    responder(pergunta, d) {
      const pedido = diaPedido(pergunta, d);
      if ("semAula" in pedido) return { resposta: pedido.semAula, itens: [] };
      const { dia } = pedido;
      return {
        resposta: `${dia.dia}: você tem ${dia.aulas.length} aula(s).`,
        itens: dia.aulas.slice(0, 8).map((a) => ({
          rotulo: a.horario.split(" - ")[0] || a.horario,
          valor: a.disciplina,
        })),
      };
    },
  },
});
