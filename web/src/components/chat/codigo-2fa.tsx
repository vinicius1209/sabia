import { useState } from "react"
import { ShieldCheckIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"

/**
 * O agente parou no login e precisa do código que chegou no celular da
 * dona da conta. Ele não guarda senha de ninguém: a pessoa libera, na hora.
 */
export function Codigo2FA({ aoCancelar }: { aoCancelar?: () => void }) {
  const [codigo, setCodigo] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState("")

  const enviar = async () => {
    if (!codigo.trim()) return
    setEnviando(true)
    setErro("")
    try {
      await api.codigo2fa(codigo.trim())
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
      setEnviando(false)
    }
  }

  return (
    <form
      className="flex max-w-md flex-col gap-3 rounded-xl border border-atencao/40 bg-atencao/8 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        void enviar()
      }}
    >
      <div className="flex items-start gap-2.5">
        <ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-atencao" />
        <div>
          <p className="text-sm font-semibold">Preciso de uma autorização</p>
          <p className="text-[13px]/5 text-muted-foreground">
            O login pediu o código de verificação. Ele chegou por SMS no celular da dona da conta.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          autoFocus
          inputMode="text"
          autoComplete="one-time-code"
          maxLength={8}
          placeholder="Código de 6 dígitos"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          className="h-9 font-mono tracking-[0.3em]"
          aria-label="Código de verificação"
        />
        <Button type="submit" className="h-9" disabled={!codigo.trim() || enviando}>
          Liberar
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-9"
          onClick={() => {
            void api.cancelar2fa()
            aoCancelar?.()
          }}
        >
          Cancelar
        </Button>
      </div>
      {erro && <p className="text-xs text-ruim">{erro}</p>}
    </form>
  )
}
