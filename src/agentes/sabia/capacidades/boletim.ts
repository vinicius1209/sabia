import { z } from "zod";
import type { Page } from "playwright";
import { defineCapacidade } from "../../../nucleo/capacidade.ts";
import { abrirPortal, irParaItemDoMenu, clicarBuscar } from "./_portal.ts";
import { semAcento } from "../../../nucleo/texto.ts";
import type { Linha } from "../util.ts";

/* ==================================================================
 * O boletim do Portal Activesoft.
 *
 * A tabela tem 28 colunas por disciplina, em dois níveis de cabeçalho:
 *
 *   1º SEM  T1 T2 SIM P1 P2 RS AJUSTE MED F
 *   2º SEM  T1 T2 SIM P1 P2 RS AJUSTE MED F
 *   MA      MED F                          (média anual)
 *   RECF    REC Cons.Final MED F           (recuperação final)
 *   MF      MED F                          (média final)
 *   Total de faltas · Situação de conclusão na disciplina
 *
 * Três leituras erradas que a versão anterior fazia, e que este arquivo
 * existe para impedir:
 *   - chamava de "média" a média do 1º SEMESTRE, como se fosse a do ano;
 *   - chamava de "faltas" as do 1º semestre (Matemática: 16, o total era 22);
 *   - mandava as parciais sem rótulo, e o modelo disse "notas baixas: 0,0 e
 *     4,3" em Português, onde a recuperação (8,8) tinha substituído as duas.
 * ================================================================== */

/* ----------------------------- contrato ---------------------------- */

const Avaliacao = z.object({ sigla: z.string(), valor: z.string() });

const Semestre = z.object({
  /** as avaliações parciais que têm valor lançado (T1, P2, RS...) */
  avaliacoes: z.array(Avaliacao),
  /** null enquanto o semestre não fechou */
  media: z.string().nullable(),
  faltas: z.string().nullable(),
});

const DE_ONDE = ["média final", "média anual", "2º semestre", "1º semestre", "sem média"] as const;

export const Nota = z.object({
  disciplina: z.string(),
  /** a disciplina vem com "*" no boletim: itinerário formativo obrigatório */
  itinerario: z.boolean(),
  /** a média que vale AGORA: a final, senão a anual, senão a do semestre mais recente fechado */
  media: z.string(),
  /** de onde é essa média. Hoje, no meio do ano, costuma ser "1º semestre". */
  mediaDe: z.enum(DE_ONDE),
  /** o total de faltas do ANO (coluna "Total de faltas"), não só de um semestre */
  faltasTotal: z.string(),
  situacao: z.string(),
  semestre1: Semestre,
  semestre2: Semestre,
  mediaAnual: z.string().nullable(),
  recuperacaoFinal: z.string().nullable(),
  mediaFinal: z.string().nullable(),
});
export type Nota = z.infer<typeof Nota>;

export const Saida = z.union([
  z.object({
    formato: z.literal("tabela"),
    notas: z.array(Nota),
    /** a legenda oficial do rodapé do boletim, como a escola escreveu */
    legenda: z.array(z.string()),
  }),
  /**
   * A página não pôde ser lida com segurança (mudou de formato, ou os valores
   * não fazem sentido). Não traz NENHUM valor: só o motivo e os nomes das
   * colunas que apareceram, para quem for consertar.
   */
  z.object({
    formato: z.literal("indisponivel"),
    motivo: z.string(),
    colunasEncontradas: z.array(z.string()),
  }),
]);
export type Saida = z.infer<typeof Saida>;

/* --------------------------- lógica pura --------------------------- */

/** Uma coluna da tabela: o grupo de cima ("1º SEM") e a sigla de baixo ("MED"). */
export interface Coluna {
  grupo: string;
  sigla: string;
}

const PARCIAIS = ["T1", "T2", "SIM", "P1", "P2", "RS", "AJUSTE"];

/**
 * O layout medido em set/2026. É REFERÊNCIA (documentação e testes), não
 * reserva: se o cabeçalho real não bater, a leitura recusa em vez de assumir
 * que as colunas continuam no mesmo lugar. Uma coluna nova no meio deslocaria
 * tudo, e a "média" viraria as faltas sem erro nenhum.
 */
