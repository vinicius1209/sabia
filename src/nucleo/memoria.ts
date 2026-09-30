/* ==================================================================
 * A memória da conversa que vai para o modelo.
 *
 * Os princípios vêm do Frota (docs/context-handoff.md no mycockpit):
 *   - a memória é do app, não do modelo: trocar de motor no meio da
 *     conversa não perde nada, porque nenhuma sessão nativa guarda nada;
 *   - orçamento, não despejo: as últimas trocas literais, as antigas em
 *     uma linha, dentro de um teto, e um aviso explícito quando corta;
 *   - o pedido atual nunca é cortado (ele fica fora daqui, no fim do prompt).
 *
 * E um princípio do Sabiá: o dado lido AGORA vence a memória. A memória
 * serve para entender "essa matéria" e "dela", não para substituir a fonte.
 * Por isso os dados brutos das leituras antigas não voltam: só o que foi
 * respondido.
 * ================================================================== */

export interface Troca {
  pergunta: string;
  /** o assunto que o plano deu à pergunta ("notas") */
  intencao: string;
  /** o que o agente respondeu; vazio se aquela pergunta deu erro */
  resposta: string;
  itens: { rotulo: string; valor: string }[];
  /** ISO: quando foi */
  quando: string;
  /** a pergunta terminou em erro (ex.: fonte indisponível) */
  erro?: string;
}

/** o piso de memória do Frota: cabe folgado em qualquer motor */
export const ORCAMENTO_DA_MEMORIA = 6000;
/** quantas trocas vão por inteiro; as mais antigas vão em uma linha */
export const TROCAS_LITERAIS = 3;

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

const cortar = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`);

/** a primeira frase da resposta, para as trocas antigas */
const primeiraFrase = (s: string) => cortar(s.split(/(?<=[.!?])\s/)[0] ?? s, 160);

function literal(t: Troca): string {
  const partes = [`[${hora(t.quando)}] Pergunta: "${cortar(t.pergunta, 400)}" (assunto: ${t.intencao})`];
  if (t.erro) partes.push(`Nao consegui responder: ${cortar(t.erro, 200)}`);
  else {
    partes.push(`Voce respondeu: ${cortar(t.resposta, 900)}`);
    if (t.itens.length) {
      partes.push(`Destaques: ${cortar(t.itens.map((i) => `${i.rotulo}: ${i.valor}`).join("; "), 500)}`);
    }
  }
  return partes.join("\n");
}

function resumida(t: Troca): string {
  return `- [${hora(t.quando)}] "${cortar(t.pergunta, 120)}" → ${t.erro ? "nao consegui responder" : primeiraFrase(t.resposta)}`;
}

/**
 * O bloco "conversa até agora" do prompt. Nunca passa de `orcamento`
 * caracteres; quando algo fica de fora, diz quanto.
 */
export function montarMemoria(trocas: Troca[], orcamento = ORCAMENTO_DA_MEMORIA): string {
  if (!trocas.length) return "";
  const literais = trocas.slice(-TROCAS_LITERAIS);
  const antigas = trocas.slice(0, -TROCAS_LITERAIS);

  // as literais primeiro (as mais recentes valem mais), de trás para frente;
  // a que não couber inteira desce para uma linha, junto das antigas
  const blocosLiterais: string[] = [];
  let usado = 0;
  for (let i = literais.length - 1; i >= 0; i--) {
    const b = literal(literais[i]);
    if (usado + b.length > orcamento * 0.8) {
      antigas.push(...literais.slice(0, i + 1));
      break;
    }
    blocosLiterais.unshift(b);
    usado += b.length + 2;
  }

  // as antigas em uma linha, também das mais recentes para as mais antigas
  const linhas: string[] = [];
  for (const t of [...antigas].reverse()) {
    const l = resumida(t);
    if (usado + l.length > orcamento - 120) break;
    linhas.unshift(l);
    usado += l.length + 1;
  }
  const omitidas = antigas.length - linhas.length;

  const partes: string[] = [];
  if (omitidas > 0) partes.push(`[${omitidas} troca(s) mais antiga(s) desta conversa ficaram de fora]`);
  if (linhas.length) partes.push(`Antes:\n${linhas.join("\n")}`);
  if (blocosLiterais.length) partes.push(blocosLiterais.join("\n\n"));
  return partes.join("\n\n");
}
