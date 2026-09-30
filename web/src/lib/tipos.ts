/**
 * Os tipos do protocolo vêm do próprio servidor: se um lado mudar, o outro
 * não compila. Só tipos (import type), nada do servidor entra no bundle.
 */
export type {
  CampoPreenchido,
  Conversa,
  EstadoDoServidor,
  EventoDoTurno,
  InfoDoAgente,
  MetaFerramenta,
  OpcaoDeMotor,
  ResumoDeConversa,
  Turno,
} from "../../../src/nucleo/protocolo.ts"
export type { EstadoDoAgente } from "../../../src/nucleo/pacote.ts"
export type { ItemResposta } from "../../../src/nucleo/capacidade.ts"
