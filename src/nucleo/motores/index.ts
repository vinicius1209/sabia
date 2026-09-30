import type { OpcaoDeMotor } from "../protocolo.ts";
import { cliInstalada, motorPorAssinatura } from "./cli.ts";
import { motorGemini } from "./gemini.ts";
import { motorLocal } from "./local.ts";
import { motorOpenAI } from "./openai.ts";
import type { DepsDoMotor, Motor } from "./tipos.ts";

export type { Motor, DepsDoMotor } from "./tipos.ts";

/* ==================================================================
 * O catálogo de motores. A tela lista estes, com o que cada um precisa
 * e se funciona nesta máquina agora.
 *
 * Medido com os casos do `npm run bench` (7 perguntas, set/2026):
 *   OpenAI gpt-6-luna (API)    7/7   ~2,5 s por chamada
 *   OpenAI gpt-4.1-mini (API)  6/7   ~1,4 s por chamada
 *   Claude Sonnet (assinatura) 6/7   ~3,5 s por chamada
 *   Claude Haiku (assinatura)  6/7   ~5 s por chamada
 *   Codex (assinatura)         7/7   ~9 s por chamada
 *   agy Gemini 3.8 Flash low   7/7   ~8 a 14 s por chamada (5 s só para subir)
 *   agy Gemini 3.8 Flash medium  estourou 2 min e devolveu fora do formato
 * O Claude Sonnet variou entre 5 e 6 de 7 em rodadas diferentes: os erros são
 * consultar uma fonte a mais, não responder errado.
 * ================================================================== */

type Catalogo = Omit<OpcaoDeMotor, "disponivel" | "motivo">;

/**
 * A ordem importa: é a ordem da tela, e o modo automático fica com a
 * primeira assinatura instalada. Assinatura antes de chave de API: a conta
 * que a pessoa já paga, em vez de gastar com chave.
 */
export const CATALOGO: Catalogo[] = [
  {
    id: "claude",
    nome: "Claude pela assinatura",
    descricao: "Usa o Claude Code logado nesta máquina. A resposta aparece enquanto é escrita.",
    requer: "assinatura",
    modelos: [
      { id: "sonnet", nome: "Sonnet", descricao: "Acertou 6 de 7 nos testes. O equilíbrio." },
      { id: "haiku", nome: "Haiku", descricao: "Acertou 6 de 7, e foi mais lento que o Sonnet." },
    ],
  },
  {
    id: "agy",
    nome: "Antigravity pela assinatura",
    descricao: "Usa o agy (Gemini) logado nesta máquina. Preciso, mas lento para ao vivo.",
    requer: "assinatura",
    modelos: [
      // o Flash "medium" ficou fora: pensou até estourar 2 min e devolveu o
      // plano fora do formato (medido em set/2026)
      { id: "gemini-3.8-flash-low", nome: "Gemini 3.8 Flash", descricao: "Acertou 7 de 7, uns 10 s por chamada." },
    ],
  },
  {
    id: "codex",
    nome: "Codex pela assinatura",
    descricao: "Usa o Codex logado nesta máquina. Preciso, mas lento para ao vivo.",
    requer: "assinatura",
    modelos: [{ id: "", nome: "Padrão do Codex", descricao: "Acertou 7 de 7, uns 9 s por chamada." }],
  },
  {
    id: "openai",
    nome: "OpenAI",
    descricao: "O mais preciso e rápido nos testes. Gasta com chave de API.",
    requer: "chave",
    chave: "OPENAI_API_KEY",
    modelos: [
      { id: "gpt-6-luna", nome: "GPT-6 Luna", descricao: "Acertou 7 de 7 nos testes." },
      { id: "gpt-4.1-mini", nome: "GPT-4.1 mini", descricao: "O mais rápido. Errou 1 de 7." },
    ],
  },
  {
    id: "gemini",
    nome: "Gemini",
    descricao: "Alternativa do Google. Gasta com chave de API.",
    requer: "chave",
    chave: "GEMINI_API_KEY",
    modelos: [{ id: "gemini-2.5-flash", nome: "Gemini 2.5 Flash", descricao: "Rápido." }],
  },
  {
    id: "local",
    nome: "Sem IA",
    descricao: "Regras de palavra-chave. Continua lendo os dados reais. O plano B.",
    requer: "nada",
    modelos: [{ id: "", nome: "Regras", descricao: "Não chama modelo nenhum." }],
  },
];

/** A variável que guarda o modelo escolhido de cada motor. */
export const VAR_DO_MODELO: Record<string, string> = {
  openai: "OPENAI_MODEL",
  claude: "CLAUDE_MODEL",
  codex: "CODEX_MODEL",
  agy: "AGY_MODEL",
  gemini: "GEMINI_MODEL",
};

type Instalada = (cli: "claude" | "codex" | "agy") => boolean;

function funciona(m: Catalogo, instalada: Instalada = cliInstalada): { ok: boolean; motivo?: string } {
  if (m.requer === "chave") {
    const ok = Boolean(m.chave && process.env[m.chave]);
    return { ok, motivo: ok ? undefined : "Falta a chave de API." };
  }
  if (m.id === "claude" || m.id === "codex" || m.id === "agy") {
    const ok = instalada(m.id);
    return { ok, motivo: ok ? undefined : `O ${m.id} não está instalado nesta máquina.` };
  }
  return { ok: true };
}

/**
 * Qual motor responde. LLM_PROVIDER vazio ou "auto" (o padrão) escolhe
 * sozinho: a primeira assinatura instalada, depois uma chave, e por último
 * o plano B sem IA. Ninguém gasta com chave sem ter escolhido gastar.
 */
export function motorEscolhido(
  // injetável para teste: a CI não tem CLI nenhuma, esta máquina tem as três
  instalada: Instalada = cliInstalada
): { id: string; modelo: string; automatico: boolean } {
  const pedido = (process.env.LLM_PROVIDER || "auto").toLowerCase();
  const automatico = pedido === "auto";
  const opcao =
    (automatico
      ? CATALOGO.find((m) => funciona(m, instalada).ok)
      : CATALOGO.find((m) => m.id === pedido)) ?? CATALOGO[CATALOGO.length - 1];
  const var_ = VAR_DO_MODELO[opcao.id];
  const modelo = (var_ && process.env[var_]) || opcao.modelos[0].id;
  return { id: opcao.id, modelo, automatico };
}

export async function disponibilidade(): Promise<OpcaoDeMotor[]> {
  return CATALOGO.map((m) => {
    const { ok, motivo } = funciona(m);
    return { ...m, disponivel: ok, motivo };
  });
}

export function criarMotor(deps: DepsDoMotor, escolha: { id: string; modelo: string } = motorEscolhido()): Motor {
  switch (escolha.id) {
    case "local":
      return motorLocal(deps);
    case "gemini":
      return motorGemini(deps, escolha.modelo || "gemini-2.5-flash");
    case "claude":
      return motorPorAssinatura(deps, "claude", escolha.modelo || "sonnet");
    case "codex":
      return motorPorAssinatura(deps, "codex", escolha.modelo);
    case "agy":
      return motorPorAssinatura(deps, "agy", escolha.modelo || "gemini-3.8-flash-low");
    default:
      return motorOpenAI(deps, escolha.modelo || "gpt-6-luna");
  }
}
