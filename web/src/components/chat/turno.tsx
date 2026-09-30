import { useState } from "react"
import { AlertCircleIcon, CheckIcon, ChevronRightIcon, CopyIcon, PaperclipIcon, RotateCcwIcon } from "lucide-react"
import { CartaoDaFerramenta } from "@/components/artefatos"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { MessageScrollerItem } from "@/components/ui/message-scroller"
import type { InfoDoAgente } from "@/lib/tipos"
import { vistaDo, type TurnoVivo } from "@/lib/turno"
import { cn } from "@/lib/utils"
import { AvatarDoAgente } from "./avatar-do-agente"
import { Codigo2FA } from "./codigo-2fa"
import { Destaques } from "./destaques"
import { Markdown } from "./markdown"
import { Trilha } from "./trilha"

const entra = "animate-in fade-in slide-in-from-bottom-1 duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]"

export function Turno({
  info,
  turno,
  aoRepetir,
}: {
  info: InfoDoAgente
  turno: TurnoVivo
  aoRepetir: (pergunta: string) => void
}) {
  const vista = vistaDo(turno)
  const [copiado, setCopiado] = useState(false)
  const lidas = vista.ferramentas.filter((f) => f.ok && f.dados !== undefined)

  return (
    <>
      <MessageScrollerItem messageId={`${turno.id}-p`} scrollAnchor className={cn("flex justify-end", entra)}>
        <div className="max-w-[min(34rem,85%)] rounded-[20px] bg-secondary px-4 py-2.5 text-[15px]/6 text-secondary-foreground">
          {turno.pergunta}
        </div>
      </MessageScrollerItem>

      <MessageScrollerItem messageId={`${turno.id}-r`} className={cn("flex gap-3.5", entra)}>
        <AvatarDoAgente info={info} estado={vista.estado} className="mt-0.5" />
        <div className="flex min-w-0 grow flex-col gap-3">
          <Trilha turno={turno} vista={vista} />

          {turno.esperandoCodigo && <Codigo2FA />}

          {vista.erro ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-start gap-3 rounded-xl bg-destructive/6 px-4 py-3 ring-1 ring-destructive/15">
                <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-semibold text-destructive">Não consegui responder</p>
                  <p className="text-[13px]/5 text-destructive/85">{vista.erro}</p>
                </div>
              </div>
              {!turno.ativo && (
                <Button variant="outline" className="w-fit" onClick={() => aoRepetir(turno.pergunta)}>
                  <RotateCcwIcon />
                  Tentar de novo
                </Button>
              )}
            </div>
          ) : (
            vista.texto && <Markdown texto={vista.texto} escrevendo={turno.ativo} />
          )}

          <Destaques itens={vista.itens} />

          {lidas.length > 0 && !turno.ativo && (
            <div className="flex flex-col gap-2">
              {lidas.map((f, i) => {
                return (
                  <Collapsible key={`${f.nome}-${i}`} className="rounded-xl border border-border bg-card/60">
                    <CollapsibleTrigger className="group/fonte flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                      <span aria-hidden>{f.icone}</span>
                      <span className="font-medium">{f.rotulo}</span>
                      <span className="text-muted-foreground">· {f.resumo}</span>
                      <ChevronRightIcon className="ml-auto size-4 text-muted-foreground transition-transform group-data-[panel-open]/fonte:rotate-90" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="border-t border-border px-3.5 py-3">
                      <CartaoDaFerramenta agente={info.id} ferramenta={f.nome} dados={f.dados} itens={vista.itens} />
                    </CollapsibleContent>
                  </Collapsible>
                )
              })}
            </div>
          )}

          {!turno.ativo && !vista.erro && vista.texto && (
            <div className="-ml-1.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Copiar resposta"
                onClick={() => {
                  void navigator.clipboard.writeText(vista.texto)
                  setCopiado(true)
                  window.setTimeout(() => setCopiado(false), 1500)
                }}
              >
                {copiado ? <CheckIcon /> : <CopyIcon />}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Perguntar de novo"
                onClick={() => aoRepetir(turno.pergunta)}
              >
                <RotateCcwIcon />
              </Button>
              {vista.fonte && (
                <span className="ml-1 inline-flex items-center gap-1">
                  <PaperclipIcon className="size-3.5" />
                  fonte: {vista.fonte}
                </span>
              )}
              {vista.motor && <span className="ml-2 text-muted-foreground/70">{vista.motor}</span>}
            </div>
          )}
        </div>
      </MessageScrollerItem>
    </>
  )
}