export const LAYOUT_CONHECIDO: Coluna[] = [
  { grupo: "Disciplinas", sigla: "" },
  ...["1º SEM", "2º SEM"].flatMap((grupo) =>
    [...PARCIAIS, "MED", "F"].map((sigla) => ({ grupo, sigla }))
  ),
  { grupo: "MA", sigla: "MED" },
  { grupo: "MA", sigla: "F" },
  { grupo: "RECF", sigla: "REC" },
  { grupo: "RECF", sigla: "Cons.Final" },
  { grupo: "RECF", sigla: "MED" },
  { grupo: "RECF", sigla: "F" },
  { grupo: "MF", sigla: "MED" },
  { grupo: "MF", sigla: "F" },
  { grupo: "Total de faltas", sigla: "" },
  { grupo: "Situação de conclusão na disciplina", sigla: "" },
];

/**
 * Monta os nomes das colunas a partir dos dois níveis do cabeçalho.
 * Célula com rowspan 2 é uma coluna só; com colspan N, pega as N siglas de
 * baixo. Devolve null se o resultado não tiver as colunas que o resto
 * precisa: aí o boletim fica indisponível, com o motivo.
 */
export function colunasDoBoletim(
  grupos: { rotulo: string; colspan: number; rowspan: number }[],
  siglas: string[]
): Coluna[] | null {
  const out: Coluna[] = [];
  let k = 0;
  for (const g of grupos) {
    const rotulo = g.rotulo.replace(/\s+/g, " ").trim();
    if (g.rowspan > 1 || g.colspan <= 1) out.push({ grupo: rotulo, sigla: "" });
    else for (let i = 0; i < g.colspan; i++) out.push({ grupo: rotulo, sigla: (siglas[k++] ?? "").trim() });
  }
  const tem = (grupo: string, sigla: string) => out.some((c) => c.grupo === grupo && c.sigla === sigla);
  const ok = tem("1º SEM", "MED") && tem("2º SEM", "MED") && out.some((c) => /total de faltas/i.test(c.grupo));
  return ok ? out : null;
}

/**
 * Linhas de rodapé (assinatura, legenda) não são disciplina.
 * O limite era 45 caracteres e descartava, sem aviso, "UCC - NEA - Ciências da
 * Natureza e suas Tecnologias *" (53): disciplina de verdade sumia do boletim.
 */
export function ehDisciplina(nome: string): boolean {
  return (
    Boolean(nome) &&
    nome.length <= 60 &&
    !/^disciplinas?$/i.test(nome) &&
    !/^T\d$/i.test(nome) &&
    !/declaro|assinatura|itajai|legenda|recupera|trabalho \d|prova \d|simulado/i.test(nome)
  );
}

/** "-", "--", "*" e vazio: nada lançado, não requer nota, ou dispensado. */
const semValor = (v: string | undefined) => !v || /^(-+|\*)$/.test(v.trim());
const valor = (v: string | undefined) => (semValor(v) ? null : v!.trim());

export function montarNotas(tabela: Linha[], colunas: Coluna[] = LAYOUT_CONHECIDO): Nota[] {
  const indice = (grupo: string, sigla = "") =>
    colunas.findIndex((c) => c.grupo.toLowerCase().startsWith(grupo.toLowerCase()) && c.sigla === sigla);

  return tabela
    .filter((l) => l.length > 3 && ehDisciplina(l[0]))
    .map((l) => {
      const pega = (grupo: string, sigla = "") => {
        const i = indice(grupo, sigla);
        return i < 0 ? undefined : l[i];
      };
      const semestre = (grupo: string) => ({
        avaliacoes: colunas
          .map((c, i) => ({ c, v: l[i] }))
          .filter(({ c, v }) => c.grupo === grupo && c.sigla !== "MED" && c.sigla !== "F" && !semValor(v))
          .map(({ c, v }) => ({ sigla: c.sigla, valor: v!.trim() })),
        media: valor(pega(grupo, "MED")),
        faltas: valor(pega(grupo, "F")),
      });
      const s1 = semestre("1º SEM");
      const s2 = semestre("2º SEM");
      const mediaAnual = valor(pega("MA", "MED"));
      const mediaFinal = valor(pega("MF", "MED"));

      // a média que vale agora: da mais definitiva para a mais parcial
      const [media, mediaDe] = (
        [
          [mediaFinal, "média final"],
          [mediaAnual, "média anual"],
          [s2.media, "2º semestre"],
          [s1.media, "1º semestre"],
        ] as const
      ).find(([m]) => m !== null) ?? ["-", "sem média" as const];

      const nome = l[0].trim();
      return {
        disciplina: nome.replace(/\s*\*$/, ""),
        itinerario: /\*$/.test(nome),
        media: media ?? "-",
        mediaDe,
        faltasTotal: pega("Total de faltas")?.trim() || "-",
        situacao: pega("Situação")?.trim() || "",
        semestre1: s1,
        semestre2: s2,
        mediaAnual,
        recuperacaoFinal: valor(pega("RECF", "REC")),
        mediaFinal,
      };
    });
}

