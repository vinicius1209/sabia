import { z } from "zod";
import type { Capacidade, ItemResposta } from "./capacidade.ts";
import { semAcento, type Passo } from "./texto.ts";

/* ==================================================================
 * O REGISTRO.
 *
 * O pacote do agente entrega a lista de capacidades, e daqui sai todo o
 * resto: o enum de ferramentas que o modelo pode pedir, os contratos do
 * plano e da resposta, a descrição que o modelo lê, a execução com
 * validação nas duas pontas, os cartões da tela e o plano B sem IA.
 *
 * Adicionar uma capacidade = criar o arquivo dela e pôr na lista do
 * pacote. Nada aqui muda.
 * ================================================================== */

/** Limpa caracteres de controle que o modelo às vezes emite no meio da frase
 *  e que quebram o JSON da resposta HTTP.
 *
 *  Não dá para fazer isso com `.transform()` do Zod: o schema também vira
 *  JSON Schema para o modelo, e transform não tem representação lá
 *  ("Transforms cannot be represented in JSON Schema"). Então o schema fica
 *  puro e a limpeza acontece depois do parse. */
export function limparTexto(s: string): string {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029]/g, " ").trim();
}

export const ItemRespostaSchema = z.object({
  rotulo: z.string(),
  valor: z.string(),
});

