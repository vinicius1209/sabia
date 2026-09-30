import { z } from "zod";
import { defineCapacidade } from "../../../nucleo/capacidade.ts";
import { getBrowser, getEntityId, navegarAutenticado } from "../browser.mjs";
import { agora } from "../../../nucleo/contexto.ts";

const CLASSAPP = "https://classapp.com.br";

/* ----------------------------- contrato ---------------------------- */

export const Saida = z.object({
  mes: z.string(),
  hoje: z.string(),
  eventos: z.array(
    z.object({
      mes: z.string(),
      dia: z.number(),
      evento: z.string(),
      data: z.string(),
      /** já aconteceu? calculado no código, o modelo não compara datas */
      passou: z.boolean(),
      /** é prova/avaliação? calculado no código: o calendário mistura prova, feriado, oficina e festa */
      ehAvaliacao: z.boolean(),
      /** segunda chamada só vale para quem faltou à prova original */
      ehSegundaChamada: z.boolean(),
    })
  ),
});

/* --------------------------- lógica pura --------------------------- */

const MESES: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

export interface EventoBruto { mes: string; dia: number; evento: string }

/** O que conta como prova ou avaliação no calendário da escola. */
export const AVALIACAO = /prova|avalia|simulado|recupera|exame|chamada|\bteste\b/i;
const SEGUNDA_CHAMADA = /(2ª|2a|segunda)\s*chamada/i;

/**
 * Marca data ISO, "passou", se é avaliação, e ordena. Com os booleanos
 * prontos o modelo só precisa pegar o primeiro com passou=false e
 * ehAvaliacao=true, em vez de decidir sozinho o que é prova.
 *
 * Evento com mês que não dá para entender fica com data vazia e vai para o
 * FIM: a data vazia ordenava antes de todas, e um evento sem data virava a
 * "próxima prova".
 */
export function marcarEventos(brutos: EventoBruto[], inicioDeHoje: Date) {
  return brutos
    .map((e) => {
      const tipo = { ehAvaliacao: AVALIACAO.test(e.evento), ehSegundaChamada: SEGUNDA_CHAMADA.test(e.evento) };
      const [nomeMes, ano] = (e.mes || "").split(" ");
      const mi = MESES[(nomeMes || "").toLowerCase()];
      if (mi === undefined || !ano) return { ...e, data: "", passou: false, ...tipo };
      const d = new Date(Number(ano), mi, e.dia);
      return {
        ...e,
        data: `${ano}-${String(mi + 1).padStart(2, "0")}-${String(e.dia).padStart(2, "0")}`,
        passou: d < inicioDeHoje,
        ...tipo,
      };
    })
    .sort((a, b) => (!a.data ? 1 : !b.data ? -1 : a.data.localeCompare(b.data)));
}

/* -------------------------- a capacidade --------------------------- */

