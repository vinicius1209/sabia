import {
  CalendarClockIcon,
  ChartColumnIcon,
  ClockIcon,
  CloudIcon,
  MegaphoneIcon,
  NotebookPenIcon,
  SparklesIcon,
  TrendingUpIcon,
  type LucideIcon,
} from "lucide-react"
import { Mascote } from "@/components/mascote"
import type { InfoDoAgente } from "@/lib/tipos"
import { cn } from "@/lib/utils"

/**
 * Os ícones que um pacote pode pedir para os cartões, pelo nome. Nome
 * desconhecido cai no genérico: pacote novo nunca quebra a tela.
 */
const ICONES_DE_ATALHO: Record<string, LucideIcon> = {
  notas: ChartColumnIcon,
  prova: CalendarClockIcon,
  horario: ClockIcon,
  tarefa: NotebookPenIcon,
  aviso: MegaphoneIcon,
  atencao: TrendingUpIcon,
  nuvem: CloudIcon,
}

type Cor = InfoDoAgente["atalhos"][number]["cor"]

/** o azulejo do ícone, na cor do cartão (claro e escuro) */
const COR: Record<Cor, string> = {
  azul: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
  laranja: "bg-orange-500/12 text-orange-600 dark:text-orange-400",
  verde: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  roxo: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
  ambar: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  rosa: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
}

/** A primeira frase da saudação vira o título ("Oi, Ana!"); o resto, o subtítulo. */
function partir(saudacao: string): [string, string] {
  const m = /^(.+?[!?.])\s+(.*)$/s.exec(saudacao)
  return m ? [m[1], m[2]] : [saudacao, ""]
}

/**
 * A tela inicial: um painel, no desenho do cartaz da Exposalê. Um cartão por
 * assunto, com o ícone num azulejo colorido; clicar já pergunta.
 */
export function Painel({
  info,
  children,
  aoPerguntar,
}: {
  info: InfoDoAgente
  /** a caixa de pergunta, no meio da tela enquanto a conversa está vazia */
  children: React.ReactNode
  aoPerguntar: (pergunta: string) => void
}) {
  const [titulo, subtitulo] = partir(info.saudacao)
  return (
    // my-auto no filho, e não justify-center no pai: com conteúdo mais alto que a
    // tela (celular), o justify-center empurra o topo para fora da rolagem e a
    // cabeça do mascote some
    <div className="flex min-h-0 grow flex-col items-center overflow-y-auto px-4 py-8">
      <div className="my-auto flex w-full max-w-3xl animate-in flex-col items-center gap-7 fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex flex-col items-center gap-3 text-center">
          <Mascote info={info} estado="ocioso" className="size-28" />
          <h1 className="text-3xl font-semibold tracking-[-0.02em] text-balance">{titulo}</h1>
          {subtitulo && <p className="max-w-lg text-[15px]/6 text-balance text-muted-foreground">{subtitulo}</p>}
        </div>
        {children}
        <ul className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Atalhos">
          {info.atalhos.map((a, i) => {
            const Icone = ICONES_DE_ATALHO[a.icone] ?? SparklesIcon
            return (
              <li
                key={a.titulo}
                className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                style={{ animationDelay: `${120 + i * 50}ms` }}
              >
                <button
                  type="button"
                  onClick={() => aoPerguntar(a.pergunta)}
                  className="group/atalho flex h-full w-full items-start gap-3.5 rounded-2xl border border-border bg-card p-4 text-left shadow-[0_1px_2px_oklch(0_0_0/0.04)] transition-[translate,box-shadow,border-color] duration-200 ease-out outline-none hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_10px_28px_-12px_oklch(0.5_0.12_45/0.35)] focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-0 motion-reduce:hover:translate-y-0"
                >
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", COR[a.cor])}>
                    <Icone className="size-5" strokeWidth={2} />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">{a.titulo}</span>
                    <span className="text-[13px]/5 text-muted-foreground">{a.descricao}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
