import { Fragment, useState } from "react"
import { ArrowUpRightIcon, ChevronRightIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cartao, type ArtefatosDoAgente, type PropsDoArtefato } from "@/components/artefatos/tipos"
import type { ItemResposta } from "@/lib/tipos"
import { cn } from "@/lib/utils"
import type { Boletim, Calendario, Comunicados, Diario, Horarios } from "./tipos"

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()

/**
 * A linha foi citada na resposta? Aí ela aparece realçada no cartão.
 * Só com nome igual ("Biologia" não acende "Estudos Avançados em Biologia"),
 * e só quando a resposta aponta poucas linhas: realçar 11 de 16 não destaca nada.
 */
function citado(itens: ItemResposta[], texto: string) {
  if (itens.length > 4) return false
  const limpo = (s: string) => semAcento(s).replace(/\s*\*$/, "")
  const t = limpo(texto)
  return itens.some((i) => limpo(i.rotulo) === t)
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

/* ------------------------------- boletim ------------------------------ */

function CartaoBoletim({ dados, itens }: PropsDoArtefato<Boletim>) {
  const [aberta, setAberta] = useState<string | null>(null)
  if (dados.formato === "indisponivel") {
    return (
      <div className="flex flex-col gap-1.5 text-sm">
        <p className="font-medium">Não deu para ler o boletim com segurança.</p>
        <p className="text-muted-foreground">{dados.motivo}</p>
        {dados.colunasEncontradas.length > 0 && (
          <p className="text-xs text-muted-foreground">Colunas encontradas: {dados.colunasEncontradas.join(", ")}</p>
        )}
      </div>
    )
  }
  // de onde são as médias: quase sempre todas do mesmo lugar ("1º semestre")
  const origens = [...new Set(dados.notas.map((n) => n.mediaDe).filter((d) => d !== "sem média"))]
  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Disciplina</TableHead>
            <TableHead className="w-24 text-right">Média</TableHead>
            <TableHead className="w-28 text-right">Faltas no ano</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dados.notas.map((n) => {
            const destaque = citado(itens, n.disciplina)
            const parciais = [
              ["1º semestre", n.semestre1],
              ["2º semestre", n.semestre2],
            ] as const
            const temParcial = parciais.some(([, s]) => s.avaliacoes.length > 0)
            const estaAberta = aberta === n.disciplina
            return (
              <Fragment key={n.disciplina}>
                <TableRow
                  className={cn(destaque && "bg-primary/8 hover:bg-primary/12", temParcial && "cursor-pointer")}
                  onClick={() => temParcial && setAberta(estaAberta ? null : n.disciplina)}
                  aria-expanded={temParcial ? estaAberta : undefined}
                >
                  <TableCell className={cn("whitespace-normal", destaque && "font-medium")}>
                    <span className="flex items-center gap-1.5">
                      {temParcial && (
                        <ChevronRightIcon
                          className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", estaAberta && "rotate-90")}
                        />
                      )}
                      {n.disciplina}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {n.media}
                    {origens.length > 1 && n.mediaDe !== "sem média" && (
                      <span className="block text-[11px] font-normal text-muted-foreground">{n.mediaDe}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{n.faltasTotal}</TableCell>
                </TableRow>
                {estaAberta && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={3} className="whitespace-normal bg-muted/40 py-2.5">
                      {parciais
                        .filter(([, s]) => s.avaliacoes.length > 0)
                        .map(([nome, s]) => (
                          <p key={nome} className="text-[13px] text-muted-foreground">
                            <span className="font-medium text-foreground">{nome}:</span>{" "}
                            {s.avaliacoes.map((a) => `${a.sigla} ${a.valor}`).join(" · ")}
                            {s.media ? ` · média ${s.media}` : " · média ainda não fechou"}
                          </p>
                        ))}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        {origens.length === 1
          ? origens[0].includes("semestre")
            ? `Médias do ${origens[0]}. `
            : `Médias: ${origens[0]}. `
          : ""}
        Clique numa disciplina para ver as avaliações. Uma nota parcial baixa pode ter sido substituída pela
        recuperação.
      </p>
      {dados.legenda.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">Legenda do boletim</summary>
          <ul className="mt-1.5 flex flex-col gap-0.5 pl-1">
            {dados.legenda.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

/* ------------------------------ calendário ----------------------------- */

function CartaoCalendario({ dados }: PropsDoArtefato<Calendario>) {
  const proxima = dados.eventos.find((e) => !e.passou)
  return (
    <ol className="flex flex-col">
      {dados.eventos.map((e, i) => {
        const [, mes, dia] = e.data.split("-")
        const ehProxima = e === proxima
        return (
          <li
            key={`${e.data}-${i}`}
            className={cn(
              "flex items-center gap-3 border-b border-border/60 py-2 last:border-0",
              e.passou && "opacity-55"
            )}
          >
            <span
              className={cn(
                "flex w-11 shrink-0 flex-col items-center rounded-md py-1 leading-none",
                ehProxima ? "bg-primary text-primary-foreground" : "bg-muted"
              )}
            >
              <span className="text-base font-semibold tabular-nums">{dia ?? e.dia}</span>
              <span className="text-[10px] uppercase tracking-wide">{mes ? MESES[Number(mes) - 1] : ""}</span>
            </span>
            <span className="min-w-0 grow text-sm">{e.evento}</span>
            {ehProxima && <Badge>próxima</Badge>}
            {e.passou && <span className="shrink-0 text-xs text-muted-foreground">já passou</span>}
          </li>
        )
      })}
    </ol>
  )
}

/* ------------------------------ comunicados ---------------------------- */

function CartaoComunicados({ dados }: PropsDoArtefato<Comunicados>) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col">
        {dados.comunicados.map((c, i) => (
          <li key={`${c.titulo}-${i}`} className="border-b border-border/60 py-2 last:border-0">
            <div className="flex items-start gap-2">
              <span className="min-w-0 grow text-sm font-medium">{c.titulo}</span>
              {c.href && (
                <a
                  href={c.href.startsWith("http") ? c.href : `https://classapp.com.br${c.href}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label={`Abrir "${c.titulo}" no ClassApp`}
                >
                  <ArrowUpRightIcon className="size-4" />
                </a>
              )}
            </div>
            {c.detalhe && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{c.detalhe}</p>}
          </li>
        ))}
      </ul>
      {dados.conteudoDoMaisRecente && (
        <div className="rounded-lg bg-muted/60 p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            O mais recente, na íntegra
          </p>
          <p className="line-clamp-6 whitespace-pre-wrap text-sm">{dados.conteudoDoMaisRecente}</p>
        </div>
      )}
    </div>
  )
}

/* ------------------------------- horários ------------------------------ */

function CartaoHorarios({ dados }: PropsDoArtefato<Horarios>) {
  const inicial = dados.grade.find((d) => d.ehHoje) ?? dados.grade.find((d) => d.ehAmanha) ?? dados.grade[0]
  const [dia, setDia] = useState(inicial?.dia ?? "")
  const atual = dados.grade.find((d) => d.dia === dia) ?? inicial
  if (!atual) return <p className="text-sm text-muted-foreground">A grade veio vazia.</p>
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Dia da semana">
        {dados.grade.map((d) => (
          <button
            key={d.dia}
            type="button"
            role="tab"
            aria-selected={d.dia === atual.dia}
            onClick={() => setDia(d.dia)}
            className={cn(
              "h-7 rounded-full border px-3 text-xs transition-colors",
              d.dia === atual.dia
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted"
            )}
          >
            {d.dia}
            {d.ehHoje && " · hoje"}
            {d.ehAmanha && " · amanhã"}
          </button>
        ))}
      </div>
      <ol className="flex flex-col">
        {atual.aulas.map((a, i) => (
          <li key={`${a.horario}-${i}`} className="flex items-baseline gap-3 border-b border-border/60 py-1.5 last:border-0">
            <span className="w-28 shrink-0 text-xs tabular-nums text-muted-foreground">
              {a.horario.replace(/^M\d+\s*-\s*/, "")}
            </span>
            <span className="text-sm">{a.disciplina}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/* -------------------------------- diário ------------------------------- */

function CartaoDiario({ dados, itens }: PropsDoArtefato<Diario>) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">Diário de {dados.data}</p>
      <ul className="flex flex-col">
        {dados.disciplinas.map((d, i) => (
          <li
            key={`${d.disciplina}-${i}`}
            className={cn(
              "border-b border-border/60 py-2 last:border-0",
              citado(itens, d.disciplina) && "rounded-md bg-primary/8 px-2"
            )}
          >
            <div className="flex items-center gap-2">
              <span className="grow text-sm font-medium">{d.disciplina}</span>
              {d.temTarefa ? (
                <Badge>tarefa</Badge>
              ) : (
                <span className="text-xs text-muted-foreground">sem tarefa</span>
              )}
            </div>
            {d.temTarefa && <p className="mt-1 text-sm">{d.tarefas}</p>}
            {d.conteudo && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{d.conteudo}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}

export const artefatosDoSabia: ArtefatosDoAgente = {
  ler_boletim: cartao(CartaoBoletim),
  ler_calendario: cartao(CartaoCalendario),
  ler_comunicados: cartao(CartaoComunicados),
  ler_horarios: cartao(CartaoHorarios),
  ler_diario: cartao(CartaoDiario),
}
