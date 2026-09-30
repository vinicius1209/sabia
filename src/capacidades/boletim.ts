import { z } from "zod";
import { defineCapacidade } from "./tipos.ts";
import { abrirPortal, irParaItemDoMenu, lerTabelas, clicarBuscar } from "./_portal.ts";
import { semAcento, type Linha } from "../util.ts";

/* ----------------------------- contrato ---------------------------- */

export const Saida = z.union([
  z.object({ formato: z.literal("texto"), conteudo: z.string() }),
  z.object({
    formato: z.literal("tabela"),
    notas: z.array(
      z.object({
        disciplina: z.string(),
        media: z.string(),
        faltas: z.string(),
        valores: z.array(z.string()),
      })
    ),
  }),
]);

/* --------------------------- lógica pura --------------------------- */

/**
 * Onde fica a MED (média do 1º semestre) dentro dos valores da linha.
 * Colunas: T1,T2,SIM,P1,P2,RS,AJUSTE,MED,F e depois repetem para o 2º semestre.
 * Pegar "o primeiro número" dava a nota de um trabalho; "o último" pegava uma
 * prova solta do 2º semestre (Física aparecia 6,0 em vez de 8,5).
 */
export function offsetDaMedia(tabela: Linha[]): number {
  for (const linha of tabela) {
    const t1 = linha.findIndex((c) => /^T1$/i.test(c));
    if (t1 < 0) continue;
    const med = linha.findIndex((c, i) => i > t1 && /^MED$/i.test(c));
    if (med > t1) return med - t1;
  }
  return 7; // layout padrão do Activesoft
}

/** Linhas de rodapé (assinatura, legenda) não são disciplina. */
export function ehDisciplina(nome: string): boolean {
  return (
    Boolean(nome) &&
    nome.length <= 45 &&
    !/^disciplinas?$/i.test(nome) &&
    !/^T\d$/i.test(nome) &&
    !/declaro|assinatura|itajai|legenda|recupera|trabalho \d|prova \d|simulado/i.test(nome)
  );
}

export function montarNotas(tabela: Linha[]) {
  const off = offsetDaMedia(tabela);
  return tabela
    .filter((l) => l.length > 3 && ehDisciplina(l[0]))
    .map((l) => {
      const valores = l.slice(1);
      return {
        disciplina: l[0],
        media: valores[off] ?? "-",
        faltas: valores[off + 1] ?? "-",
        valores,
      };
    });
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
  descricao: "o boletim com as NOTAS por disciplina, no Portal Activesoft.",
  entrada: z.object({}),
  saida: Saida,

  async ler(_args, passo) {
    const alvo = await abrirPortal(passo);
    passo("Abrindo o boletim");
    await irParaItemDoMenu(alvo, /boletim/, passo);

    passo("Lendo as notas");
    await clicarBuscar(alvo);
    const tabelas = await lerTabelas(alvo);

    // a de notas é a que tem mais linhas; a outra é o cabeçalho da escola
    const maior = tabelas.sort((a, b) => b.length - a.length)[0];
    if (!maior) {
      const texto = await alvo.evaluate(() => document.body.innerText.slice(0, 4000));
      await alvo.close().catch(() => {});
      return { formato: "texto" as const, conteudo: String(texto) };
    }
    await alvo.close().catch(() => {});
    return { formato: "tabela" as const, notas: montarNotas(maior) };
  },

  resumir: (d) => (d.formato === "tabela" ? `${d.notas.length} disciplinas` : "boletim em texto"),

  local: {
    sinais: { forte: /nota|boletim|media|reprov|passei|desempenho|como (vou|estou)|preocupar/ },
    intencao: "notas",
    raciocinio: "Vou abrir o boletim no Portal do Aluno e olhar as notas.",
    responder(pergunta, d) {
      if (d.formato !== "tabela" || !d.notas.length) {
        return { resposta: "Abri o boletim, mas não consegui ler a tabela agora.", itens: [] };
      }
      const t = semAcento(pergunta);
      const alvo = MATERIAS.find((m) => t.includes(m.slice(0, 5)));
      const linhas = alvo
        ? d.notas.filter((n) => semAcento(n.disciplina).includes(alvo.slice(0, 5)))
        : d.notas;
      return {
        resposta: alvo
          ? `Aqui está o que encontrei no seu boletim para ${alvo}.`
          : "Peguei seu boletim. Essas são as notas por disciplina.",
        itens: linhas.slice(0, 8).map((n) => ({ rotulo: n.disciplina, valor: n.media })),
      };
    },
  },
});
