import { useEffect, useState } from "react"
import { CheckCircle2Icon, CheckIcon, CircleIcon, LoaderIcon, PlugZapIcon, XCircleIcon } from "lucide-react"
import { toast } from "sonner"
import { Codigo2FA } from "@/components/chat/codigo-2fa"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import type { CampoPreenchido, EstadoDoServidor, OpcaoDeMotor } from "@/lib/tipos"
import { cn } from "@/lib/utils"

const REQUER: Record<OpcaoDeMotor["requer"], string> = {
  chave: "Gasta com chave",
  assinatura: "Sua assinatura",
  nada: "Sem IA",
}

/* -------------------------------- motor -------------------------------- */

/**
 * Qual IA responde. Mostra o que cada motor precisa e se funciona nesta
 * máquina agora; pede a chave só quando o escolhido precisa de uma.
 */
export function EscolhaDoMotor({
  estado,
  aoMudar,
}: {
  estado: EstadoDoServidor
  aoMudar: (e: EstadoDoServidor) => void
}) {
  const [chave, setChave] = useState("")
  const [testando, setTestando] = useState(false)
  const [teste, setTeste] = useState<{ ok: boolean; texto: string } | null>(null)
  const atual = estado.motores.find((m) => m.id === estado.motor.id)

  const escolher = async (id: string, modelo = "") => {
    setTeste(null)
    setChave("")
    aoMudar(await api.escolherMotor(id, modelo))
  }

  const salvarChave = async () => {
    if (!atual?.chave || !chave.trim()) return
    aoMudar(await api.salvarConfig({ [atual.chave]: chave.trim() }))
    setChave("")
    toast.success("Chave salva neste computador.")
  }

  const testar = async () => {
    setTestando(true)
    setTeste(null)
    const r = await api.testarMotor()
    setTestando(false)
    setTeste(
      r.ok
        ? { ok: true, texto: `${r.motor} respondeu em ${(r.duracaoMs / 1000).toFixed(1)}s.` }
        : { ok: false, texto: r.erro }
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Motor de IA" className="flex flex-col gap-2">
        <button
          type="button"
          role="radio"
          aria-checked={estado.motor.automatico}
          onClick={() => void escolher("auto")}
          className={cn(
            "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            estado.motor.automatico ? "border-primary bg-primary/6" : "border-border hover:bg-muted/60"
          )}
        >
          {estado.motor.automatico ? (
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
          ) : (
            <CircleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
          )}
          <span className="flex min-w-0 grow flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
              Automático
              <span className="rounded-[4px] border border-primary/40 bg-primary/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.05em] text-primary">
                recomendado
              </span>
            </span>
            <span className="text-[13px] text-muted-foreground">
              Usa a primeira assinatura desta máquina (Claude, Antigravity ou Codex), sem gastar com chave.
              {estado.motor.automatico && ` Agora: ${estado.motores.find((m) => m.id === estado.motor.id)?.nome}.`}
            </span>
          </span>
        </button>
        {estado.motores.map((m) => {
          const escolhido = !estado.motor.automatico && m.id === estado.motor.id
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={escolhido}
              onClick={() => void escolher(m.id, m.modelos[0].id)}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                escolhido ? "border-primary bg-primary/6" : "border-border hover:bg-muted/60"
              )}
            >
              {escolhido ? (
                <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
              ) : (
                <CircleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
              )}
              <span className="flex min-w-0 grow flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {m.nome}
                  <span className="rounded-[4px] border border-border/80 bg-muted/40 px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                    {REQUER[m.requer]}
                  </span>
                  {m.disponivel ? (
                    <span className="text-xs font-normal text-bom">funciona aqui</span>
                  ) : (
                    <span className="text-xs font-normal text-muted-foreground">{m.motivo}</span>
                  )}
                </span>
                <span className="text-[13px] text-muted-foreground">{m.descricao}</span>
              </span>
            </button>
          )
        })}
      </div>

      {atual?.requer === "chave" && !estado.motor.automatico && (
        <Field>
          <FieldLabel htmlFor="chave">Chave de API {atual.nome === "OpenAI" ? "da OpenAI" : `do ${atual.nome}`}</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="chave"
              type="password"
              autoComplete="off"
              placeholder={atual.disponivel ? "Já tem uma salva. Cole outra para trocar." : "Cole a chave aqui"}
              value={chave}
              onChange={(e) => setChave(e.target.value)}
            />
            <Button type="button" onClick={() => void salvarChave()} disabled={!chave.trim()}>
              Salvar
            </Button>
          </div>
          <FieldDescription>Fica só neste computador, em ~/.sabia. Nunca vai para o GitHub.</FieldDescription>
        </Field>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={() => void testar()} disabled={testando || !atual?.disponivel}>
          {testando ? <LoaderIcon className="animate-spin" /> : <PlugZapIcon />}
          Testar o motor
        </Button>
        {teste && (
          <span className={cn("flex items-center gap-1.5 text-[13px]", teste.ok ? "text-bom" : "text-ruim")}>
            {teste.ok ? <CheckIcon className="size-4" /> : <XCircleIcon className="size-4" />}
            {teste.texto}
          </span>
        )}
      </div>
    </div>
  )
}

/* ------------------------------ os campos ------------------------------ */

