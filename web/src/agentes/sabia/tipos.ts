/**
 * O formato dos dados de cada capacidade, tirado do próprio contrato Zod do
 * servidor. Se o contrato mudar, o cartão da tela não compila.
 */
import type { z } from "zod"
import type { Saida as SBoletim } from "../../../../src/agentes/sabia/capacidades/boletim.ts"
import type { Saida as SCalendario } from "../../../../src/agentes/sabia/capacidades/calendario.ts"
import type { Saida as SComunicados } from "../../../../src/agentes/sabia/capacidades/comunicados.ts"
import type { Saida as SDiario } from "../../../../src/agentes/sabia/capacidades/diario.ts"
import type { Saida as SHorarios } from "../../../../src/agentes/sabia/capacidades/horarios.ts"

export type Boletim = z.infer<typeof SBoletim>
export type Calendario = z.infer<typeof SCalendario>
export type Comunicados = z.infer<typeof SComunicados>
export type Diario = z.infer<typeof SDiario>
export type Horarios = z.infer<typeof SHorarios>
