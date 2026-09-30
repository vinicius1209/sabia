import type { ComponentType } from "react"
import { MascoteSabia } from "@/agentes/sabia/mascote"
import "@/agentes/sabia/mascote.css"
import type { InfoDoAgente } from "@/lib/tipos"
import { cn } from "@/lib/utils"
import type { EstadoDoMascote } from "./tipos"

type MascoteAnimado = ComponentType<{ estado: EstadoDoMascote; className?: string }>

/**
 * Pacote que traz mascote animado (desenhado por partes) usa o dele. Os
 * outros ficam com as poses em PNG da marca, sem fundo, trocando de pose.
 */
const ANIMADOS: Record<string, MascoteAnimado> = {
  sabia: MascoteSabia,
}

const ROTULO: Record<EstadoDoMascote, string> = {
  ocioso: "pronto para perguntar",
  pensando: "pensando",
  buscando: "buscando nas fontes",
  aguardando: "esperando o código",
  escrevendo: "escrevendo a resposta",
  pronto: "respondeu",
  erro: "algo deu errado",
}

export function Mascote({
  info,
  estado,
  className,
}: {
  info: InfoDoAgente
  estado: EstadoDoMascote
  className?: string
}) {
  const Animado = ANIMADOS[info.id]
  const rotulo = `${info.nome}: ${ROTULO[estado]}`
  if (Animado) {
    return (
      <span role="img" aria-label={rotulo} className={cn("inline-block", className)}>
        <Animado estado={estado} className="size-full" />
      </span>
    )
  }
  const pose = info.marca.poses[estado === "escrevendo" ? "pensando" : estado]
  return (
    <img
      key={pose}
      src={pose}
      alt={rotulo}
      className={cn("object-contain animate-troca-pose", className)}
    />
  )
}

export const ESTADOS_DO_MASCOTE = Object.keys(ROTULO) as EstadoDoMascote[]
export { ROTULO as ROTULO_DO_ESTADO }
