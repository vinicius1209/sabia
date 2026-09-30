import type { InfoDoAgente } from "@/lib/tipos"
import { ESTADOS_DO_MASCOTE, Mascote, ROTULO_DO_ESTADO } from "."

/** Todos os estados lado a lado, em #mascotes: para conferir a animação. */
export function GaleriaDoMascote({ info }: { info: InfoDoAgente }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-10 p-10">
      <h1 className="text-2xl font-semibold">{info.nome}: os estados</h1>
      <div className="grid grid-cols-4 gap-6">
        {ESTADOS_DO_MASCOTE.map((e) => (
          <div key={e} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4">
            <Mascote info={info} estado={e} className="size-32" />
            <span className="text-sm font-medium">{e}</span>
            <span className="text-xs text-muted-foreground">{ROTULO_DO_ESTADO[e]}</span>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-6" aria-label="Tamanhos usados na tela">
        {["size-4", "size-6", "size-9", "size-14"].map((t) => (
          <Mascote key={t} info={info} estado="ocioso" className={t} />
        ))}
      </div>
    </div>
  )
}
