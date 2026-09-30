import { useState } from "react"
import { EllipsisIcon, MoonIcon, PencilIcon, PlusIcon, Settings2Icon, SunIcon, Trash2Icon } from "lucide-react"
import { Mascote } from "@/components/mascote"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { Sabia } from "@/hooks/use-sabia"
import type { EstadoDoServidor, InfoDoAgente, ResumoDeConversa } from "@/lib/tipos"

const GRUPOS = ["Hoje", "Ontem", "Últimos 7 dias", "Mais antigas"] as const

function grupoDe(iso: string): (typeof GRUPOS)[number] {
  const dia = new Date(iso)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const dias = Math.floor((hoje.getTime() - new Date(dia).setHours(0, 0, 0, 0)) / 86_400_000)
  return dias <= 0 ? "Hoje" : dias === 1 ? "Ontem" : dias < 7 ? "Últimos 7 dias" : "Mais antigas"
}

const item = "h-8 gap-2.5 rounded-md px-2.5 text-[13px]"

export function BarraLateral({
  sabia,
  info,
  estado,
  aoAbrirAjustes,
}: {
  sabia: Sabia
  info: InfoDoAgente
  estado: EstadoDoServidor
  aoAbrirAjustes: () => void
}) {
  const { theme, setTheme } = useTheme()
  const escuro =
    theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  const [renomeando, setRenomeando] = useState<string | null>(null)
  const [nome, setNome] = useState("")

  const confirmar = () => {
    if (renomeando && nome.trim()) void sabia.renomear(renomeando, nome.trim())
    setRenomeando(null)
  }

  const porGrupo = new Map<string, ResumoDeConversa[]>()
  for (const c of sabia.conversas) {
    const g = grupoDe(c.atualizadaEm)
    porGrupo.set(g, [...(porGrupo.get(g) ?? []), c])
  }

  return (
    <Sidebar collapsible="offcanvas" className="border-sidebar-border">
      <SidebarHeader className="gap-3 px-3 pt-3 pb-1">
        <div className="flex items-center gap-2.5 px-1">
          <Mascote info={info} estado={sabia.emAndamento ? "pensando" : "ocioso"} className="size-9 shrink-0" />
          <div className="flex min-w-0 flex-col">
            <span className="text-[15px] font-semibold leading-tight">{info.nome}</span>
            {info.contexto && (
              <span className="line-clamp-2 text-xs text-muted-foreground">{info.contexto}</span>
            )}
          </div>
        </div>
        <Button className="h-8.5 rounded-lg text-[13px]" onClick={sabia.nova} disabled={sabia.emAndamento}>
          <PlusIcon className="size-3.5" />
          Nova conversa
        </Button>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-3 pt-2">
        {!sabia.conversas.length && (
          <p className="px-2 py-3 text-[13px] text-muted-foreground">
            As conversas ficam salvas aqui, só neste computador.
          </p>
        )}
        {GRUPOS.map((g) => {
          const lista = porGrupo.get(g)
          if (!lista?.length) return null
          return (
            <SidebarGroup key={g} className="p-0 pb-2">
              <SidebarGroupLabel className="h-5 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                {g}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {lista.map((c) => (
                    <SidebarMenuItem key={c.id}>
                      {renomeando === c.id ? (
                        <input
                          aria-label="Nome da conversa"
                          autoFocus
                          className="h-7 w-full rounded-md border border-primary bg-background px-2 text-[13px] outline-none ring-3 ring-primary/20"
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onBlur={confirmar}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmar()
                            if (e.key === "Escape") setRenomeando(null)
                          }}
                        />
                      ) : (
                        <>
                          <SidebarMenuButton
                            className="h-7 px-2 text-[13px] data-active:bg-sidebar-accent"
                            isActive={c.id === sabia.aberta.id}
                            onClick={() => void sabia.abrir(c.id)}
                            disabled={sabia.emAndamento}
                          >
                            <span>{c.titulo}</span>
                          </SidebarMenuButton>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <SidebarMenuAction
                                  aria-label="Opções da conversa"
                                  className="top-1! text-muted-foreground"
                                  showOnHover
                                />
                              }
                            >
                              <EllipsisIcon className="size-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" side="bottom" sideOffset={6} className="w-44 rounded-xl p-1.5">
                              <DropdownMenuGroup>
                                <DropdownMenuItem
                                  className={item}
                                  onClick={() => {
                                    setRenomeando(c.id)
                                    setNome(c.titulo)
                                  }}
                                >
                                  <PencilIcon />
                                  Renomear
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                              <DropdownMenuSeparator className="my-1" />
                              <DropdownMenuItem
                                className={item}
                                variant="destructive"
                                onClick={() => void sabia.apagar(c.id)}
                              >
                                <Trash2Icon />
                                Apagar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      <SidebarFooter className="gap-1 border-t border-sidebar-border p-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" className="h-8 grow justify-start gap-2 px-2 text-[13px]" onClick={aoAbrirAjustes}>
            <Settings2Icon className="size-4" />
            <span className="flex min-w-0 flex-col items-start leading-tight">
              <span>Ajustes</span>
              <span className="truncate text-[11px] text-muted-foreground">{estado.motor.nome}</span>
            </span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={escuro ? "Usar tema claro" : "Usar tema escuro"}
            onClick={() => setTheme(escuro ? "light" : "dark")}
          >
            {escuro ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
