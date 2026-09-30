import type { z } from "zod";
import type { Passo } from "../util.ts";

export type Fonte = "ClassApp" | "Portal Activesoft";
export type Intencao = "notas" | "provas" | "avisos" | "horarios" | "tarefas" | "conversa";

export interface ItemResposta {
  rotulo: string;
  valor: string;
}

/** O que o motor local (plano B, sem IA) precisa saber sobre a capacidade. */
export interface PlanoBLocal<S> {
  /**
   * Palavras que indicam esta capacidade, testadas na pergunta JÁ SEM ACENTO.
   * Forte vale 2 pontos, fraco vale 1; ganha a capacidade com mais pontos.
   *
   * Antes era "o primeiro regex que casar ganha", na ordem da lista. Aí
   * "teve tarefa na aula de hoje?" caía no quadro de horários só porque
   * tinha a palavra "aula" e horários vinha antes do diário.
   */
  sinais: { forte: RegExp; fraco?: RegExp };
  intencao: Intencao;
  raciocinio: string;
  responder(
    pergunta: string,
    dados: S
  ): { resposta: string; itens: ItemResposta[] };
}

/**
 * Uma capacidade do agente, declarada num lugar só.
 *
 * Antes isso vivia espalhado em 7 arquivos, e era fácil registrar a ferramenta
 * e esquecer de descrevê-la para o modelo (aí ela existia mas nunca era usada).
 * Aqui, tudo que define a capacidade mora junto: o contrato, como ela é
 * descrita ao modelo, como ela lê, e o que o plano B faz sem IA.
 */
export interface Capacidade<
  Nome extends string = string,
  E extends z.ZodTypeAny = z.ZodTypeAny,
  S extends z.ZodTypeAny = z.ZodTypeAny,
> {
  nome: Nome;
  /** rótulo do cartão na tela */
  rotulo: string;
  fonte: Fonte;
  /** emoji do cartão na tela */
  icone: string;
  /** a frase que o modelo lê para decidir se usa esta capacidade */
  descricao: string;
  entrada: E;
  saida: S;
  /** a navegação de verdade */
  ler(args: z.infer<E>, passo: Passo): Promise<z.infer<S>>;
  /**
   * Uma linha para o cartão da tela ("12 comunicados lidos").
   * Obrigatório: antes isso ficava no agent.ts com os nomes escritos à mão,
   * e capacidade nova aparecia na tela só como "ok".
   */
  resumir(dados: z.infer<S>): string;
  /** opcional: como o motor sem IA responde */
  local?: PlanoBLocal<z.infer<S>>;
}

/** Ajuda o TypeScript a manter os literais ao declarar uma capacidade. */
export function defineCapacidade<
  Nome extends string,
  E extends z.ZodTypeAny,
  S extends z.ZodTypeAny,
>(c: Capacidade<Nome, E, S>): Capacidade<Nome, E, S> {
  return c;
}
