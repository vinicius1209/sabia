/* ==================================================================
 * O "portão" do código de verificação (2FA).
 *
 * O agente para no meio do login e espera uma PESSOA digitar o código
 * que chegou por SMS. Antes essa espera não tinha fim: se ninguém
 * digitasse (modal fechado, pessoa saiu de perto), a pergunta nunca
 * terminava, a trava "ocupado" do servidor nunca soltava, e toda
 * pergunta seguinte recebia "já estou respondendo outra pergunta" até
 * alguém reiniciar o servidor. Na feira isso mataria a demonstração.
 *
 * Agora a espera tem prazo e pode ser cancelada. Nos dois casos a
 * pergunta falha com uma mensagem clara e o servidor fica livre.
 * ================================================================== */

export class DoisFatoresCancelado extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "DoisFatoresCancelado";
  }
}

export interface Portao2FA {
  /** o agente chama isto e fica esperando o código */
  pedir(): Promise<string>;
  /** a tela chama isto com o código digitado. false = ninguém estava esperando */
  responder(codigo: string): boolean;
  /** a tela chama isto se a pessoa desistir. false = ninguém estava esperando */
  cancelar(): boolean;
  esperando(): boolean;
}

export function criarPortao2FA({
  prazoMs = 3 * 60 * 1000,
  aoPedir = () => {},
  aoEncerrar = () => {},
}: {
  prazoMs?: number;
  /** avisa a tela para abrir o campo do código */
  aoPedir?: () => void;
  /** avisa a tela para fechar o campo (respondido, cancelado ou expirado) */
  aoEncerrar?: (motivo: "ok" | "cancelado" | "expirou") => void;
} = {}): Portao2FA {
  let pendente: {
    resolve: (c: string) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

  const encerrar = (motivo: "ok" | "cancelado" | "expirou") => {
    if (pendente) clearTimeout(pendente.timer);
    pendente = null;
    aoEncerrar(motivo);
  };

  return {
    pedir() {
      // um pedido novo derruba um anterior que tenha ficado pendurado
      if (pendente) {
        const velho = pendente;
        encerrar("cancelado");
        velho.reject(new DoisFatoresCancelado("Um novo pedido de código substituiu este."));
      }
      aoPedir();
      return new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
          const minutos = Math.round(prazoMs / 60000);
          encerrar("expirou");
          reject(
            new DoisFatoresCancelado(
              `Ninguém digitou o código de verificação em ${minutos} min. Pergunte de novo quando o celular estiver à mão.`
            )
          );
        }, prazoMs);
        pendente = { resolve, reject, timer };
      });
    },

    responder(codigo) {
      if (!pendente) return false;
      const { resolve } = pendente;
      encerrar("ok");
      resolve(codigo.trim());
      return true;
    },

    cancelar() {
      if (!pendente) return false;
      const { reject } = pendente;
      encerrar("cancelado");
      reject(new DoisFatoresCancelado("O login foi cancelado na tela do código."));
      return true;
    },

    esperando: () => pendente !== null,
  };
}
