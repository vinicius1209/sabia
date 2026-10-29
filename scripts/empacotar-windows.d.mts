/** Tipos para o empacotador de Windows em .mjs. */

/**
 * O texto do .bat que sobe o Sabiá portátil, por motor de IA.
 * O teste confere este texto; o resto do empacotador só roda no Windows.
 */
export function conteudoBat(provedor: "deepseek" | "local"): string;