export function criarRegistro(capacidades: readonly Capacidade[]) {
  if (!capacidades.length) throw new Error("Um agente precisa de pelo menos uma capacidade.");

  const nomes = capacidades.map((c) => c.nome) as [string, ...string[]];
  const repetido = nomes.find((n, i) => nomes.indexOf(n) !== i);
  if (repetido) throw new Error(`Capacidade registrada duas vezes: ${repetido}`);

  const intencoes = [...new Set([...capacidades.map((c) => c.intencao), "conversa"])] as [
    string,
    ...string[],
  ];
  const fontes = [...new Set([...capacidades.map((c) => c.fonte), "nenhuma"])] as [
    string,
    ...string[],
  ];

  /** As únicas ferramentas que existem. O modelo não pode inventar outra. */
  const NomeFerramenta = z.enum(nomes);

  /**
   * Uma chamada de ferramenta no plano: o nome E os argumentos daquela
   * ferramenta, validados pelo contrato dela.
   *
   * Antes o plano era só uma lista de nomes e o agente sempre chamava com
   * `{}`. Resultado: o diário aceitava uma data, mas nada conseguia passar
   * essa data, e "tarefa de segunda" sempre lia o dia de hoje.
   */
  const chamadas = capacidades.map((c) => z.object({ nome: z.literal(c.nome), args: c.entrada }));
  const ChamadaFerramenta = z.discriminatedUnion(
    "nome",
    chamadas as unknown as [(typeof chamadas)[number], ...(typeof chamadas)[number][]]
  );

  /* FASE 1: o plano */
  const Plano = z.object({
    intencao: z.enum(intencoes).describe("O assunto da pergunta"),
    // "mensagem", e não "raciocinio": o filtro de segurança do Claude às vezes
    // recusava um campo com esse nome, lendo como tentativa de extrair o
    // raciocínio interno do modelo. É só uma frase de status para a tela.
    mensagem: z
      .string()
      .describe("Uma frase curta, em pt-BR, para mostrar na tela o que você vai consultar"),
    ferramentas: z
      .array(ChamadaFerramenta)
      .describe(
        "Quais fontes consultar, NA ORDEM, com os argumentos de cada uma. Vazio se for só conversa"
      ),
  });

  /* FASE 3: a resposta. "resposta" vem primeiro de propósito: é o campo que
     aparece na tela enquanto o modelo ainda está escrevendo o resto. */
  const Resposta = z.object({
    resposta: z.string().describe("A resposta em pt-BR, curta e direta"),
    itens: z
      .array(ItemRespostaSchema)
      .describe("Dados em destaque para virar cartão na tela. Vazio se não couber"),
    fonte: z.enum(fontes).describe("De onde veio a informação"),
  });

  function capacidade(nome: string): Capacidade {
    const c = capacidades.find((x) => x.nome === nome);
    if (!c) throw new Error(`Capacidade desconhecida: ${nome}`);
    return c;
  }

  /**
   * Argumentos "tudo nulo" de uma capacidade: o padrão de cada uma.
   * O plano B, sem modelo, usa isto porque não sabe extrair parâmetros.
   */
  function argsPadrao(nome: string): Record<string, null> {
    const forma =
      (capacidade(nome).entrada as unknown as { shape?: Record<string, unknown> }).shape ?? {};
    return Object.fromEntries(Object.keys(forma).map((k) => [k, null]));
  }

  /** Resumo de uma linha para o cartão. Nunca derruba o fluxo. */
  function resumir(nome: string, dados: unknown): string {
    const c = capacidade(nome);
    const ok = c.saida.safeParse(dados);
    if (!ok.success) return "leitura concluída";
    try {
      return c.resumir(ok.data);
    } catch {
      return "leitura concluída";
    }
  }

  /** Metadados que a tela usa nos cartões de ferramenta. */
  function metadados(nome: string) {
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
  function descricaoDasFontes(): string {
    return capacidades.map((c) => `- ${c.nome}: ${c.descricao}`).join("\n");
  }

  /**
   * Executa uma capacidade com o contrato aplicado nas duas pontas:
   * entrada validada antes de virar ação, saída validada antes de voltar
   * para o modelo.
   */
  async function executar(
    nome: string,
    argsBrutos: unknown,
    passo: Passo,
    estrutura?: (descricao: string) => void
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

    const bruto = await c.ler(entrada.data, passo, estrutura);

    // Fora do contrato, o dado NÃO chega ao modelo. Antes ele seguia com um
    // aviso no painel, e o modelo respondia em cima de um dado torto com a
    // mesma certeza de sempre. Melhor a ferramenta falhar e a resposta dizer
    // que não conseguiu ler.
    const saida = c.saida.safeParse(bruto);
    if (!saida.success) {
      throw new Error(
        `${c.rotulo} veio num formato que eu não reconheço. Não vou usar, para não responder errado.`
      );
    }
    return saida.data;
  }

  /**
   * Qual capacidade responde esta pergunta, sem modelo nenhum.
   * Pontua cada uma pelos sinais e fica com a maior. Empate: ordem do registro.
   */
  function escolherLocal(pergunta: string): Capacidade | null {
    const t = semAcento(pergunta);
    let melhor: Capacidade | null = null;
    let pontos = 0;
    for (const c of capacidades) {
      if (!c.local) continue;
      const p = (c.local.sinais.forte.test(t) ? 2 : 0) + (c.local.sinais.fraco?.test(t) ? 1 : 0);
      if (p > pontos) {
        melhor = c;
        pontos = p;
      }
    }
    return melhor;
  }

  function responderLocal(
    nome: string,
    pergunta: string,
    dados: unknown
  ): { resposta: string; itens: ItemResposta[] } {
    const c = capacidade(nome);
    if (!c.local) return { resposta: "Não sei responder isso sem IA.", itens: [] };
    return c.local.responder(pergunta, dados);
  }

  function limparResposta(r: Resposta): Resposta {
    return {
      ...r,
      resposta: limparTexto(r.resposta),
      itens: r.itens.map((i) => ({ rotulo: limparTexto(i.rotulo), valor: limparTexto(i.valor) })),
    };
  }

  return {
    capacidades,
    intencoes,
    fontes,
    NomeFerramenta,
    ChamadaFerramenta,
    Plano,
    Resposta,
    capacidade,
    argsPadrao,
    resumir,
    metadados,
    descricaoDasFontes,
    executar,
    escolherLocal,
    responderLocal,
    limparResposta,
  };
}

export type Registro = ReturnType<typeof criarRegistro>;

/** Os formatos do plano e da resposta, iguais para qualquer pacote. */
export interface Plano {
  intencao: string;
  mensagem: string;
  ferramentas: { nome: string; args: unknown }[];
}
export interface Resposta {
  resposta: string;
  itens: ItemResposta[];
  fonte: string;
}
