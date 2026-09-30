import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { caminhos } from "./config.ts";
import type { Conversa, ResumoDeConversa, Turno } from "./protocolo.ts";

/* ==================================================================
 * As conversas, uma por arquivo em ~/.sabia/conversas.
 *
 * Antes o histórico era um Map em memória: reiniciar o servidor apagava
 * tudo, e a barra lateral não tinha o que mostrar. Os arquivos ficam no
 * home da pessoa (têm dado real dentro), nunca no projeto.
 * ================================================================== */

/** id só com letra, número e hífen: nada de "../" virando caminho */
const ID_VALIDO = /^[a-z0-9-]{8,64}$/;

function arquivo(id: string): string {
  if (!ID_VALIDO.test(id)) throw new Error("id de conversa inválido");
  return path.join(caminhos.conversas(), `${id}.json`);
}

function gravar(c: Conversa) {
  fs.mkdirSync(caminhos.conversas(), { recursive: true, mode: 0o700 });
  fs.writeFileSync(arquivo(c.id), JSON.stringify(c), { mode: 0o600 });
}

/** O título é a primeira pergunta, cortada numa palavra inteira. */
export function tituloDe(pergunta: string, max = 48): string {
  const limpo = pergunta.replace(/\s+/g, " ").trim();
  if (limpo.length <= max) return limpo;
  const corte = limpo.slice(0, max);
  return `${corte.slice(0, corte.lastIndexOf(" ") > 20 ? corte.lastIndexOf(" ") : max)}…`;
}

export function ler(id: string): Conversa | null {
  try {
    return JSON.parse(fs.readFileSync(arquivo(id), "utf8")) as Conversa;
  } catch {
    return null;
  }
}

export function listar(): ResumoDeConversa[] {
  let nomes: string[] = [];
  try {
    nomes = fs.readdirSync(caminhos.conversas()).filter((n) => n.endsWith(".json"));
  } catch {
    return [];
  }
  return nomes
    .map((n) => ler(n.slice(0, -5)))
    .filter((c): c is Conversa => c !== null)
    .map(({ id, titulo, atualizadaEm }) => ({ id, titulo, atualizadaEm }))
    .sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm));
}

export function criar(primeiraPergunta: string): Conversa {
  const agora = new Date().toISOString();
  const c: Conversa = {
    id: crypto.randomUUID(),
    titulo: tituloDe(primeiraPergunta),
    criadaEm: agora,
    atualizadaEm: agora,
    turnos: [],
  };
  gravar(c);
  return c;
}

export function salvarTurno(id: string, turno: Turno) {
  const c = ler(id);
  if (!c) throw new Error("conversa não encontrada");
  c.turnos.push(turno);
  c.atualizadaEm = new Date().toISOString();
  gravar(c);
}

export function renomear(id: string, titulo: string) {
  const c = ler(id);
  if (!c) return false;
  c.titulo = titulo.trim().slice(0, 80) || c.titulo;
  gravar(c);
  return true;
}

export function apagar(id: string) {
  fs.rmSync(arquivo(id), { force: true });
}

/** As perguntas anteriores e o assunto de cada uma, para "e em física?". */
export function historicoDe(c: Conversa): { pergunta: string; intencao: string }[] {
  return c.turnos.flatMap((t) => {
    const plano = t.eventos.find((e) => e.tipo === "plano");
    return plano && plano.tipo === "plano" ? [{ pergunta: t.pergunta, intencao: plano.intencao }] : [];
  });
}
