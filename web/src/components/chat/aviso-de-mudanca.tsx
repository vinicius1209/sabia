import { TriangleAlertIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { EstadoDoServidor } from "@/lib/tipos"

const data = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })

/**
 * Uma fonte mudou de formato desde a última vez que alguém conferiu. A
 * leitura já recusa o que não reconhece; isto avisa antes de alguém
 * descobrir na frente da turma.
 */
export function AvisoDeMudanca({
  mudancas,
  aoConferir,
}: {
  mudancas: EstadoDoServidor["mudancas"]
  aoConferir: (capacidade: string) => void
}) {
  if (!mudancas.length) return null
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-1.5 px-4 pb-2" role="status">
      {mudancas.map((m) => (
        <div
          key={m.capacidade}
          className="flex items-center gap-3 rounded-xl border border-atencao/40 bg-atencao/8 px-3.5 py-2 text-[13px]"
        >
          <TriangleAlertIcon className="size-4 shrink-0 text-atencao" />
          <p className="grow">
            A página de <strong>{m.rotulo}</strong> mudou de formato em {data(m.desde)}. Confira as respostas sobre
            ela antes de confiar.
          </p>
          <Button size="sm" variant="ghost" className="shrink-0" onClick={() => aoConferir(m.capacidade)}>
            Já conferi
          </Button>
        </div>
      ))}
    </div>
  )
}
