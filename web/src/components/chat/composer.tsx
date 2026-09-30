import { useEffect, useRef, useState } from "react"
import { ArrowUpIcon, SquareIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { EstadoDoServidor } from "@/lib/tipos"
import { cn } from "@/lib/utils"
import { MotorSelect } from "./motor-select"

const aperta = "transition-[scale,background-color] duration-150 active:scale-[0.96] motion-reduce:active:scale-100"

/** A caixa de pergunta, no padrão do chat-03 do blocks.so. */
export function Composer({
  estado,
  nome,
  emAndamento,
  aoEnviar,
  aoParar,
  aoEscolherMotor,
}: {
  estado: EstadoDoServidor
  nome: string
  emAndamento: boolean
  aoEnviar: (texto: string) => void
  aoParar: () => void
  aoEscolherMotor: (id: string, modelo: string) => void
}) {
  const [texto, setTexto] = useState("")
  const campo = useRef<HTMLTextAreaElement>(null)
  const podeEnviar = texto.trim().length > 0 && !emAndamento

  // devolve o foco à caixa quando o agente termina: dá para emendar outra pergunta
  useEffect(() => {
    if (!emAndamento) campo.current?.focus()
  }, [emAndamento])

  const enviar = () => {
    if (!podeEnviar) return
    aoEnviar(texto)
    setTexto("")
  }

  return (
    <form
      className="w-full"
      onSubmit={(e) => {
        e.preventDefault()
        enviar()
      }}
    >
      <div className="flex flex-col gap-2 rounded-3xl border border-border bg-card p-3 shadow-[0_1px_2px_oklch(0_0_0/0.04),0_8px_24px_oklch(0_0_0/0.05)] transition-[box-shadow,border-color] duration-150 focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/10">
        <Textarea
          ref={campo}
          aria-label="Pergunta"
          autoFocus
          rows={1}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              enviar()
            }
          }}
          placeholder={`Pergunte ao ${nome}`}
          className="field-sizing-content max-h-48 min-h-0 resize-none rounded-none border-0 bg-transparent px-1.5 py-1 text-[15px]/6 shadow-none focus-visible:ring-0 md:text-[15px]/6 dark:bg-transparent"
        />
        <div className="flex min-w-0 items-center gap-2">
          <MotorSelect estado={estado} aoEscolher={aoEscolherMotor} desabilitado={emAndamento} />
          <div className="grow" />
          {emAndamento ? (
            <Button type="button" size="icon-sm" aria-label="Parar" onClick={aoParar} className={cn(aperta, "size-8 shrink-0 rounded-full")}>
              <SquareIcon className="size-3 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon-sm"
              aria-label="Enviar"
              disabled={!podeEnviar}
              className={cn(aperta, "size-8 shrink-0 rounded-full", !podeEnviar && "bg-muted text-muted-foreground/70 disabled:opacity-100")}
            >
              <ArrowUpIcon className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
