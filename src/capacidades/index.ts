import { z } from "zod";
import type { Capacidade, Intencao, ItemResposta } from "./tipos.ts";
import { semAcento, type Passo } from "../util.ts";

import comunicados from "./comunicados.ts";
import calendario from "./calendario.ts";
import boletim from "./boletim.ts";
import horarios from "./horarios.ts";
import diario from "./diario.ts";

/* ==================================================================
 * O REGISTRO.
 *
 * Adicionar uma capacidade = criar o arquivo dela e acrescentar UMA
 * linha aqui. Todo o resto (o enum que o modelo pode pedir, a descrição
 * que ele lê, o catálogo de execução, os cartões da tela e o plano B
 * sem IA) é derivado desta lista.
 * ================================================================== */

export const CAPACIDADES = [comunicados, calendario, boletim, horarios, diario] as const;

export type NomeCapacidade = (typeof CAPACIDADES)[number]["nome"];

const nomes = CAPACIDADES.map((c) => c.nome) as [NomeCapacidade, ...NomeCapacidade[]];

/** As únicas ferramentas que existem. O modelo não pode inventar outra. */
export const NomeFerramenta = z.enum(nomes);

/**
 * Uma chamada de ferramenta no plano: o nome E os argumentos daquela
 * ferramenta, validados pelo contrato dela.
 *
 * Antes o plano era só uma lista de nomes e o agente sempre chamava com
 * `{}`. Resultado: o diário aceitava uma data, mas nada conseguia passar
 * essa data, e "tarefa de segunda" sempre lia o dia de hoje.
 */
const chamadas = CAPACIDADES.map((c) =>
  z.object({ nome: z.literal(c.nome), args: c.entrada })
);
export const ChamadaFerramenta = z.discriminatedUnion(
  "nome",
  chamadas as unknown as [(typeof chamadas)[number], ...(typeof chamadas)[number][]]
);
export type ChamadaFerramenta = z.infer<typeof ChamadaFerramenta>;

/**
 * Argumentos "tudo nulo" de uma capacidade: o padrão de cada uma.
 * O plano B, sem modelo, usa isto porque não sabe extrair parâmetros.
 */
export function argsPadrao(nome: NomeCapacidade): Record<string, null> {
  const forma = (capacidade(nome).entrada as unknown as { shape?: Record<string, unknown> }).shape ?? {};
  return Object.fromEntries(Object.keys(forma).map((k) => [k, null]));
}

/** Busca pelo nome, já tipada. */
export function capacidade(nome: NomeCapacidade): Capacidade {
  const c = CAPACIDADES.find((x) => x.nome === nome);
  if (!c) throw new Error(`Capacidade desconhecida: ${nome}`);
  return c as Capacidade;
}

/** Resumo de uma linha para o cartão. Nunca derruba o fluxo. */
export function resumir(nome: NomeCapacidade, dados: unknown): string {
  const c = capacidade(nome);
  const ok = c.saida.safeParse(dados);
  if (!ok.success) return "leitura concluída";
  try { return c.resumir(ok.data); } catch { return "leitura concluída"; }
}

/** Metadados que a tela usa nos cartões de ferramenta. */
export function metadados(nome: NomeCapacidade) {
  const c = capacidade(nome);
  return { nome: c.nome, rotulo: c.rotulo, fonte: c.fonte, icone: c.icone };
}

/**
 * O trecho do prompt que descreve as fontes.
 *
 * Gerado a partir das capacidades, de propósito: antes essa lista era texto
 * solto no papel do agente, e dava para registrar uma ferramenta e esquecer
 * de descrevê-la. Aí ela existia e o modelo nunca escolhia.
 */
export function descricaoDasFontes(): string {
  return CAPACIDADES.map((c) => `- ${c.nome}: ${c.descricao}`).join("\n");
}

/**
 * Executa uma capacidade com o contrato aplicado nas duas pontas:
 * entrada validada antes de virar ação, saída validada antes de voltar
 * para o modelo.
 */
export async function executar(
  nome: NomeCapacidade,
  argsBrutos: unknown,
  passo: Passo
): Promise<unknown> {
  const c = capacidade(nome);

  // Parâmetro ausente vira o padrão (nulo). As entradas são .nullable() e não
  // .optional(), porque o modo estrito da OpenAI recusa opcional; sem este
  // preenchimento, chamar com {} passou a falhar ("data" é obrigatório).
  const comPadrao = { ...argsPadrao(nome), ...((argsBrutos as object | null) ?? {}) };
  const entrada = c.entrada.safeParse(comPadrao);
  if (!entrada.success) {
    throw new Error(`Argumentos invalidos para ${nome}: ${entrada.error.message}`);
  }

  const bruto = await c.ler(entrada.data, passo);

  const saida = c.saida.safeParse(bruto);
  if (!saida.success) {
    // não derruba a demo: devolve o que veio, mas avisa no painel
    passo(`Aviso: ${nome} veio num formato inesperado`);
    return bruto;
  }
  return saida.data;
}

/* ------------------------- plano B, sem IA ------------------------- */

/**
 * Qual capacidade responde esta pergunta, sem modelo nenhum.
 * Pontua cada uma pelos sinais e fica com a maior. Empate: ordem do registro.
 */
export function escolherLocal(pergunta: string) {
  const t = semAcento(pergunta);
  let melhor: (typeof CAPACIDADES)[number] | null = null;
  let pontos = 0;
  for (const c of CAPACIDADES) {
    if (!c.local) continue;
    const p =
      (c.local.sinais.forte.test(t) ? 2 : 0) + (c.local.sinais.fraco?.test(t) ? 1 : 0);
    if (p > pontos) { melhor = c; pontos = p; }
  }
  return melhor;
}

export function responderLocal(
  nome: NomeCapacidade,
  pergunta: string,
  dados: unknown
): { resposta: string; itens: ItemResposta[] } {
  const c = capacidade(nome);
  if (!c.local) return { resposta: "Não sei responder isso sem IA.", itens: [] };
  return c.local.responder(pergunta, dados);
}

export const INTENCOES: Intencao[] = [
  "notas",
  "provas",
  "avisos",
  "horarios",
  "tarefas",
  "conversa",
];