/** Os campos que o pacote do agente declarou, agrupados como ele pediu. */
export function CamposDoAgente({
  aoSalvar,
  rotulo = "Salvar",
}: {
  aoSalvar: (e: EstadoDoServidor) => void
  /** no primeiro uso o botão salva e avança: "Salvar e continuar" */
  rotulo?: string
}) {
  const [campos, setCampos] = useState<CampoPreenchido[]>([])
  const [valores, setValores] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    void api.config().then((c) => {
      setCampos(c)
      setValores(Object.fromEntries(c.map((x) => [x.chave, x.valor])))
    })
  }, [])

  const grupos = [...new Set(campos.map((c) => c.grupo))]
  const mudou = campos.some((c) => (valores[c.chave] ?? "") !== c.valor)
  const faltaAlgo = campos.some((c) => c.obrigatorio && !c.preenchido && !(valores[c.chave] ?? "").trim())

  const salvar = async () => {
    setSalvando(true)
    // senha em branco = manter a que já está salva
    const envio = Object.fromEntries(
      campos
        .filter((c) => !c.travado && (valores[c.chave] ?? "") !== c.valor)
        .filter((c) => !(c.tipo === "senha" && !valores[c.chave] && c.preenchido))
        .map((c) => [c.chave, valores[c.chave] ?? ""])
    )
    try {
      aoSalvar(await api.salvarConfig(envio))
      const novos = await api.config()
      setCampos(novos)
      setValores(Object.fromEntries(novos.map((x) => [x.chave, x.valor])))
      toast.success("Salvo neste computador.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault()
        void salvar()
      }}
    >
      {grupos.map((g) => (
        <FieldSet key={g}>
          <FieldLegend>{g}</FieldLegend>
          <FieldGroup className="gap-4">
            {campos
              .filter((c) => c.grupo === g)
              .map((c) => (
                <Field key={c.chave}>
                  <FieldLabel htmlFor={c.chave}>
                    {c.rotulo}
                    {!c.obrigatorio && <span className="font-normal text-muted-foreground">(opcional)</span>}
                  </FieldLabel>
                  <Input
                    id={c.chave}
                    type={c.tipo === "senha" ? "password" : c.tipo === "telefone" ? "tel" : "text"}
                    autoComplete="off"
                    disabled={c.travado}
                    placeholder={
                      c.tipo === "senha" && c.preenchido ? "Já tem uma salva. Digite para trocar." : c.exemplo
                    }
                    value={valores[c.chave] ?? ""}
                    onChange={(e) => setValores((v) => ({ ...v, [c.chave]: e.target.value }))}
                  />
                  {(c.ajuda || c.travado) && (
                    <FieldDescription>
                      {c.travado ? "Definido por variável de ambiente, não dá para trocar aqui." : c.ajuda}
                    </FieldDescription>
                  )}
                </Field>
              ))}
          </FieldGroup>
        </FieldSet>
      ))}
      <Button type="submit" className="w-fit" disabled={(!mudou && rotulo === "Salvar") || faltaAlgo || salvando}>
        {salvando && <LoaderIcon className="animate-spin" />}
        {rotulo}
      </Button>
    </form>
  )
}

/* ------------------------------- conexão ------------------------------- */

/**
 * Entra nas fontes com a pessoa olhando: é aqui que o login acontece pela
 * primeira vez e, se precisar, o código de verificação.
 */
export function Conexao({ aoConectar }: { aoConectar?: () => void }) {
  const [passos, setPassos] = useState<string[]>([])
  const [situacao, setSituacao] = useState<"parado" | "conectando" | "codigo" | "ok" | "erro">("parado")
  const [erro, setErro] = useState("")

  const conectar = async () => {
    setPassos([])
    setErro("")
    setSituacao("conectando")
    try {
      await api.conectar((e) => {
        if (e.tipo === "passo") setPassos((p) => [...p, e.mensagem])
        if (e.tipo === "2fa_pedido") setSituacao("codigo")
        if (e.tipo === "2fa_fim") setSituacao("conectando")
        if (e.tipo === "conectado") {
          setSituacao("ok")
          aoConectar?.()
        }
        if (e.tipo === "erro") {
          setErro(e.mensagem)
          setSituacao("erro")
        }
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
      setSituacao("erro")
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        className="w-fit"
        variant={situacao === "ok" ? "outline" : "default"}
        onClick={() => void conectar()}
        disabled={situacao === "conectando" || situacao === "codigo"}
      >
        {situacao === "conectando" ? <LoaderIcon className="animate-spin" /> : <PlugZapIcon />}
        {situacao === "ok" ? "Conectar de novo" : "Conectar"}
      </Button>
      {passos.length > 0 && (
        <ol className="flex flex-col gap-1 border-l-2 border-border pl-3.5 text-[13px] text-muted-foreground">
          {passos.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ol>
      )}
      {situacao === "codigo" && <Codigo2FA />}
      {situacao === "ok" && (
        <p className="flex items-center gap-1.5 text-sm text-bom">
          <CheckCircle2Icon className="size-4" />
          Conectado. Pode perguntar.
        </p>
      )}
      {situacao === "erro" && <p className="text-sm text-ruim">{erro}</p>}
    </div>
  )
}
