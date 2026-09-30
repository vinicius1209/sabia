import type { ItemResposta } from "./capacidade.ts";
import type { Atalho, CampoDeConfig, EstadoDoAgente } from "./pacote.ts";

/* ==================================================================
 * O PROTOCOLO entre o servidor e qualquer tela.
 *
 * Antes o contrato dos eventos só existia implícito no JavaScript da
 * página: mudar um nome no servidor quebrava a tela sem erro nenhum.
 * Agora os dois lados importam os tipos daqui (a tela com `import type`),
 * e uma mudança que não bate não compila.
 * ================================================================== */

export interface MetaFerramenta {
  nome: string;
  rotulo: string;
  fonte: string;
  icone: string;
}

/** O que acontece durante UMA pergunta, na ordem em que acontece. */
export type EventoDoTurno =
  | { tipo: "conversa"; id: string; titulo: string }
  | { tipo: "passo"; mensagem: string }
  | { tipo: "plano"; mensagem: string; intencao: string; ferramentas: MetaFerramenta[] }
  | ({ tipo: "ferramenta_inicio" } & MetaFerramenta)
  | { tipo: "ferramenta_fim"; nome: string; ok: boolean; resumo: string; dados?: unknown }
  /** um pedaço novo do texto da resposta, enquanto o modelo escreve */
  | { tipo: "texto"; parcial: string }
  | { tipo: "2fa_pedido" }
  | { tipo: "2fa_fim"; motivo: "ok" | "cancelado" | "expirou" }
  | {
      tipo: "resposta";
      resposta: string;
      itens: ItemResposta[];
      fonte: string;
      duracaoMs: number;
      motor: string;
    }
  | { tipo: "erro"; mensagem: string };

export type TipoDeEvento = EventoDoTurno["tipo"];

/** Uma pergunta e tudo que ela gerou, como fica salvo. */
export interface Turno {
  id: string;
  pergunta: string;
  criadoEm: string;
  /** os eventos, sem os pedaços de texto (a resposta final já tem o texto todo) */
  eventos: EventoDoTurno[];
}

export interface Conversa {
  id: string;
  titulo: string;
  criadaEm: string;
  atualizadaEm: string;
  turnos: Turno[];
}

export type ResumoDeConversa = Pick<Conversa, "id" | "titulo" | "atualizadaEm">;

/** GET /api/agente: tudo que a tela precisa para vestir o agente. */
export interface InfoDoAgente {
  id: string;
  nome: string;
  descricao: string;
  saudacao: string;
  contexto: string;
  aviso: string;
  atalhos: Atalho[];
  capacidades: MetaFerramenta[];
  marca: { mascote: string; poses: Record<EstadoDoAgente, string> };
}

export interface OpcaoDeModelo {
  id: string;
  nome: string;
  descricao: string;
}

export interface OpcaoDeMotor {
  id: string;
  nome: string;
  descricao: string;
  /** o que precisa para funcionar */
  requer: "chave" | "assinatura" | "nada";
  /** a variável da chave, quando requer chave */
  chave?: string;
  modelos: OpcaoDeModelo[];
  disponivel: boolean;
  /** por que não está disponível, em uma frase */
  motivo?: string;
}

/** GET /api/estado */
export interface EstadoDoServidor {
  /** todos os campos obrigatórios preenchidos e um motor utilizável */
  configurado: boolean;
  faltando: string[];
  /** automatico: a pessoa não escolheu; o Sabiá pegou a primeira assinatura instalada */
  motor: { id: string; modelo: string; nome: string; automatico: boolean };
  motores: OpcaoDeMotor[];
  ocupado: boolean;
  /** fontes cuja página mudou de formato desde a última vez que alguém conferiu */
  mudancas: { capacidade: string; rotulo: string; desde: string }[];
}

/** GET /api/config: os campos do pacote, sem devolver segredo nenhum. */
export interface CampoPreenchido extends CampoDeConfig {
  /** o valor, só para campos que não são senha */
  valor: string;
  preenchido: boolean;
  /** veio de variável de ambiente: a tela não consegue trocar */
  travado: boolean;
}
