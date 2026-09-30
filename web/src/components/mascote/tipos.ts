import type { EstadoDoAgente } from "@/lib/tipos"

/** Os estados do pacote, mais um que só a tela conhece: escrevendo a resposta. */
export type EstadoDoMascote = EstadoDoAgente | "escrevendo"
