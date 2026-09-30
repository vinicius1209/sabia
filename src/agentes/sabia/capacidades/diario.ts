import { z } from "zod";
import { defineCapacidade } from "../../../nucleo/capacidade.ts";
import { abrirPortal, irParaItemDoMenu } from "./_portal.ts";
import { semAcento } from "../../../nucleo/texto.ts";

/* ----------------------------- contrato ---------------------------- */

export const Saida = z.object({
  data: z.string(),
  disciplinas: z.array(
    z.object({
      disciplina: z.string(),
      conteudo: z.string(),
      tarefas: z.string(),
      /** true quando a tarefa é de verdade, e não "Não houve" */
      temTarefa: z.boolean(),
    })
  ),
});

/* --------------------------- lógica pura --------------------------- */

/**
 * Jeitos que os professores escrevem "não teve tarefa". Testado no texto SEM
 * acento. "Sem tarefa." ficou de fora da primeira versão e o agente passou a
 * anunciar "tarefa de Biologia: Sem tarefa." (achado testando com dado real).
 */
const VAZIO =
  /^(nao (houve|ha|teve)( registro| tarefa)?|nao informado|sem (tarefa|registro|atividade)s?|nenhuma?( tarefa)?|-{1,3})\.?$/;

/**
 * O diário não vem em tabela: é texto corrido, em blocos por disciplina:
 *
 *   <Disciplina>
 *   Conteúdo ministrado:
 *   <texto>
 *   Tarefas:
 *   <texto>
 *   Frequência:
 *   <texto>
 *
 * "Não houve" vira `temTarefa: false`, para o agente não anunciar tarefa
 * onde não existe nenhuma.
 */
export function montarDiario(texto: string) {
  const linhas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const out: z.infer<typeof Saida>["disciplinas"] = [];
  let atual: { disciplina: string; conteudo: string[]; tarefas: string[] } | null = null;
  let campo: "conteudo" | "tarefas" | "outro" = "outro";

  const fechar = () => {
    if (!atual) return;
    const tarefas = atual.tarefas.join(" ").trim();
    out.push({
      disciplina: atual.disciplina,
      conteudo: atual.conteudo.join(" ").trim(),
      tarefas,
      temTarefa: Boolean(tarefas) && !VAZIO.test(semAcento(tarefas)),
    });
    atual = null;
  };

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    const chave = semAcento(l).replace(/:$/, "");

    if (chave === "conteudo ministrado") {
      // a disciplina é a linha anterior; fecha o bloco que estava aberto
      const nome = linhas[i - 1];
      fechar();
      if (nome) atual = { disciplina: nome, conteudo: [], tarefas: [] };
      campo = "conteudo";
      continue;
    }
    if (chave === "tarefas") { campo = "tarefas"; continue; }
    if (chave === "frequencia") { campo = "outro"; continue; }

    if (atual && campo === "conteudo") atual.conteudo.push(l);
    else if (atual && campo === "tarefas") atual.tarefas.push(l);
  }
  fechar();
  return out;
}

/* -------------------------- a capacidade --------------------------- */

export default defineCapacidade({
  nome: "ler_diario",
  rotulo: "Diário de classe",
  fonte: "Portal Activesoft",
  icone: "📒",
  intencao: "tarefas",
  descricao:
    "o diário de classe de um dia: o que cada professor deu de conteúdo e qual " +
    'TAREFA foi passada. Cada disciplina tem "temTarefa": se for false, não houve ' +
    "tarefa e você não deve inventar uma. Use para perguntas sobre dever de casa, " +
    "tarefa, trabalho passado em aula, ou o que foi dado na aula.",
  entrada: z.object({
    // .nullable(), e nao .optional(): o modo estrito da OpenAI recusa campo
    // opcional. Sem isto a pergunta "tarefa de segunda" quebrava o plano.
    data: z
      .string()
      .regex(/^\d{2}\/\d{2}\/\d{4}$/)
      .nullable()
      .describe("dia no formato DD/MM/AAAA; null para hoje. Use a tabela de dias do cabeçalho."),
  }),
  saida: Saida,

  async ler({ data }, passo) {
    const alvo = await abrirPortal(passo);
    passo("Abrindo o diário de classe");
    await irParaItemDoMenu(alvo, /agenda/, passo);

    if (data) {
      // O campo de data é readonly (datepicker jQuery): preencher não faz nada,
      // e não existe botão "Buscar". A própria página troca de dia assim:
      //   location.href = "agenda.asp?IdAluno=N&DataAula=" + data
      // Então navegamos direto para a URL com o parâmetro.
      passo(`Indo para o dia ${data}`);
      const url = new URL(alvo.url());
      url.searchParams.set("DataAula", data);
      await alvo.goto(url.toString(), { waitUntil: "domcontentloaded" });
      await alvo.waitForTimeout(1800);
    }

    passo("Lendo o que foi dado em aula");
    const { texto, dataNaTela } = await alvo.evaluate(() => ({
      texto: document.body.innerText,
      // a data REAL que a página está mostrando, lida do próprio campo
      dataNaTela: (document.querySelector("#data") as HTMLInputElement | null)?.value ?? "",
    }));
    await alvo.close().catch(() => {});

    // Nunca devolver a data pedida como se fosse a data mostrada. A versão
    // anterior fazia isso num fallback, e o agente afirmava "na segunda foi
    // dado X" mostrando o conteúdo de hoje.
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dataNaTela)) {
      throw new Error("Nao consegui confirmar qual dia o diario esta mostrando");
    }
    if (data && dataNaTela !== data) {
      throw new Error(`Pedi o diario de ${data}, mas a pagina mostrou ${dataNaTela}`);
    }
    return { data: dataNaTela, disciplinas: montarDiario(String(texto)) };
  },

  resumir: (d) => {
    const tarefas = d.disciplinas.filter((x) => x.temTarefa).length;
    return `${d.data}: ${d.disciplinas.length} disciplinas, ${tarefas} com tarefa`;
  },

  local: {
    sinais: { forte: /tarefa|dever|licao de casa|conteudo|diario|foi dado|deram|passaram/ },
    raciocinio: "Vou olhar o diário de classe para ver o que os professores passaram.",
    responder(_pergunta, d) {
      const comTarefa = d.disciplinas.filter((x) => x.temTarefa);
      if (!d.disciplinas.length) {
        return { resposta: "Não consegui ler o diário de classe agora.", itens: [] };
      }
      return {
        resposta: comTarefa.length
          ? `Em ${d.data} tem tarefa em ${comTarefa.length} disciplina(s).`
          : `Em ${d.data} nenhum professor passou tarefa.`,
        itens: (comTarefa.length ? comTarefa : d.disciplinas)
          .slice(0, 6)
          .map((x) => ({
            rotulo: x.disciplina,
            valor: x.temTarefa ? x.tarefas : x.conteudo || "sem registro",
          })),
      };
    },
  },
});
