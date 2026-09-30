/* ==================================================================
 * Contexto temporal do agente.
 *
 * Um modelo de linguagem NAO sabe que horas sao. Se a gente nao contar,
 * ele chuta, e chute vira "sua proxima prova foi dia 9" com hoje sendo 26.
 *
 * Este modulo e a unica fonte de "agora" do sistema. Tudo que depende de
 * tempo (o prompt, o calculo de "ja passou") sai daqui, no fuso da escola.
 * ================================================================== */

export const FUSO = "America/Sao_Paulo";

export interface Agora {
  /** 2026-09-26 */
  iso: string;
  /** sexta-feira, 26 de setembro de 2026 */
  porExtenso: string;
  /** 20:43 */
  hora: string;
  /** meia-noite de hoje, para comparar datas sem o horario atrapalhar */
  inicioDoDia: Date;
}

let congelado: Date | null = null;

/**
 * Congela o "agora" (ex.: "2026-09-26T10:00:00-03:00"), para o benchmark e os
 * testes, que usam dados fictícios de uma data fixa: sem isso, o cabeçalho
 * dizia a data real e os dados eram de outro dia, e o modelo "errava" por
 * culpa do teste. Sem valor, volta ao relógio real. Valor inválido é erro,
 * nunca a data real calada. (Na linha de comando: SABIA_AGORA, ver cli.ts.)
 */
export function congelarRelogio(quando?: string): void {
  if (!quando) {
    congelado = null;
    return;
  }
  const d = new Date(quando);
  if (Number.isNaN(d.getTime())) throw new Error(`Data inválida para o relógio: "${quando}" (use 2026-09-26T10:00:00-03:00)`);
  congelado = d;
}

const relogio = (): Date => (congelado ? new Date(congelado) : new Date());

export function agora(): Agora {
  const d = relogio();

  // as partes no fuso da escola, nao no fuso da maquina
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const pega = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  const iso = `${pega("year")}-${pega("month")}-${pega("day")}`;

  return {
    iso,
    porExtenso: d.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: FUSO,
    }),
    hora: d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: FUSO,
    }),
    inicioDoDia: new Date(`${iso}T00:00:00`),
  };
}

const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/**
 * Tabela dos dias ao redor de hoje, já com dia da semana e data escrita.
 *
 * Para perguntas como "tarefa de segunda passada" o modelo precisa virar
 * "segunda" numa data. Pedir para ele CALCULAR isso é o mesmo erro do
 * "próxima prova dia 9": modelo erra conta de data. Com a tabela, virar
 * "segunda" em data é só procurar numa lista.
 */
export function tabelaDeDias(base: Date = agora().inicioDoDia, antes = 7, depois = 7): string {
  const linhas: string[] = [];
  for (let d = -antes; d <= depois; d++) {
    const dia = new Date(base);
    dia.setDate(base.getDate() + d);
    const dd = String(dia.getDate()).padStart(2, "0");
    const mm = String(dia.getMonth() + 1).padStart(2, "0");
    const rotulo = d === 0 ? " (HOJE)" : d === -1 ? " (ontem)" : d === 1 ? " (amanhã)" : "";
    linhas.push(`${DIAS_SEMANA[dia.getDay()]} ${dd}/${mm}/${dia.getFullYear()}${rotulo}`);
  }
  return linhas.join("\n");
}

/** Frase pronta para entrar no prompt, sempre igual em todas as fases. */
export function cabecalhoTemporal(): string {
  const a = agora();
  return (
    `Agora sao ${a.hora} de ${a.porExtenso} (data de hoje: ${a.iso}, fuso ${FUSO}).\n` +
    `Dias ao redor de hoje, para converter "segunda passada", "ontem" etc em data ` +
    `(consulte a lista, nao calcule):\n${tabelaDeDias()}`
  );
}
