import type { ComponentType } from "react"
import type { ItemResposta } from "@/lib/tipos"

/** O cartão que mostra o que uma ferramenta leu. */
export interface PropsDoArtefato<D = unknown> {
  dados: D
  /** os destaques da resposta: o cartão pode realçar as linhas citadas */
  itens: ItemResposta[]
}

export type Artefato = ComponentType<PropsDoArtefato>

/** Os cartões de um agente, pelo nome da ferramenta. */
export type ArtefatosDoAgente = Record<string, Artefato>

/**
 * Registra um cartão tipado. O dado chega do protocolo como `unknown`; o
 * servidor já validou com o contrato Zod da capacidade antes de enviar, e
 * a tela ainda protege cada cartão (ver ProtecaoDoCartao): se vier fora do
 * formato, cai no cartão genérico em vez de derrubar a conversa.
 */
export function cartao<D>(c: ComponentType<PropsDoArtefato<D>>): Artefato {
  return c as Artefato
}
