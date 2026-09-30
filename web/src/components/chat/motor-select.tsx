import { CpuIcon } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { EstadoDoServidor, OpcaoDeMotor } from "@/lib/tipos"

const SELO: Record<OpcaoDeMotor["requer"], string> = {
  chave: "CHAVE",
  assinatura: "ASSINATURA",
  nada: "SEM IA",
}

function Selo({ requer }: { requer: OpcaoDeMotor["requer"] }) {
  return (
    <span className="inline-flex h-[15px] items-center rounded-[4px] border border-border/80 bg-muted/40 px-[5px] text-[9px] font-bold uppercase leading-none tracking-[0.06em] text-muted-foreground">
      {SELO[requer]}
    </span>
  )
}

/**
 * Qual motor responde. No padrão ai-02 do blocks.so: cada opção com nome,
 * selo e uma linha de descrição; indisponível aparece com o motivo.
 */
export function MotorSelect({
  estado,
  aoEscolher,
  desabilitado,
}: {
  estado: EstadoDoServidor
  aoEscolher: (id: string, modelo: string) => void
  desabilitado?: boolean
}) {
  const valor = estado.motor.automatico ? "auto::" : `${estado.motor.id}::${estado.motor.modelo}`
  const atual = estado.motores.find((m) => m.id === estado.motor.id)
  const modeloAtual = atual?.modelos.find((m) => m.id === estado.motor.modelo)

  return (
    <Select
      value={valor}
      disabled={desabilitado}
      onValueChange={(v) => {
        if (typeof v !== "string") return
        const [id, modelo = ""] = v.split("::")
        aoEscolher(id, modelo)
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label="Motor de IA"
        className="h-7 min-w-0 max-w-full rounded-full border-transparent bg-transparent px-2 text-sm font-medium text-muted-foreground shadow-none transition-[background-color,color] hover:bg-muted hover:text-foreground aria-expanded:bg-muted dark:bg-transparent dark:hover:bg-muted"
      >
        <SelectValue>
          <span className="flex min-w-0 items-center gap-1.5">
            <CpuIcon className="size-3.5 shrink-0" />
            {estado.motor.automatico && <span className="hidden shrink-0 sm:inline">Automático ·</span>}
            <span className="truncate">{atual?.nome ?? estado.motor.id}</span>
            {modeloAtual && modeloAtual.id && atual && atual.modelos.length > 1 && (
              <span className="hidden shrink-0 text-muted-foreground/70 sm:inline">{modeloAtual.nome}</span>
            )}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false} side="top" sideOffset={8} className="w-80 p-1">
        <SelectItem value="auto::" className="rounded-md py-1.5">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">Automático</span>
            <span className="text-xs text-muted-foreground">
              A primeira assinatura desta máquina, sem gastar com chave. Agora: {atual?.nome}.
            </span>
          </span>
        </SelectItem>
        {estado.motores.map((m) => (
          <SelectGroup key={m.id}>
            <SelectSeparator />
            <SelectLabel className="flex items-center gap-1.5 px-1.5 pt-1.5 text-xs">
              {m.nome}
              <Selo requer={m.requer} />
            </SelectLabel>
            {m.modelos.map((modelo) => (
              <SelectItem
                key={`${m.id}::${modelo.id}`}
                value={`${m.id}::${modelo.id}`}
                disabled={!m.disponivel}
                className="rounded-md py-1.5"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{modelo.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {m.disponivel ? modelo.descricao : m.motivo}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
