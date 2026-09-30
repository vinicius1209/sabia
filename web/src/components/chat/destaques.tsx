import type { ItemResposta } from "@/lib/tipos"

/**
 * Os dados em destaque da resposta. Poucos viram cartões lado a lado (uma
 * nota, uma data); muitos viram uma lista compacta, e não uma parede de
 * cartões gigantes repetindo o texto.
 */
export function Destaques({ itens }: { itens: ItemResposta[] }) {
  if (!itens.length) return null
  if (itens.length <= 4) {
    return (
      <div className="flex flex-wrap gap-2">
        {itens.map((i, n) => (
          <div key={n} className="min-w-28 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-xs">
            <p className="text-xs text-muted-foreground">{i.rotulo}</p>
            <p className="text-lg/7 font-semibold tabular-nums text-foreground">{i.valor}</p>
          </div>
        ))}
      </div>
    )
  }
  return (
    <dl className="divide-y divide-border/70 rounded-xl border border-border bg-card px-3.5 shadow-xs">
      {itens.map((i, n) => (
        <div key={n} className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-sm text-muted-foreground">{i.rotulo}</dt>
          <dd className="text-right text-sm font-medium tabular-nums">{i.valor}</dd>
        </div>
      ))}
    </dl>
  )
}
