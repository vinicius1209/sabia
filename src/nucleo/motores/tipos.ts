import type { Entrada } from "../prompt.ts";
import type { Plano, Registro, Resposta } from "../registro.ts";

/** Um motor sabe fazer as duas fases criativas, e só isso. */
export interface Motor {
  nome: string;
  plano(entrada: Entrada): Promise<Plano>;
  /**
   * `aoEscrever` recebe o texto da resposta até onde o modelo já escreveu.
   * Motor que não transmite aos pedaços simplesmente não chama.
   */
  resposta(entrada: Entrada, aoEscrever?: (parcial: string) => void): Promise<Resposta>;
}

/** O que todo motor recebe para montar as chamadas. */
export interface DepsDoMotor {
  /** o prompt de sistema, lido na hora (a config pode ter mudado) */
  sistema: () => string;
  registro: Registro;
}

/**
 * Lê o valor de um campo de texto num JSON que ainda está chegando.
 *
 *   extrairParcial('{"resposta":"Sua nota em Fí', "resposta") === "Sua nota em Fí"
 *
 * Os modelos devolvem a resposta como JSON estruturado, e o JSON só fica
 * válido no fim. Sem isto a tela ficaria parada até a última chave fechar.
 * Um escape cortado no meio ("\u00e") fica de fora até completar.
 */
export function extrairParcial(json: string, campo: string): string | null {
  const m = new RegExp(`"${campo}"\\s*:\\s*"`).exec(json);
  if (!m) return null;
  let i = m.index + m[0].length;
  let out = "";
  while (i < json.length) {
    const c = json[i];
    if (c === '"') return out;
    if (c !== "\\") {
      out += c;
      i++;
      continue;
    }
    const prox = json[i + 1];
    if (prox === undefined) break;
    if (prox === "u") {
      const hex = json.slice(i + 2, i + 6);
      if (hex.length < 4) break;
      out += String.fromCharCode(parseInt(hex, 16));
      i += 6;
      continue;
    }
    const mapa: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f" };
    out += mapa[prox] ?? prox;
    i += 2;
  }
  return out;
}
