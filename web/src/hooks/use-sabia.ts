import { useCallback, useEffect, useRef, useState } from "react"
import { api } from "@/lib/api"
import type { EstadoDoServidor, InfoDoAgente, ResumoDeConversa } from "@/lib/tipos"
import { doSalvo, type TurnoVivo } from "@/lib/turno"

export interface ConversaAberta {
  /** vazio enquanto a primeira pergunta não criou a conversa no servidor */
  id: string
  titulo: string
  turnos: TurnoVivo[]
}

const VAZIA: ConversaAberta = { id: "", titulo: "", turnos: [] }

/** o id da conversa aberta fica na URL (#id): recarregar a página não perde o lugar */
const idDaUrl = () => {
  const h = window.location.hash.slice(1)
  // só id de conversa de verdade (UUID); #mascotes e afins não são conversa
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(h) ? h : ""
}

export function useSabia() {
  const [info, setInfo] = useState<InfoDoAgente | null>(null)
  const [estado, setEstado] = useState<EstadoDoServidor | null>(null)
  const [conversas, setConversas] = useState<ResumoDeConversa[]>([])
  const [aberta, setAberta] = useState<ConversaAberta>(VAZIA)
  const [erroDeCarga, setErroDeCarga] = useState<string | null>(null)
  const enviando = useRef<AbortController | null>(null)

  const recarregarEstado = useCallback(async () => {
    const e = await api.estado()
    setEstado(e)
    return e
  }, [])

  /** saudação e contexto dependem da config (nome da aluna): relê quando ela muda */
  const recarregarInfo = useCallback(async () => {
    const i = await api.agente()
    setInfo(i)
    return i
  }, [])

  const recarregarConversas = useCallback(async () => {
    setConversas(await api.conversas())
  }, [])

  const abrir = useCallback(async (id: string) => {
    if (!id) {
      setAberta(VAZIA)
      history.replaceState(null, "", " ")
      return
    }
    try {
      const c = await api.conversa(id)
      setAberta({ id: c.id, titulo: c.titulo, turnos: c.turnos.map(doSalvo) })
      history.replaceState(null, "", `#${c.id}`)
    } catch {
      // conversa apagada ou id quebrado na URL: começa uma nova
      setAberta(VAZIA)
      history.replaceState(null, "", " ")
    }
  }, [])

  useEffect(() => {
    Promise.all([api.agente(), recarregarEstado(), recarregarConversas()])
      .then(([i]) => {
        setInfo(i)
        document.title = i.nome
        if (idDaUrl()) void abrir(idDaUrl())
      })
      .catch((e: unknown) => setErroDeCarga(e instanceof Error ? e.message : String(e)))
  }, [abrir, recarregarConversas, recarregarEstado])

  /** muda só o último turno da conversa aberta */
  const mudarUltimo = (fn: (t: TurnoVivo) => TurnoVivo) =>
    setAberta((c) => ({ ...c, turnos: c.turnos.map((t, i) => (i === c.turnos.length - 1 ? fn(t) : t)) }))

  const emAndamento = aberta.turnos.some((t) => t.ativo)

  const enviar = useCallback(
    async (texto: string) => {
      const pergunta = texto.trim()
      if (!pergunta || enviando.current) return
      const turno: TurnoVivo = {
        id: crypto.randomUUID(),
        pergunta,
        eventos: [],
        parcial: "",
        ativo: true,
        inicio: Date.now(),
        esperandoCodigo: false,
      }
      setAberta((c) => ({ ...c, turnos: [...c.turnos, turno] }))
      const controle = new AbortController()
      enviando.current = controle
      try {
        await api.perguntar(
          { pergunta, conversa: aberta.id || undefined },
          (e) => {
            if (e.tipo === "conversa") {
              setAberta((c) => ({ ...c, id: e.id, titulo: c.titulo || e.titulo }))
              history.replaceState(null, "", `#${e.id}`)
              return
            }
            if (e.tipo === "texto") {
              mudarUltimo((t) => ({ ...t, parcial: e.parcial }))
              return
            }
            if (e.tipo === "2fa_pedido") {
              mudarUltimo((t) => ({ ...t, esperandoCodigo: true }))
              return
            }
            if (e.tipo === "2fa_fim") {
              mudarUltimo((t) => ({ ...t, esperandoCodigo: false }))
              return
            }
            mudarUltimo((t) => ({ ...t, eventos: [...t.eventos, e] }))
          },
          controle.signal
        )
      } catch (e) {
        if (!controle.signal.aborted) {
          const mensagem = e instanceof Error ? e.message : String(e)
          mudarUltimo((t) => ({ ...t, eventos: [...t.eventos, { tipo: "erro", mensagem }] }))
        }
      } finally {
        enviando.current = null
        mudarUltimo((t) => ({ ...t, ativo: false, esperandoCodigo: false }))
        void recarregarConversas()
      }
    },
    [aberta.id, recarregarConversas]
  )

  const parar = useCallback(async () => {
    await api.parar().catch(() => {})
  }, [])

  const nova = useCallback(() => {
    if (enviando.current) return
    void abrir("")
  }, [abrir])

  const apagar = useCallback(
    async (id: string) => {
      await api.apagar(id)
      if (id === aberta.id) void abrir("")
      await recarregarConversas()
    },
    [aberta.id, abrir, recarregarConversas]
  )

  const renomear = useCallback(
    async (id: string, titulo: string) => {
      await api.renomear(id, titulo)
      if (id === aberta.id) setAberta((c) => ({ ...c, titulo }))
      await recarregarConversas()
    },
    [aberta.id, recarregarConversas]
  )

  const escolherMotor = useCallback(async (id: string, modelo: string) => {
    setEstado(await api.escolherMotor(id, modelo))
  }, [])

  return {
    info,
    estado,
    erroDeCarga,
    conversas,
    aberta,
    emAndamento,
    enviar,
    parar,
    nova,
    abrir,
    apagar,
    renomear,
    escolherMotor,
    recarregarEstado,
    recarregarInfo,
    recarregarConversas,
  }
}

export type Sabia = ReturnType<typeof useSabia>
