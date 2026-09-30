import { CheckIcon, ChevronRightIcon, LoaderIcon, XIcon } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useRelogio } from "@/hooks/use-relogio"
import { duracao, type TurnoVivo, type VistaDoTurno } from "@/lib/turno"
import { cn } from "@/lib/utils"

/**
 * O "trabalhou por 31s" do Claude: ao vivo mostra o que o agente está
 * fazendo agora; no fim recolhe e vira um resumo que abre a trilha inteira.
 */
export function Trilha({ turno, vista }: { turno: TurnoVivo; vista: VistaDoTurno }) {
  const agora = useRelogio(turno.ativo)
  const fontes = new Set(vista.ferramentas.filter((f) => f.ok).map((f) => f.fonte)).size
  const tempo = vista.duracaoMs ?? (turno.ativo ? agora - turno.inicio : undefined)

  if (!vista.trilha.length && !turno.ativo) return null

  const titulo = turno.ativo
    ? vista.estado === "aguardando"
      ? "Esperando o código de verificação"
      : `${vista.agora}…`
    : `Trabalhou por ${tempo ? duracao(tempo) : "alguns segundos"}${fontes ? ` · ${fontes} ${fontes === 1 ? "fonte" : "fontes"}` : ""}`

  return (
    <Collapsible className="flex flex-col gap-2">
      <CollapsibleTrigger
        className={cn(
          "group/trilha flex w-fit items-center gap-1.5 rounded-md text-[13px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
          turno.ativo && "shimmer"
        )}
      >
        <ChevronRightIcon className="size-3.5 transition-transform group-data-[panel-open]/trilha:rotate-90" />
        <span>{titulo}</span>
        {turno.ativo && tempo !== undefined && (
          <span className="tabular-nums text-muted-foreground/70">{duracao(tempo)}</span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="flex flex-col gap-1.5 border-l-2 border-border pl-3.5 text-[13px]/5 text-muted-foreground">
          {vista.trilha.map((l, i) => {
            if (l.tipo === "plano") {
              return (
                <li key={i} className="italic text-foreground/80">
                  {l.texto}
                </li>
              )
            }
            if (l.tipo === "passo") return <li key={i}>{l.texto}</li>
            const f = l.ferramenta
            return (
              <li key={i} className="flex flex-col gap-1">
                <span className="flex items-center gap-2 font-medium text-foreground">
                <span aria-hidden>{f.icone}</span>
                <span>{f.rotulo}</span>
                <span className="font-normal text-muted-foreground">· {f.fonte}</span>
                {f.emAndamento ? (
                  <LoaderIcon className="size-3.5 animate-spin text-primary" aria-label="lendo" />
                ) : f.ok ? (
                  <span className="flex items-center gap-1 font-normal text-muted-foreground">
                    <CheckIcon className="size-3.5 text-bom" aria-hidden />
                    {f.resumo}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-normal text-ruim">
                    <XIcon className="size-3.5" aria-hidden />
                    {f.resumo}
                  </span>
                )}
                </span>
                {f.passos.length > 0 && (
                  <ol className="flex flex-col gap-0.5 pl-6">
                    {f.passos.map((p, j) => (
                      <li key={j}>{p}</li>
                    ))}
                  </ol>
                )}
              </li>
            )
          })}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  )
}