/**
 * A legenda oficial do rodapé, linha a linha. Só o que é definição de sigla
 * ou de símbolo: a linha "Declaro que recebi o boletim de <nome>, matrícula
 * <n>" fica de fora, junto com data e assinatura.
 */
export function extrairLegenda(texto: string): string[] {
  const out: string[] = [];
  for (const bruta of texto.split("\n")) {
    const l = bruta.replace(/\s+/g, " ").trim();
    if (!l || /declaro|assinatura|matr[ií]cula|itaja[ií]|\d{2}\/\d{2}\/\d{4}/i.test(l)) continue;
    // "CE - CONCLUIU COM EXCELÊNCIA CS - CONCLUIU ..." numa linha só: separa
    const conceitos = [...l.matchAll(/\b(CE|CS|CP|NC)\s+-\s+(.+?)(?=\s+\b(?:CE|CS|CP|NC)\s+-|$)/g)];
    if (conceitos.length > 1) {
      for (const [, sigla, significado] of conceitos) out.push(`${sigla} - ${significado.trim()}`);
      continue;
    }
    if (/^(\S{1,10})\s*(=|-)\s+\S/.test(l) || /sinalizadas com \*/i.test(l)) out.push(l);
  }
  return [...new Set(out)];
}

/** Nota de 0 a 10 com vírgula, conceito da legenda, ou "-" (sem média ainda). */
const MEDIA_VALIDA = /^(\d{1,2}([,.]\d{1,2})?|CE|CS|CP|NC|-)$/;
const PARCIAL_VALIDA = /^(\d{1,2}([,.]\d{1,2})?|CE|CS|CP|NC|2CH)$/;
const numero = (v: string) => Number(v.replace(",", "."));

/**
 * Segunda trava, depois do cabeçalho: os VALORES fazem sentido? Se uma coluna
 * deslocar, "16" (faltas) cai no lugar da média, e nota acima de 10 não
 * existe. Pega o deslocamento mesmo quando o cabeçalho parece certo.
 */
export function conferirNotas(notas: Nota[]): string[] {
  if (!notas.length) return ["nenhuma disciplina na tabela"];
  const problemas: string[] = [];
  for (const n of notas) {
    const nota = (v: string) => /^\d/.test(v) && numero(v) > 10;
    if (!MEDIA_VALIDA.test(n.media) || nota(n.media)) problemas.push(`${n.disciplina}: média "${n.media}"`);
    if (!/^(\d{1,3}|-)$/.test(n.faltasTotal)) problemas.push(`${n.disciplina}: faltas "${n.faltasTotal}"`);
    for (const a of [...n.semestre1.avaliacoes, ...n.semestre2.avaliacoes]) {
      if (!PARCIAL_VALIDA.test(a.valor) || nota(a.valor)) problemas.push(`${n.disciplina}: ${a.sigla} "${a.valor}"`);
    }
  }
  return problemas;
}

export interface BoletimLido {
  grupos: { rotulo: string; colspan: number; rowspan: number }[];
  siglas: string[];
  linhas: Linha[];
  rodape: string;
}

