import type { DepsDoMotor, Motor } from "./tipos.ts";

/* ==================================================================
 * Motor local, sem API. O plano B: se a chave falhar ou a internet
 * cair, o agente continua lendo os dados REAIS.
 *
 * Ele não conhece nenhuma capacidade por nome: pergunta ao registro.
 * Capacidade nova passa a funcionar aqui sem tocar neste arquivo.
 * ================================================================== */

export function motorLocal({ registro }: Pick<DepsDoMotor, "registro">): Motor {
  let ultimo: string | null = null;

  return {
    nome: "Sem IA (plano B)",

    async plano(entrada) {
      const c = registro.escolherLocal(entrada.pergunta);
      ultimo = c?.nome ?? null;
      return registro.Plano.parse(
        c?.local
          ? {
              intencao: c.intencao,
              mensagem: c.local.raciocinio,
              // sem modelo não dá para extrair parâmetros: vai tudo no padrão
              ferramentas: [{ nome: c.nome, args: registro.argsPadrao(c.nome) }],
            }
          : {
              intencao: "conversa",
              mensagem: "Essa não precisa de consulta, respondo direto.",
              ferramentas: [],
            }
      );
    },

    async resposta(entrada) {
      if (!ultimo) {
        const temas = registro.capacidades.map((c) => c.rotulo.toLowerCase()).join(", ");
        return registro.Resposta.parse({
          resposta: `Oi! Sem IA, eu consigo consultar: ${temas}. O que você quer saber?`,
          itens: [],
          fonte: "nenhuma",
        });
      }
      const dados = (entrada.dados ?? {})[ultimo];
      const r = registro.responderLocal(ultimo, entrada.pergunta, dados);
      return registro.Resposta.parse({ ...r, fonte: "nenhuma" }); // o agente sobrescreve a fonte
    },
  };
}
