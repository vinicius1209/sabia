import type { Motor } from "./motores/index.ts";
import type { EventoDoTurno } from "./protocolo.ts";
import type { Registro, Resposta } from "./registro.ts";
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
    historico?: { pergunta: string; intencao: string }[];
    emitir: Emitir;
    /** a pessoa pode parar no meio; o agente para na próxima fronteira de fase */
    sinal?: AbortSignal;
  }): Promise<Resposta & { intencao: string }> {
    const llm = motor();
    const passo = (mensagem: string) => emitir({ tipo: "passo", mensagem });
    const conferir = () => {
      if (sinal?.aborted) throw new PerguntaInterrompida();
    };

    // FASE 0: as fontes acessíveis (pode pausar pedindo código a uma pessoa)
    await preparar(passo);
    conferir();

    // FASE 1: planejar
    passo("Entendendo a pergunta");
    const plano = await llm.plano({
      pergunta,
      instrucao: "Monte o plano para responder.",
      historico: historico.slice(-4),
    });
    conferir();
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
    const resposta = await llm.resposta(
      {
        pergunta,
        instrucao: plano.ferramentas.length
          ? "Responda com base APENAS nos dados abaixo."
          : "Nenhuma fonte foi consultada, responda apenas conversando.",
        dados: plano.ferramentas.length ? coletado : undefined,
      },
      (parcial) => emitir({ tipo: "texto", parcial })
    );

    // A fonte não é opinião do modelo: sabemos exatamente o que foi lido.
    // (o modelo já respondeu "nenhuma" depois de consultar o ClassApp)
    const fonteReal = plano.ferramentas.length
      ? registro.capacidade(plano.ferramentas[0].nome).fonte
      : "nenhuma";

    return { ...registro.limparResposta({ ...resposta, fonte: fonteReal }), intencao: plano.intencao };
  }

  return { perguntar };
}
