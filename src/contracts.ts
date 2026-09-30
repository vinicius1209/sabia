import { z } from "zod";
import { NomeFerramenta, ChamadaFerramenta, INTENCOES } from "./capacidades/index.ts";

/* ==================================================================
 * Contratos das FASES do agente (plano e resposta).
 *
 * O contrato de cada FERRAMENTA nao mora mais aqui: vive junto da
 * capacidade, em src/capacidades/<nome>.ts. Aqui fica so o que e do
 * agente em si.
 * ================================================================== */

export { NomeFerramenta, ChamadaFerramenta };
export type NomeFerramenta = z.infer<typeof NomeFerramenta>;

/* ------------------------- FASE 1: o plano ------------------------ */

export const Plano = z.object({
  intencao: z
    .enum(INTENCOES as [string, ...string[]])
    .describe("O que a aluna quer saber"),
  raciocinio: z
    .string()
    .describe("Uma frase curta, em pt-BR, explicando o que voce vai fazer"),
  ferramentas: z
    .array(ChamadaFerramenta)
    .describe("Quais fontes consultar, NA ORDEM, com os argumentos de cada uma. Vazio se for so conversa"),
});
export type Plano = z.infer<typeof Plano>;

/* ---------------------- FASE 3: a resposta ------------------------ */

export const ItemResposta = z.object({
  rotulo: z.string(),
  valor: z.string(),
});
export type ItemResposta = z.infer<typeof ItemResposta>;

export const Resposta = z.object({
  resposta: z.string().describe("A resposta em pt-BR, curta e direta"),
  itens: z
    .array(ItemResposta)
    .describe("Dados em destaque para virar cartao na tela. Vazio se nao couber"),
  fonte: z
    .enum(["ClassApp", "Portal Activesoft", "nenhuma"])
    .describe("De onde veio a informacao"),
});
export type Resposta = z.infer<typeof Resposta>;

/** Limpa caracteres de controle que o modelo as vezes emite no meio da frase
 *  e que quebram o JSON da resposta HTTP.
 *
 *  Nao da para fazer isso com `.transform()` do Zod: o schema tambem vira
 *  JSON Schema para o modelo, e transform nao tem representacao la
 *  ("Transforms cannot be represented in JSON Schema"). Entao o schema fica
 *  puro e a limpeza acontece depois do parse. */
export function limparTexto(s: string): string {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029]/g, " ").trim();
}

export function limparResposta(r: Resposta): Resposta {
  return {
    ...r,
    resposta: limparTexto(r.resposta),
    itens: r.itens.map((i) => ({ rotulo: limparTexto(i.rotulo), valor: limparTexto(i.valor) })),
  };
}