/** Só a FORMA do cabeçalho (nomes e mesclas), para a impressão digital. */
export function formaDoBoletim(lida: BoletimLido): string {
  const grupos = lida.grupos.map((g) => `${g.rotulo.replace(/\s+/g, " ").trim()}[${g.colspan}x${g.rowspan}]`);
  return `grupos: ${grupos.join(" | ")}\nsiglas: ${lida.siglas.join(" ")}`;
}

/**
 * Da página lida ao contrato. Pura, para testar sem navegador. Tudo que não
 * dá para ler com segurança vira "indisponivel", nunca um palpite.
 */
export function interpretarBoletim(lida: BoletimLido | null): Saida {
  if (!lida) {
    return { formato: "indisponivel", motivo: "Não encontrei a tabela de notas na página do boletim.", colunasEncontradas: [] };
  }
  const encontradas = lida.grupos.map((g) => g.rotulo.replace(/\s+/g, " ").trim()).filter(Boolean);
  const colunas = colunasDoBoletim(lida.grupos, lida.siglas);
  if (!colunas) {
    return {
      formato: "indisponivel",
      motivo: "O boletim mudou de formato: as colunas não são as que eu sei ler.",
      colunasEncontradas: encontradas,
    };
  }
  const notas = montarNotas(lida.linhas, colunas);
  const problemas = conferirNotas(notas);
  if (problemas.length) {
    return {
      formato: "indisponivel",
      motivo: `O boletim veio com valores que não fazem sentido para a coluna (${problemas.slice(0, 3).join("; ")}).`,
      colunasEncontradas: encontradas,
    };
  }
  return { formato: "tabela", notas, legenda: extrairLegenda(lida.rodape) };
}

/* ---------------------------- a leitura ---------------------------- */

/**
 * Lê a tabela de notas COM os atributos de mescla do cabeçalho (sem eles, não
 * dá para saber que "MED" está debaixo de "1º SEM" ou de "MA") e o texto do
 * rodapé, onde fica a legenda.
 */
async function lerTabelaDoBoletim(alvo: Page): Promise<BoletimLido | null> {
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    for (const f of alvo.frames()) {
      try {
        const r = await f.evaluate(() => {
          // A tabela de notas fica DENTRO de outra (a do cabeçalho da escola): a
          // de fora também contém "1º SEM". Vale a mais interna, sem tabela dentro.
          const t = Array.from(document.querySelectorAll("table")).find(
            (x) => /1º SEM/.test(x.innerText) && /Total de/i.test(x.innerText) && !x.querySelector("table")
          );
          if (!t) return null;
          const trs = Array.from(t.rows);
          // só as células filhas DESTA linha (querySelectorAll pegaria as de tabelas aninhadas)
          const celulas = (tr: HTMLTableRowElement) =>
            Array.from(tr.cells).map((c) => {
              const e = c as HTMLTableCellElement;
              return { rotulo: e.innerText.trim(), colspan: e.colSpan, rowspan: e.rowSpan };
            });
          // a linha de grupos é a que tem uma célula que É "1º SEM"
          const iGrupos = trs.findIndex((tr) => celulas(tr).some((c) => c.rotulo === "1º SEM"));
          return {
            grupos: iGrupos >= 0 ? celulas(trs[iGrupos]) : [],
            siglas: iGrupos >= 0 && trs[iGrupos + 1] ? celulas(trs[iGrupos + 1]).map((c) => c.rotulo) : [],
            linhas: trs.map((tr) => celulas(tr).map((c) => c.rotulo)),
            rodape: document.body.innerText,
          };
        });
        if (r && r.linhas.length > 3) return r;
      } catch {
        /* frame sem acesso, segue */
      }
    }
    await alvo.waitForTimeout(1500);
  }
  return null;
}

/* -------------------------- a capacidade --------------------------- */

const MATERIAS = [
  "matematica", "portugues", "historia", "geografia", "biologia",
  "fisica", "quimica", "ingles", "sociologia", "filosofia", "redacao",
];

