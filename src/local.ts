import { Plano, Resposta } from "./contracts.ts";
import type { Motor } from "./agent.ts";
import { escolherLocal, responderLocal, argsPadrao, type NomeCapacidade } from "./capacidades/index.ts";

/* ==================================================================
 * Motor local, sem API. Plano B da feira: se a chave falhar ou a
 * internet cair, o agente continua lendo os dados REAIS.
 *
 * Ele nao conhece nenhuma capacidade por nome: pergunta ao registro.
 * Capacidade nova passa a funcionar aqui sem tocar neste arquivo.
 * ================================================================== */

export function motorLocal(): Motor {
  let ultimo: NomeCapacidade | null = null;

  return {
    nome: "Local (sem IA, plano B)",

    async plano(entrada) {
      const c = escolherLocal(entrada.pergunta);
      ultimo = (c?.nome as NomeCapacidade) ?? null;
      return Plano.parse(
        c
          ? {
              intencao: c.local!.intencao,
              raciocinio: c.local!.raciocinio,
              // sem modelo nao da para extrair parametros: vai tudo no padrao
              ferramentas: [{ nome: c.nome, args: argsPadrao(c.nome as NomeCapacidade) }],
            }
          : {
              intencao: "conversa",
              raciocinio: "Essa não precisa de consulta, respondo direto.",
              ferramentas: [],
            }
      );
    },

    async resposta(entrada) {
      if (!ultimo) {
        return Resposta.parse({
          resposta:
            "Oi! Posso ver suas notas, as datas de prova, o quadro de horários e os avisos da escola. O que você quer saber?",
          itens: [],
          fonte: "nenhuma",
        });
      }
      const dados = (entrada.dados ?? {})[ultimo];
      const r = responderLocal(ultimo, entrada.pergunta, dados);
      return Resposta.parse({ ...r, fonte: "nenhuma" }); // o agente sobrescreve a fonte
    },
  };
}
