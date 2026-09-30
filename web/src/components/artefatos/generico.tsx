import type { PropsDoArtefato } from "./tipos"

/** Quando o pacote não traz cartão próprio: o dado cru, legível. */
export function ArtefatoGenerico({ dados }: PropsDoArtefato) {
  return (
    <pre className="max-h-72 overflow-auto rounded-lg bg-muted/60 p-3 font-mono text-xs/5 text-muted-foreground">
      {JSON.stringify(dados, null, 2)}
    </pre>
  )
}
