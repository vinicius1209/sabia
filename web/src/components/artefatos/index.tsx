import { Component, type ReactNode } from "react"
import { artefatosDoSabia } from "@/agentes/sabia/artefatos"
import type { ItemResposta } from "@/lib/tipos"
import { ArtefatoGenerico } from "./generico"
import type { ArtefatosDoAgente } from "./tipos"

/**
 * Os cartões de cada pacote de agente, pelo id do pacote. Um pacote novo
 * funciona sem entrada aqui: as ferramentas dele caem no cartão genérico.
 */
const POR_AGENTE: Record<string, ArtefatosDoAgente> = {
  sabia: artefatosDoSabia,
}

/** Se o cartão quebrar com um dado inesperado, mostra o dado cru. */
class ProtecaoDoCartao extends Component<{ dados: unknown; children: ReactNode }, { quebrou: boolean }> {
  state = { quebrou: false }
  static getDerivedStateFromError() {
    return { quebrou: true }
  }
  render() {
    return this.state.quebrou ? <ArtefatoGenerico dados={this.props.dados} itens={[]} /> : this.props.children
  }
}

export function CartaoDaFerramenta({
  agente,
  ferramenta,
  dados,
  itens,
}: {
  agente: string
  ferramenta: string
  dados: unknown
  itens: ItemResposta[]
}) {
  const Cartao = POR_AGENTE[agente]?.[ferramenta] ?? ArtefatoGenerico
  return (
    <ProtecaoDoCartao dados={dados}>
      <Cartao dados={dados} itens={itens} />
    </ProtecaoDoCartao>
  )
}