export default defineCapacidade({
  nome: "ler_calendario",
  rotulo: "Calendário e provas",
  fonte: "ClassApp",
  icone: "📅",
  intencao: "provas",
  descricao:
    "o calendário da escola, com datas de provas (Avaliações) e eventos. Cada " +
    'evento tem "passou" e a lista vem ordenada: pergunta sobre o FUTURO usa só ' +
    "passou=false, sobre o PASSADO usa passou=true. Nunca troque um pelo outro. " +
    'O calendário mistura prova com feriado, oficina e festa: "prova" é só evento com ' +
    'ehAvaliacao=true. Evento com ehSegundaChamada=true só vale para quem faltou à prova ' +
    "original: não diga que é a próxima prova da aluna, cite à parte. Evento com data vazia " +
    'não tem data confiável. Só foram lidos os meses em "mes": se não achar, diga que não ' +
    "encontrou NESSES meses, nunca que não existe.",
  entrada: z.object({}),
  saida: Saida,

  async ler(_args, passo, estrutura) {
    const { page } = await getBrowser();
    const id = getEntityId();
    passo("Lendo o calendário");

    await navegarAutenticado(`${CLASSAPP}/entities/${id}/commitments`, passo);
    await page.locator("td, [role='gridcell']").first()
      .waitFor({ state: "attached", timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);

    const lerMes = () =>
      page.evaluate(() => {
        const mes = document.body.innerText.match(/[A-Z][a-z]+ \d{4}/)?.[0] || "";
        const eventos: { mes: string; dia: number; evento: string }[] = [];
        const celulas = document.querySelectorAll("td, [role='gridcell']");
        celulas.forEach((c) => {
          const txt = (c as HTMLElement).innerText.trim();
          if (!txt) return;
          const linhas = txt.split("\n").map((s) => s.trim()).filter(Boolean);
          const dia = linhas[0];
          if (/^\d{1,2}$/.test(dia) && linhas.length > 1) {
            linhas.slice(1).forEach((e) => eventos.push({ mes, dia: Number(dia), evento: e }));
          }
        });
        return { mes, eventos, celulas: celulas.length };
      });

    const atual = await lerMes();
    // Sem o título do mês ou sem as células, a resposta seria "nada marcado".
    // É erro, não vazio.
    if (!atual.mes || !atual.celulas) {
      throw new Error("Não reconheci o calendário na página. Ela pode ter mudado de formato.");
    }
    // a forma, não os valores: "September 2026" vira "Mês AAAA"
    estrutura?.(`titulo do mes: ${atual.mes.replace(/[A-Z][a-z]+/, "Mês").replace(/\d{4}/, "AAAA")}\ncelulas: td ou gridcell`);

    // Sem o mês seguinte, perto do fim do mês todas as provas já passaram
    // e não existe resposta possível para "qual a próxima prova".
    let seguinte = { mes: "", eventos: [] as EventoBruto[], celulas: 0 };
    try {
      passo("Olhando o mês seguinte também");
      // as setas não são <button>: são div.arrow com <i class="arrow right icon">
      const proxima = page.locator("div.arrow").filter({ has: page.locator("i.right") }).first();
      if (await proxima.count()) await proxima.click({ timeout: 5000 });
      else {
        const setas = page.locator("div.arrow");
        const n = await setas.count();
        if (n >= 2) await setas.nth(n - 1).click({ timeout: 5000 });
      }
      await page.waitForTimeout(3000);
      const prox = await lerMes();
      if (prox.mes && prox.mes !== atual.mes) seguinte = prox;
    } catch { /* segue só com o mês atual */ }

    const { inicioDoDia, iso } = agora();
    return {
      mes: [atual.mes, seguinte.mes].filter(Boolean).join(" e "),
      hoje: iso,
      eventos: marcarEventos([...atual.eventos, ...seguinte.eventos], inicioDoDia),
    };
  },

  resumir: (d) => {
    const futuros = d.eventos.filter((e) => !e.passou).length;
    return `${d.eventos.length} eventos, ${futuros} ainda por vir`;
  },

  local: {
    sinais: { forte: /prova|avaliac|simulado|feriado|evento|calendario/, fraco: /quando|data|dia \d/ },
    raciocinio: "Vou conferir o calendário da escola para achar as datas.",
    responder(_pergunta, d) {
      const futuros = d.eventos.filter((e) => !e.passou);
      const provas = futuros.filter((e) => e.ehAvaliacao && !e.ehSegundaChamada && e.data);
      const lista = provas.length ? provas : futuros;
      return {
        resposta: provas.length
          ? `Sua próxima avaliação é ${provas[0].evento}, dia ${provas[0].dia}.`
          : futuros.length
            ? `Não achei prova marcada em ${d.mes}, mas tem estes eventos vindo.`
            : `Não tem nada marcado no calendário em ${d.mes}.`,
        itens: lista.slice(0, 8).map((e) => ({
          rotulo: `${e.dia} ${(e.mes || "").split(" ")[0]}`.trim(),
          valor: e.evento,
        })),
      };
    },
  },
});
