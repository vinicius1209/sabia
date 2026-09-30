import type { EstadoDoAgente, EventoDoTurno, ItemResposta, MetaFerramenta, Turno } from "./tipos"

/** Um turno na tela: o que foi salvo, mais o que só existe ao vivo. */
export interface TurnoVivo {
  id: string
  pergunta: string
  eventos: EventoDoTurno[]
  /** o texto da resposta enquanto o modelo ainda escreve */
  parcial: string
  ativo: boolean
  inicio: number
  /** o agente parou pedindo o código de verificação */
  esperandoCodigo: boolean
}

export interface FerramentaNoTurno extends MetaFerramenta {
  emAndamento: boolean
  /** o que a ferramenta foi fazendo enquanto lia ("Abrindo o boletim") */
  passos: string[]
  ok?: boolean
  resumo?: string
  dados?: unknown
}

export type LinhaDaTrilha =
  | { tipo: "passo"; texto: string }
  | { tipo: "plano"; texto: string }
  | { tipo: "ferramenta"; ferramenta: FerramentaNoTurno }

export interface VistaDoTurno {
  estado: EstadoDoAgente
  trilha: LinhaDaTrilha[]
  ferramentas: FerramentaNoTurno[]
  /** a última linha de progresso, para o "Lendo as notas…" ao vivo */
  agora: string
  texto: string
  itens: ItemResposta[]
  fonte?: string
  motor?: string
  duracaoMs?: number
  erro?: string
}

export function doSalvo(t: Turno): TurnoVivo {
  return {
    id: t.id,
    pergunta: t.pergunta,
    eventos: t.eventos,
    parcial: "",
    ativo: false,
    inicio: Date.parse(t.criadoEm),
    esperandoCodigo: false,
  }
}

/**
 * Tudo que a tela mostra de um turno sai da lista de eventos. Ao vivo e ao
 * reabrir uma conversa salva, a mesma função: a tela não tem dois jeitos de
 * desenhar a mesma coisa.
 */
export function vistaDo(t: TurnoVivo): VistaDoTurno {
  const trilha: LinhaDaTrilha[] = []
  const ferramentas: FerramentaNoTurno[] = []
  let agora = "Entendendo a pergunta"
  let resposta: Extract<EventoDoTurno, { tipo: "resposta" }> | undefined
  let erro: string | undefined

  for (const e of t.eventos) {
    switch (e.tipo) {
      case "passo": {
        // passo dado enquanto uma ferramenta lê pertence a ela, não à trilha solta
        const lendo = ferramentas.find((f) => f.emAndamento)
        if (lendo) lendo.passos.push(e.mensagem)
        else trilha.push({ tipo: "passo", texto: e.mensagem })
        agora = e.mensagem
        break
      }
      case "plano":
        trilha.push({ tipo: "plano", texto: e.mensagem })
        agora = e.mensagem
        break
      case "ferramenta_inicio": {
        const f: FerramentaNoTurno = {
          nome: e.nome,
          rotulo: e.rotulo,
          fonte: e.fonte,
          icone: e.icone,
          emAndamento: true,
          passos: [],
        }
        ferramentas.push(f)
        trilha.push({ tipo: "ferramenta", ferramenta: f })
        break
      }
      case "ferramenta_fim": {
        const f = [...ferramentas].reverse().find((x) => x.nome === e.nome && x.emAndamento)
        if (f) Object.assign(f, { emAndamento: false, ok: e.ok, resumo: e.resumo, dados: e.dados })
        break
      }
      case "resposta":
        resposta = e
        break
      case "erro":
        erro = e.mensagem
        break
    }
  }

  const buscando = ferramentas.some((f) => f.emAndamento)
  const estado: EstadoDoAgente = erro
    ? "erro"
    : t.esperandoCodigo
      ? "aguardando"
      : resposta
        ? "pronto"
        : buscando
          ? "buscando"
          : t.ativo
            ? "pensando"
            : "ocioso"

  return {
    estado,
    trilha,
    ferramentas,
    agora,
    texto: resposta?.resposta ?? t.parcial,
    itens: resposta?.itens ?? [],
    fonte: resposta && resposta.fonte !== "nenhuma" ? resposta.fonte : undefined,
    motor: resposta?.motor,
    duracaoMs: resposta?.duracaoMs,
    erro,
  }
}

/** "31s", "1min 5s" */
export function duracao(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${s % 60}s`
}
