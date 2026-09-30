import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { home } from "./config.ts";

/* ==================================================================
 * A "impressão digital" da FORMA de cada fonte.
 *
 * O agente lê sistemas que não foram feitos para ele: um dia a escola
 * acrescenta uma coluna, renomeia um cabeçalho, troca a tela. A leitura
 * já recusa o que não reconhece; isto aqui avisa QUE mudou, e desde
 * quando, antes de alguém descobrir na frente da turma.
 *
 * Guarda só a forma (nomes de colunas, marcadores da página), nunca
 * valores: nada de nota, nome ou data sai daqui.
 * ================================================================== */

interface Base {
  assinatura: string;
  descricao: string;
  vistaEm: string;
}

export interface Mudanca {
  capacidade: string;
  /** quando a forma nova apareceu pela primeira vez */
  desde: string;
  antes: string;
  agora: string;
}

interface Arquivo {
  base: Record<string, Base>;
  mudancas: Record<string, Mudanca>;
}

const arquivo = () => path.join(home(), "estruturas.json");

function ler(): Arquivo {
  try {
    const a = JSON.parse(fs.readFileSync(arquivo(), "utf8")) as Partial<Arquivo>;
    return { base: a.base ?? {}, mudancas: a.mudancas ?? {} };
  } catch {
    return { base: {}, mudancas: {} };
  }
}

function gravar(a: Arquivo) {
  fs.mkdirSync(home(), { recursive: true, mode: 0o700 });
  fs.writeFileSync(arquivo(), JSON.stringify(a, null, 2) + "\n", { mode: 0o600 });
}

const assinar = (descricao: string) => crypto.createHash("sha256").update(descricao).digest("hex").slice(0, 16);

/**
 * Compara a forma lida agora com a conhecida.
 *   "nova"   primeira vez: vira a referência
 *   "igual"  bate com a referência (e, se tinha aviso, ele some sozinho)
 *   "mudou"  diferente: o aviso fica até alguém confirmar que conferiu
 */
export function conferirEstrutura(capacidade: string, descricao: string, agora = new Date()): "nova" | "igual" | "mudou" {
  const a = ler();
  const assinatura = assinar(descricao);
  const base = a.base[capacidade];
  if (!base) {
    a.base[capacidade] = { assinatura, descricao, vistaEm: agora.toISOString() };
    gravar(a);
    return "nova";
  }
  if (base.assinatura === assinatura) {
    base.vistaEm = agora.toISOString();
    delete a.mudancas[capacidade];
    gravar(a);
    return "igual";
  }
  a.mudancas[capacidade] = {
    capacidade,
    desde: a.mudancas[capacidade]?.desde ?? agora.toISOString(),
    antes: base.descricao,
    agora: descricao,
  };
  gravar(a);
  return "mudou";
}

/** As formas conhecidas, com a última vez que cada uma foi vista. */
export function formasConhecidas(): Record<string, { vistaEm: string }> {
  return Object.fromEntries(Object.entries(ler().base).map(([k, v]) => [k, { vistaEm: v.vistaEm }]));
}

export function mudancas(): Mudanca[] {
  return Object.values(ler().mudancas);
}

/** Alguém conferiu a forma nova: ela vira a referência, e o aviso some. */
export function aceitarEstrutura(capacidade: string): boolean {
  const a = ler();
  const m = a.mudancas[capacidade];
  if (!m) return false;
  a.base[capacidade] = { assinatura: assinar(m.agora), descricao: m.agora, vistaEm: new Date().toISOString() };
  delete a.mudancas[capacidade];
  gravar(a);
  return true;
}
