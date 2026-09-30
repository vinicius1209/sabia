import type {
  CampoPreenchido,
  Conversa,
  EstadoDoServidor,
  EventoDoTurno,
  InfoDoAgente,
  ResumoDeConversa,
} from "./tipos"

async function json<T>(caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(caminho, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  })
  const corpo = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((corpo as { erro?: string }).erro ?? `Erro ${r.status}`)
  return corpo as T
}

const post = <T,>(caminho: string, corpo: object = {}) =>
  json<T>(caminho, { method: "POST", body: JSON.stringify(corpo) })

/**
 * Lê um fluxo SSE que vem na resposta de um POST. O EventSource do
 * navegador só faz GET, por isso a leitura é feita à mão.
 */
async function fluxo<E>(caminho: string, corpo: object, aoEvento: (e: E) => void, sinal?: AbortSignal) {
  const r = await fetch(caminho, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
    signal: sinal,
  })
  if (!r.ok || !r.body) {
    const erro = await r.json().catch(() => ({ erro: `Erro ${r.status}` }))
    throw new Error((erro as { erro?: string }).erro ?? `Erro ${r.status}`)
  }
  const leitor = r.body.pipeThrough(new TextDecoderStream()).getReader()
  let resto = ""
  for (;;) {
    const { value, done } = await leitor.read()
    if (done) break
    resto += value
    const blocos = resto.split("\n\n")
    resto = blocos.pop() ?? ""
    for (const b of blocos) {
      if (b.startsWith("data: ")) aoEvento(JSON.parse(b.slice(6)) as E)
    }
  }
}

export type EventoDeConexao =
  | { tipo: "passo"; mensagem: string }
  | { tipo: "2fa_pedido" }
  | { tipo: "2fa_fim"; motivo: "ok" | "cancelado" | "expirou" }
  | { tipo: "conectado" }
  | { tipo: "erro"; mensagem: string }

export const api = {
  agente: () => json<InfoDoAgente>("/api/agente"),
  estado: () => json<EstadoDoServidor>("/api/estado"),
  config: () => json<CampoPreenchido[]>("/api/config"),
  salvarConfig: (valores: Record<string, string>) => post<EstadoDoServidor>("/api/config", { valores }),
  escolherMotor: (id: string, modelo: string) => post<EstadoDoServidor>("/api/motor", { id, modelo }),
  testarMotor: () =>
    post<{ ok: true; duracaoMs: number; motor: string } | { ok: false; erro: string }>("/api/motor/testar"),
  conversas: () => json<ResumoDeConversa[]>("/api/conversas"),
  conversa: (id: string) => json<Conversa>(`/api/conversas/${id}`),
  renomear: (id: string, titulo: string) =>
    json<{ ok: boolean }>(`/api/conversas/${id}`, { method: "PATCH", body: JSON.stringify({ titulo }) }),
  apagar: (id: string) => json<{ ok: boolean }>(`/api/conversas/${id}`, { method: "DELETE" }),
  perguntar: (
    corpo: { pergunta: string; conversa?: string },
    aoEvento: (e: EventoDoTurno) => void,
    sinal?: AbortSignal
  ) => fluxo<EventoDoTurno>("/api/perguntar", corpo, aoEvento, sinal),
  conectar: (aoEvento: (e: EventoDeConexao) => void) => fluxo<EventoDeConexao>("/api/conectar", {}, aoEvento),
  parar: () => post<{ parado: boolean }>("/api/parar"),
  aceitarEstrutura: (capacidade: string) => post<EstadoDoServidor>(`/api/estruturas/${capacidade}/aceitar`),
  codigo2fa: (codigo: string) => post<{ ok: true }>("/api/2fa", { codigo }),
  cancelar2fa: () => post<{ cancelado: boolean }>("/api/2fa/cancelar"),
}
