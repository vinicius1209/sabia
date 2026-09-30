import { useEffect, useState } from "react"
import { LoaderIcon } from "lucide-react"
import { Ajustes } from "@/components/ajustes"
import { BarraLateral } from "@/components/barra-lateral"
import { Chat } from "@/components/chat/chat"
import { GaleriaDoMascote } from "@/components/mascote/galeria"
import { PrimeiroUso } from "@/components/primeiro-uso"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useSabia } from "@/hooks/use-sabia"

export default function App() {
  const sabia = useSabia()
  const [ajustes, setAjustes] = useState(false)
  // Decide UMA vez, na carga, se o guia aparece. Antes era recalculado a cada
  // render: salvar a conta completava a config e a tela pulava o passo 3.
  const [guiando, setGuiando] = useState<boolean | null>(null)
  const { info, estado } = sabia
  useEffect(() => {
    if (estado && guiando === null) setGuiando(!estado.configurado)
  }, [estado, guiando])

  const mudouConfig = () => {
    void sabia.recarregarEstado()
    void sabia.recarregarInfo()
  }

  if (sabia.erroDeCarga) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6 text-center">
        <div className="max-w-sm">
          <p className="font-semibold">Não consegui falar com o servidor.</p>
          <p className="text-sm text-muted-foreground">{sabia.erroDeCarga}</p>
        </div>
      </div>
    )
  }
  if (!info || !estado || guiando === null) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <LoaderIcon className="size-5 animate-spin text-muted-foreground" aria-label="Carregando" />
      </div>
    )
  }

  // a galeria dos estados do mascote, para conferir a animação
  if (window.location.hash === "#mascotes") return <GaleriaDoMascote info={info} />

  if (guiando) {
    return (
      <>
        <PrimeiroUso
          info={info}
          estado={estado}
          aoMudar={mudouConfig}
          aoConcluir={() => {
            setGuiando(false)
            mudouConfig()
          }}
        />
        <Toaster />
      </>
    )
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <BarraLateral sabia={sabia} info={info} estado={estado} aoAbrirAjustes={() => setAjustes(true)} />
        <SidebarInset>
          <Chat sabia={sabia} info={info} estado={estado} />
        </SidebarInset>
      </SidebarProvider>
      <Ajustes
        aberto={ajustes}
        aoFechar={() => setAjustes(false)}
        estado={estado}
        aoMudar={mudouConfig}
      />
      <Toaster />
    </TooltipProvider>
  )
}
