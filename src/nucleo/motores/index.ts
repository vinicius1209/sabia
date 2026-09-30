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
 * ================================================================== */

type Catalogo = Omit<OpcaoDeMotor, "disponivel" | "motivo">;

export const CATALOGO: Catalogo[] = [
  {
    id: "openai",
    nome: "OpenAI",
    descricao: "O mais preciso nos testes. Usa chave de API.",
    requer: "chave",
    chave: "OPENAI_API_KEY",
    modelos: [
      { id: "gpt-6-luna", nome: "GPT-6 Luna", descricao: "O padrão. Acertou 7 de 7 nos testes." },
      { id: "gpt-4.1-mini", nome: "GPT-4.1 mini", descricao: "O mais rápido. Errou 1 de 7 nos testes." },
    ],
  },
  {
    id: "claude",
    nome: "Claude pela assinatura",
    descricao: "Usa o Claude Code logado nesta máquina. Sem chave de API.",
    requer: "assinatura",
    modelos: [
      { id: "sonnet", nome: "Sonnet", descricao: "Acertou 6 de 7. Uns 2 s mais lento que a API." },
      { id: "haiku", nome: "Haiku", descricao: "Acertou 6 de 7, e foi mais lento que o Sonnet." },
    ],
  },
  {
    id: "codex",
    nome: "Codex pela assinatura",
    descricao: "Usa o Codex logado nesta máquina. Preciso, mas lento para ao vivo.",
    requer: "assinatura",
    modelos: [{ id: "", nome: "Padrão do Codex", descricao: "O modelo configurado no Codex." }],
  },
  {
    id: "gemini",
    nome: "Gemini",
    descricao: "Alternativa do Google. Usa chave de API.",
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
  gemini: "GEMINI_MODEL",
};

export function motorEscolhido(): { id: string; modelo: string } {
  const id = (process.env.LLM_PROVIDER || "openai").toLowerCase();
  const opcao = CATALOGO.find((m) => m.id === id) ?? CATALOGO[0];
  const var_ = VAR_DO_MODELO[opcao.id];
  const modelo = (var_ && process.env[var_]) || opcao.modelos[0].id;
  return { id: opcao.id, modelo };
}

export async function disponibilidade(): Promise<OpcaoDeMotor[]> {
  const [temClaude, temCodex] = await Promise.all([cliInstalada("claude"), cliInstalada("codex")]);
  return CATALOGO.map((m) => {
    if (m.requer === "chave") {
      const ok = Boolean(m.chave && process.env[m.chave]);
      return { ...m, disponivel: ok, motivo: ok ? undefined : "Falta a chave de API." };
    }
    if (m.id === "claude") {
      return { ...m, disponivel: temClaude, motivo: temClaude ? undefined : "O Claude Code não está instalado." };
    }
    if (m.id === "codex") {
      return { ...m, disponivel: temCodex, motivo: temCodex ? undefined : "O Codex não está instalado." };
    }
    return { ...m, disponivel: true };
  });
}

export function criarMotor(deps: DepsDoMotor, escolha = motorEscolhido()): Motor {
  switch (escolha.id) {
    case "local":
      return motorLocal(deps);
    case "gemini":
      return motorGemini(deps, escolha.modelo || "gemini-2.5-flash");
    case "claude":
      return motorPorAssinatura(deps, "claude", escolha.modelo || "sonnet");
    case "codex":
      return motorPorAssinatura(deps, "codex", escolha.modelo);
    default:
      return motorOpenAI(deps, escolha.modelo || "gpt-6-luna");
  }
}
