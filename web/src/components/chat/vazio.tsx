import { Mascote } from "@/components/mascote"
import { Button } from "@/components/ui/button"
import type { InfoDoAgente } from "@/lib/tipos"

/** A primeira frase da saudação vira o título ("Oi, Ana!"); o resto, o subtítulo. */
function partir(saudacao: string): [string, string] {
  const m = /^(.+?[!?.])\s+(.*)$/s.exec(saudacao)
  return m ? [m[1], m[2]] : [saudacao, ""]
}

export function Vazio({
  info,
  children,
  aoSugerir,
}: {
  info: InfoDoAgente
  /** a caixa de pergunta, no meio da tela enquanto a conversa está vazia */
  children: React.ReactNode
  aoSugerir: (texto: string) => void
}) {
  const [titulo, subtitulo] = partir(info.saudacao)
  return (
    <div className="flex grow flex-col items-center justify-center px-4 pb-16">
      <div className="flex w-full max-w-2xl animate-in flex-col items-center gap-7 fade-in slide-in-from-bottom-2 duration-300">
        <Mascote info={info} estado="ocioso" className="size-32" />
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-[-0.02em] text-balance">{titulo}</h1>
          {subtitulo && <p className="max-w-lg text-[15px]/6 text-balance text-muted-foreground">{subtitulo}</p>}
        </div>
        {children}
        <div className="flex flex-wrap justify-center gap-2">
          {info.sugestoes.map((s) => (
            <Button
              key={s.texto}
              variant="outline"
              onClick={() => aoSugerir(s.texto)}
              className="h-8 gap-1.5 rounded-full border-border bg-background pr-3.5 pl-2.5 text-sm font-normal text-foreground shadow-[0_1px_2px_oklch(0_0_0/0.05)] transition-[background-color,color,scale] duration-150 hover:bg-muted active:scale-[0.96] dark:bg-muted/40 dark:hover:bg-muted"
            >
              <span aria-hidden>{s.icone}</span>
              {s.texto}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
