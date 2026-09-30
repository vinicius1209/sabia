/**
 * Quem é a dona da conta. Vem do `.env` (fora do git), para o código público
 * não carregar nome de aluna nem de escola.
 *
 * Lido na hora de usar, e não no import: o server carrega o `.env` depois que
 * os módulos já foram importados.
 */
export function perfil() {
  const aluno = process.env.ALUNO_NOME?.trim() || "";
  const serie = process.env.ALUNO_SERIE?.trim() || "";
  const escola = process.env.ESCOLA_NOME?.trim() || "";
  return { aluno, serie, escola, iniciais: iniciais(aluno) };
}

/** "Ana Beatriz" vira "AB"; sem nome, fica "EU". */
export function iniciais(nome: string): string {
  const partes = nome.split(/\s+/).filter(Boolean);
  if (!partes.length) return "EU";
  return partes
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

/** A frase de apresentação que abre o prompt do agente. */
export function quemAtende(): string {
  const { aluno, serie, escola } = perfil();
  const quem = aluno || "uma aluna";
  const onde = [serie && `do ${serie}`, escola && `do ${escola}`].filter(Boolean).join(" ");
  return `Voce e o assistente escolar de ${quem}${onde ? `, aluna ${onde}` : ""}.`;
}
