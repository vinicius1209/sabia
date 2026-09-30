import { LockIcon } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import type { Sabia } from "@/hooks/use-sabia"
import type { EstadoDoServidor, InfoDoAgente } from "@/lib/tipos"
import { Composer } from "./composer"
import { Turno } from "./turno"
import { Painel } from "./painel"

export function Chat({ sabia, info, estado }: { sabia: Sabia; info: InfoDoAgente; estado: EstadoDoServidor }) {
  const { aberta } = sabia
  const vazia = aberta.turnos.length === 0

  const composer = (
    <Composer
      estado={estado}
      nome={info.nome}
      emAndamento={sabia.emAndamento}
      aoEnviar={(t) => void sabia.enviar(t)}
      aoParar={() => void sabia.parar()}
      aoEscolherMotor={(id, modelo) => void sabia.escolherMotor(id, modelo)}
    />
  )

  return (
    <div className="flex h-svh min-w-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 px-3">
        <SidebarTrigger className="text-muted-foreground" />
        <h2 className="min-w-0 truncate text-sm font-medium">{aberta.titulo}</h2>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
          <LockIcon className="size-3" />
          Somente leitura
        </span>
      </header>

      {vazia ? (
        <Painel info={info} aoPerguntar={(p) => void sabia.enviar(p)}>
          {composer}
        </Painel>
      ) : (
        <>
          <MessageScrollerProvider autoScroll>
            <MessageScroller className="grow">
              <MessageScrollerViewport>
                <MessageScrollerContent className="mx-auto w-full max-w-3xl gap-7 px-4 pt-6 pb-10">
                  {aberta.turnos.map((t) => (
                    <Turno key={t.id} info={info} turno={t} aoRepetir={(p) => void sabia.enviar(p)} />
                  ))}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          </MessageScrollerProvider>
          <div className="mx-auto w-full max-w-3xl shrink-0 px-4">{composer}</div>
        </>
      )}
      <p className="shrink-0 px-4 py-2 text-center text-xs text-muted-foreground">{info.aviso}</p>
    </div>
  )
}
