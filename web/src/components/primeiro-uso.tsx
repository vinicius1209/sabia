import { useState } from "react"
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { EstadoDoServidor, InfoDoAgente } from "@/lib/tipos"
import { cn } from "@/lib/utils"
import { CamposDoAgente, Conexao, EscolhaDoMotor } from "./configuracao"

const PASSOS = [
  { titulo: "Escolha a IA", texto: "Quem vai entender as perguntas. Dá para trocar depois, a qualquer hora." },
  { titulo: "Sua conta", texto: "O que o agente precisa para entrar nas fontes. Fica só neste computador." },
  { titulo: "Conectar", texto: "O primeiro login, com você olhando. Se pedir código, ele aparece aqui." },
]

/**
 * O primeiro uso, sem editar arquivo nenhum: escolher a IA, preencher a
 * conta e fazer o primeiro login. É o "plug and play" do pacote.
 */
export function PrimeiroUso({
  info,
  estado,
  aoMudar,
  aoConcluir,
}: {
  info: InfoDoAgente
  estado: EstadoDoServidor
  aoMudar: (e: EstadoDoServidor) => void
  aoConcluir: () => void
}) {
  const [passo, setPasso] = useState(0)
  const [conectou, setConectou] = useState(false)
  const motorOk = estado.motores.find((m) => m.id === estado.motor.id)?.disponivel ?? false
  const podeAvancar = passo === 0 ? motorOk : passo === 1 ? estado.faltando.length === 0 : conectou

  return (
    <div className="flex min-h-svh items-start justify-center overflow-y-auto px-4 py-10 sm:items-center">
      <div className="flex w-full max-w-xl flex-col gap-7">
        <div className="flex items-center gap-4">
          <img src={info.marca.mascote} alt="" className="size-16 animate-flutua object-contain" />
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.02em]">Vamos ligar o {info.nome}</h1>
            <p className="text-[15px] text-muted-foreground">{info.descricao}</p>
          </div>
        </div>

        <ol className="grid grid-cols-3 gap-2" aria-label="Passos">
          {PASSOS.map((p, i) => (
            <li
              key={p.titulo}
              aria-current={i === passo ? "step" : undefined}
              className={cn(
                "flex flex-col gap-1.5 text-xs",
                i <= passo ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <span className={cn("h-1 rounded-full", i <= passo ? "bg-primary" : "bg-border")} />
              {i + 1}. {p.titulo}
            </li>
          ))}
        </ol>

        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div>
            <h2 className="text-lg font-semibold">{PASSOS[passo].titulo}</h2>
            <p className="text-[13px] text-muted-foreground">{PASSOS[passo].texto}</p>
          </div>
          {passo === 0 && <EscolhaDoMotor estado={estado} aoMudar={aoMudar} />}
          {passo === 1 && (
            <CamposDoAgente
              rotulo="Salvar e continuar"
              aoSalvar={(e) => {
                aoMudar(e)
                if (e.faltando.length === 0) setPasso(2)
              }}
            />
          )}
          {passo === 2 && <Conexao aoConectar={() => setConectou(true)} />}
        </section>

        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setPasso((p) => p - 1)} disabled={passo === 0}>
            <ArrowLeftIcon />
            Voltar
          </Button>
          {passo === 1 ? (
            <span />
          ) : passo < 2 ? (
            <Button onClick={() => setPasso((p) => p + 1)} disabled={!podeAvancar}>
              Continuar
              <ArrowRightIcon />
            </Button>
          ) : (
            <Button onClick={aoConcluir} disabled={!podeAvancar}>
              Começar a perguntar
              <ArrowRightIcon />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
