/** Helpers das telas do Activesoft, usados por mais de uma capacidade. */

/** celula vazia nas tabelas do Activesoft ("---", "--", vazio) */
export const celulaVazia = (c: string): boolean => !c || /^-+$/.test(c.trim());

export type Linha = string[];