export default defineCapacidade({
  nome: "ler_boletim",
  rotulo: "Boletim com as notas",
  fonte: "Portal Activesoft",
  icone: "📊",
  intencao: "notas",
  descricao:
    "o boletim com as NOTAS por disciplina, no Portal Activesoft. Como ler, SEM interpretar alem disto: " +
    '"media" e a media que vale agora e "mediaDe" diz de onde ela e (no meio do ano costuma ser so ' +
    'o "1º semestre"; diga isso, nao chame de media do ano). "faltasTotal" e o total de faltas do ano. ' +
    '"semestre1"/"semestre2" trazem as avaliacoes parciais com a sigla: uma parcial baixa ou 0,0 pode ' +
    "ter sido substituida pela recuperacao e nao diz, sozinha, que a aluna vai mal; para dizer se ela " +
    "vai bem ou mal use so a media. Toda vez que citar uma parcial, diga qual e SEMPRE junto a media da " +
    'mesma disciplina (ex.: "T2 do 1º semestre: 0,0, mas a media de Portugues ficou 5,8"), no texto e ' +
    "nos itens. " +
    'Siglas e conceitos (CE, CS, CP, NC): use a "legenda", que e a oficial da escola; sigla fora da ' +
    "legenda (como RS ou AJUSTE), cite como esta, sem dizer o que significa. Nunca diga que a aluna foi " +
    "aprovada ou reprovada, nem qual e a media minima: isso nao esta nos dados. " +
    'Se o formato vier "indisponivel", diga que nao conseguiu ler o boletim com seguranca e o ' +
    "motivo, e NAO cite nenhuma nota.",
  entrada: z.object({}),
  saida: Saida,

  async ler(_args, passo, estrutura) {
    const alvo = await abrirPortal(passo);
    passo("Abrindo o boletim");
    await irParaItemDoMenu(alvo, /boletim/, passo);

    passo("Lendo as notas");
    await clicarBuscar(alvo);
    // Sem a tabela, antes caía no texto cru da página: nome, nascimento e
    // filiação da aluna iam para o modelo. Agora vira "indisponível".
    //
    // A tabela às vezes aparece desenhada pela metade, com valores ainda
    // vazios. Relê algumas vezes antes de desistir: página carregando se
    // resolve na segunda leitura, formato novo continua recusado.
    let lida = await lerTabelaDoBoletim(alvo);
    let r = interpretarBoletim(lida);
    for (let tentativa = 2; r.formato === "indisponivel" && tentativa <= 3; tentativa++) {
      passo(`A tabela não parecia pronta; lendo de novo (${tentativa}ª vez)`);
      await alvo.waitForTimeout(2000);
      lida = await lerTabelaDoBoletim(alvo);
      r = interpretarBoletim(lida);
    }
    await alvo.close().catch(() => {});
    if (lida) estrutura?.(formaDoBoletim(lida));
    if (r.formato === "indisponivel") passo(`Aviso: ${r.motivo}`);
    return r;
  },

  resumir: (d) => (d.formato === "tabela" ? `${d.notas.length} disciplinas` : "não deu para ler com segurança"),

  local: {
    sinais: { forte: /nota|boletim|media|reprov|passei|desempenho|como (vou|estou)|preocupar/ },
    raciocinio: "Vou abrir o boletim no Portal do Aluno e olhar as notas.",
    responder(pergunta, d) {
      if (d.formato !== "tabela") return { resposta: `Abri o boletim, mas não consigo lê-lo com segurança. ${d.motivo}`, itens: [] };
      if (!d.notas.length) return { resposta: "Abri o boletim, mas não consegui ler a tabela agora.", itens: [] };
      const t = semAcento(pergunta);
      const alvo = MATERIAS.find((m) => t.includes(m.slice(0, 5)));
      const linhas = alvo
        ? d.notas.filter((n) => semAcento(n.disciplina).includes(alvo.slice(0, 5)))
        : d.notas;
      const de = linhas[0]?.mediaDe;
      const mesma = de && de !== "sem média" && linhas.every((n) => n.mediaDe === de);
      const origem = !mesma ? "" : de.includes("semestre") ? ` (médias do ${de})` : ` (${de})`;
      return {
        resposta: alvo
          ? `Aqui está o que encontrei no seu boletim para ${alvo}${origem}.`
          : `Peguei seu boletim. Essas são as médias por disciplina${origem}.`,
        itens: linhas.slice(0, 8).map((n) => ({ rotulo: n.disciplina, valor: n.media })),
      };
    },
  },
});
