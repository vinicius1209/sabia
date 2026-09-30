import { cn } from "@/lib/utils"
import type { EstadoDoAgente, InfoDoAgente } from "@/lib/tipos"

const TRABALHANDO: EstadoDoAgente[] = ["pensando", "buscando", "aguardando"]

const ROTULO: Record<EstadoDoAgente, string> = {
  ocioso: "pronto para perguntar",
  pensando: "pensando",
  buscando: "buscando nas fontes",
  aguardando: "esperando o código",
  pronto: "respondeu",
  erro: "algo deu errado",
}

/**
 * O mascote É o indicador de estado: a pose muda conforme o que o agente
 * está fazendo (o slide 4 da apresentação ensina a ler isso).
 */
export function AvatarDoAgente({
  info,
  estado,
  className,
}: {
  info: InfoDoAgente
  estado: EstadoDoAgente
  className?: string
}) {
  const trabalhando = TRABALHANDO.includes(estado)
  const src = info.marca.poses[estado]
  return (
    <div
      className={cn("relative size-9 shrink-0", className)}
      role="img"
      aria-label={`${info.nome}: ${ROTULO[estado]}`}
      data-estado={estado}
    >
      {trabalhando && (
        <span
          aria-hidden
          className={cn(
            "absolute -inset-[3px] rounded-full animate-anel",
            estado === "aguardando"
              ? "bg-[conic-gradient(var(--atencao)_0_35%,transparent_35%)]"
              : "bg-[conic-gradient(var(--primary)_0_30%,transparent_30%)]"
          )}
        />
      )}
      <span className="absolute inset-0 rounded-full bg-card ring-1 ring-border" />
      {/* key na imagem: trocar a pose reinicia a animação da batidinha */}
      <img
        key={src}
        src={src}
        alt=""
        className="absolute inset-[3px] size-[calc(100%-6px)] object-contain animate-troca-pose"
      />
    </div>
  )
}
