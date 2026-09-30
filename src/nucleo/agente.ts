import type { Motor } from "./motores/index.ts";
import type { EventoDoTurno } from "./protocolo.ts";
import type { Plano, Registro, Resposta } from "./registro.ts";
import type { Troca } from "./memoria.ts";
import type { Passo } from "./texto.ts";

/* ==================================================================
 * O laço do agente, em 3 fases determinísticas:
 *
 *   1. PLANEJAR  o modelo devolve um Plano validado (intenção +
 *                mensagem + ferramentas NA ORDEM)
 *   2. EXECUTAR  o código executa as ferramentas nessa ordem. O modelo
 *                não toca no navegador, só escolhe o que consultar.
 *   3. RESPONDER o modelo recebe os dados e devolve uma Resposta
 *                validada (texto + itens para a tela + fonte)
 *
 * Toda fronteira com o modelo passa por Zod. Se vier algo fora do
 * contrato, quebra aqui e não vira ação.
 *
 * O laço não guarda estado: o histórico da conversa chega de fora
 * (do arquivo da conversa), então sobrevive a reiniciar o servidor.
 * ================================================================== */

export type Emitir = (e: EventoDoTurno) => void;

/**
 * Pergunta sobre um assunto que tem fonte (notas, provas...), mas o plano não
 * pediu leitura nenhuma: o código acrescenta a leitura daquele assunto.
 *
 * Com a memória da conversa, o modelo às vezes respondia "qual é MESMO a
 * média de português?" de memória, com a nota de uma leitura antiga (medido
 * no bench: gpt-6-luna, 1 em 2). Instrução no prompt não bastou, e às vezes
 * ele ainda chamava isso de "conversa". No pior caso o agente lê de novo sem
 * precisar, o que é mais lento, nunca errado.
 */
export function completarPlano(
  plano: Plano,
  registro: Registro,
  pergunta = ""
): { plano: Plano; completou: boolean } {
  if (plano.ferramentas.length) return { plano, completou: false };
  // "conversa" que pede um valor ("qual é MESMO a média?"): os sinais do plano
  // B (palavras-chave por fonte) servem de rede. "Por que você disse isso?" e
  // "oi" não disparam sinal nenhum e continuam sendo conversa.
  const pelaPergunta = plano.intencao === "conversa" ? registro.escolherLocal(pergunta) : null;
  const doAssunto =
    plano.intencao === "conversa"
      ? pelaPergunta
        ? [pelaPergunta]
        : []
      : registro.capacidades.filter((c) => c.intencao === plano.intencao);
  if (!doAssunto.length) return { plano, completou: false };
  return {
    plano: { ...plano, ferramentas: doAssunto.map((c) => ({ nome: c.nome, args: registro.argsPadrao(c.nome) })) },
    completou: true,
  };
}

export class PerguntaInterrompida extends Error {
  constructor() {
    super("Parei a pergunta a pedido.");
    this.name = "PerguntaInterrompida";
  }
}

export function criarAgente({
  registro,
  motor,
  // Injetáveis para teste: sem eles o laço só rodava com modelo de verdade
  // e navegador aberto, e por isso não tinha teste nenhum.
  preparar = async () => {},
  executarFerramenta = registro.executar,
}: {
  registro: Registro;
  motor: () => Motor;
  preparar?: (passo: Passo) => Promise<void>;
  executarFerramenta?: Registro["executar"];
}) {
  async function perguntar({
    pergunta,
    historico = [],
    emitir,
    sinal,
  }: {
    pergunta: string;
    /** as trocas anteriores; a memória (memoria.ts) escolhe o que cabe no orçamento */
    historico?: Troca[];
    emitir: Emitir;
    /** a pessoa pode parar no meio; o agente para na próxima fronteira de fase */
    sinal?: AbortSignal;
  }): Promise<Resposta & { intencao: string }> {
    const llm = motor();
    const passo = (mensagem: string) => emitir({ tipo: "passo", mensagem });
    const conferir = () => {
      if (sinal?.aborted) throw new PerguntaInterrompida();
    };
    // A chamada ao modelo é a parte longa (até ~20 s na CLI). O motor recebe o
    // sinal e cancela de verdade; a corrida garante que "Parar" responde na hora
    // mesmo com um motor que ignore o sinal.
    const ouParar = <T>(p: Promise<T>): Promise<T> => {
      if (!sinal) return p;
      conferir();
      return new Promise<T>((ok, falha) => {
        const aoAbortar = () => falha(new PerguntaInterrompida());
        sinal.addEventListener("abort", aoAbortar, { once: true });
        p.then(ok, (e) => falha(sinal.aborted ? new PerguntaInterrompida() : e)).finally(() =>
          sinal.removeEventListener("abort", aoAbortar)
        );
      });
    };

    // FASE 0: as fontes acessíveis (pode pausar pedindo código a uma pessoa)
    await preparar(passo);
    conferir();

    // FASE 1: planejar
    passo("Entendendo a pergunta");
    const planoDoModelo = await ouParar(llm.plano({
      pergunta,
      sinal,
      instrucao:
        "Monte o plano para responder. Se a pergunta precisa de um dado, consulte a fonte agora, " +
        "mesmo que a conversa ja tenha falado dele. So dispense a consulta se ela pede para " +
        "explicar ou retomar o que voce ja respondeu.",
      historico,
    }));
    conferir();
    const { plano, completou } = completarPlano(planoDoModelo, registro, pergunta);
    if (completou) passo("Consultando a fonte de novo, para não responder de memória");
    emitir({
      tipo: "plano",
      mensagem: plano.mensagem,
      intencao: plano.intencao,
      ferramentas: plano.ferramentas.map((f) => registro.metadados(f.nome)),
    });

    // FASE 2: executar, na ordem que o plano definiu
    const coletado: Record<string, unknown> = {};
    for (const { nome, args } of plano.ferramentas) {
      conferir();
      emitir({ tipo: "ferramenta_inicio", ...registro.metadados(nome) });
      try {
        // os argumentos que o modelo escolheu, validados de novo pelo contrato
        const dados = await executarFerramenta(nome, args, passo);
        coletado[nome] = dados;
        emitir({ tipo: "ferramenta_fim", nome, ok: true, resumo: registro.resumir(nome, dados), dados });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        coletado[nome] = { erro: msg };
        emitir({ tipo: "ferramenta_fim", nome, ok: false, resumo: msg });
      }
    }
    conferir();

    // FASE 3: responder
    passo("Escrevendo a resposta");
    const resposta = await ouParar(llm.resposta(
      {
        pergunta,
        sinal,
        instrucao: plano.ferramentas.length
          ? "Responda com base APENAS nos dados abaixo (a conversa so ajuda a entender a pergunta)."
          : "Nenhuma fonte foi consultada agora. Converse, ou retome o que voce ja respondeu nesta " +
            "conversa dizendo de que horas e aquela leitura. Nao afirme dado novo.",
        dados: plano.ferramentas.length ? coletado : undefined,
        historico,
      },
      (parcial) => {
        if (!sinal?.aborted) emitir({ tipo: "texto", parcial });
      }
    ));

    // A fonte não é opinião do modelo: sabemos exatamente o que foi lido.
    // (o modelo já respondeu "nenhuma" depois de consultar o ClassApp)
    const fonteReal = plano.ferramentas.length
      ? registro.capacidade(plano.ferramentas[0].nome).fonte
      : "nenhuma";

    return { ...registro.limparResposta({ ...resposta, fonte: fonteReal }), intencao: plano.intencao };
  }

  return { perguntar };
}
