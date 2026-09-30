import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { EstadoDoServidor } from "@/lib/tipos"
import { CamposDoAgente, Conexao, EscolhaDoMotor } from "./configuracao"

export function Ajustes({
  aberto,
  aoFechar,
  estado,
  aoMudar,
}: {
  aberto: boolean
  aoFechar: () => void
  estado: EstadoDoServidor
  aoMudar: (e: EstadoDoServidor) => void
}) {
  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Ajustes</DialogTitle>
          <DialogDescription>Tudo fica só neste computador, em ~/.sabia.</DialogDescription>
        </DialogHeader>
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Motor de IA</h3>
          <EscolhaDoMotor estado={estado} aoMudar={aoMudar} />
        </section>
        <section className="flex flex-col gap-3 border-t border-border pt-5">
          <CamposDoAgente aoSalvar={aoMudar} />
        </section>
        <section className="flex flex-col gap-3 border-t border-border pt-5">
          <h3 className="text-sm font-semibold">Conexão</h3>
          <p className="text-[13px] text-muted-foreground">
            Refaz o login nas fontes. Útil se a sessão expirou ou se você trocou a conta.
          </p>
          <Conexao />
        </section>
      </DialogContent>
    </Dialog>
  )
}
