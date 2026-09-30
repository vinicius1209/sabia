import type { Capacidade } from "./capacidade.ts";
import type { Passo } from "./texto.ts";

/* ==================================================================
 * O PACOTE de um agente.
 *
 * O núcleo (laço, motores, servidor, tela) não sabe nada de escola.
 * Tudo que faz do Sabiá o Sabiá mora num pacote: quem ele é, o que sabe
 * consultar, o que precisa perguntar na primeira vez que roda, como
 * prepara a sessão e a cara dele. Trocar o pacote troca o agente.
 * ================================================================== */

/** Lê um valor da configuração (vazio quando não existe). */
export type LerConfig = (chave: string) => string;

/** Um campo que o primeiro uso pede na tela, em vez de editar arquivo. */
export interface CampoDeConfig {
  /** nome da variável, igual à do .env ("CLASSAPP_PHONE") */
  chave: string;
  rotulo: string;
  tipo: "texto" | "telefone" | "senha";
  obrigatorio: boolean;
  /** agrupa os campos na tela ("Sua conta do ClassApp") */
  grupo: string;
  ajuda?: string;
  exemplo?: string;
}

/** Os estados do mascote. A tela troca a pose conforme o que o agente faz. */
export type EstadoDoAgente = "ocioso" | "pensando" | "buscando" | "aguardando" | "pronto" | "erro";

export interface PacoteDeAgente {
  id: string;
  nome: string;
  /** uma linha: o que este agente faz */
  descricao: string;
  /** a identidade e as regras do domínio, no começo do prompt */
  persona(cfg: LerConfig): string;
  /** a primeira mensagem da tela, quando a conversa está vazia */
  saudacao(cfg: LerConfig): string;
  /** a linha de contexto da barra lateral ("Colégio X · Ana") */
  contexto(cfg: LerConfig): string;
  sugestoes: { icone: string; texto: string }[];
  /** rodapé fixo da tela ("dados reais, apenas leitura") */
  aviso: string;
  capacidades: readonly Capacidade[];
  campos: CampoDeConfig[];
  marca: {
    /** pasta com as imagens, servida em /marca */
    pasta: string;
    /** a imagem grande da tela inicial */
    mascote: string;
    poses: Record<EstadoDoAgente, string>;
  };
  /**
   * Garante que as fontes estão acessíveis antes de cada pergunta (login,
   * sessão). Pode parar e pedir um código a uma pessoa.
   */
  preparar?(ctx: { passo: Passo; pedirCodigo: () => Promise<string> }): Promise<void>;
  /** fecha o que o pacote abriu (navegador, conexões) */
  encerrar?(): Promise<void>;
  /** só com DEBUG_ENDPOINTS=1: derruba a sessão para testar a recuperação */
  derrubarSessao?(): Promise<unknown>;
}

/** Ajuda o TypeScript a conferir o pacote inteiro num lugar só. */
export function definirAgente(p: PacoteDeAgente): PacoteDeAgente {
  return p;
}
