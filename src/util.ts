/** Helpers de texto usados por mais de uma capacidade. */

/** tira acento e caixa, para "fisica" casar com "Física" */
export const semAcento = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** celula vazia nas tabelas do Activesoft ("---", "--", vazio) */
export const celulaVazia = (c: string): boolean => !c || /^-+$/.test(c.trim());

export type Linha = string[];
export type Passo = (mensagem: string) => void;
