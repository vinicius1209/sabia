import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { montarPrompt, type Entrada } from "../prompt.ts";
import type { DepsDoMotor, Motor } from "./tipos.ts";

/**
 * Motores que usam a ASSINATURA de quem roda (Claude ou ChatGPT), pelas CLIs
 * oficiais, em vez de chave de API. Mesmo contrato dos outros motores: a
 * CLI recebe o JSON Schema e devolve saída estruturada.
 *
 * Cada chamada roda numa pasta vazia, sem ferramentas e sem MCP: sem isso a
 * CLI carregaria o CLAUDE.md/AGENTS.md de quem estiver por perto e viraria um
 * agente de código dentro do nosso agente.
 */

export interface PedidoCli {
  sistema: string;
  prompt: string;
  schema: z.ZodType;
}

const PASTA = path.join(os.tmpdir(), "sabia-motor-cli");

function rodar(cmd: string, args: string[], entrada: string, prazoMs: number): Promise<string> {
  fs.mkdirSync(PASTA, { recursive: true });
  return new Promise((ok, falha) => {
    const p = spawn(cmd, args, { cwd: PASTA, stdio: ["pipe", "pipe", "pipe"] });
    let saida = "";
    let erro = "";
    const timer = setTimeout(() => {
      p.kill("SIGTERM");
      falha(new Error(`${cmd} passou de ${prazoMs / 1000}s sem responder`));
    }, prazoMs);
    p.stdout.on("data", (d) => (saida += d));
    p.stderr.on("data", (d) => (erro += d));
    p.on("error", (e) => {
      clearTimeout(timer);
      falha(new Error(`Não consegui rodar "${cmd}": ${e.message}`));
    });
    p.on("close", (codigo) => {
      clearTimeout(timer);
      if (codigo === 0) ok(saida);
      else falha(new Error(`${cmd} saiu com ${codigo}: ${(erro || saida).trim().slice(0, 300)}`));
    });
    p.stdin.end(entrada);
  });
}

/** Claude Code (`claude -p`), com a assinatura logada nesta máquina. */
export async function pedirClaude(modelo: string, { sistema, prompt, schema }: PedidoCli) {
  const args = [
    "-p",
    "--model", modelo,
    "--system-prompt", sistema,
    "--tools", "",
    "--strict-mcp-config",
    "--setting-sources", "",
    "--no-session-persistence",
    "--output-format", "json",
    // draft-7: o validador da CLI não reconhece o "$schema" do draft 2020-12
    "--json-schema", JSON.stringify(z.toJSONSchema(schema, { target: "draft-7" })),
  ];
  // Recusa do filtro de segurança acontece de forma intermitente (visto no
  // teste: a mesma pergunta recusada e aceita em seguida). Uma segunda
  // tentativa resolve a maioria; se recusar de novo, o erro sobe.
  for (let tentativa = 1; ; tentativa++) {
    const bruto = JSON.parse(await rodar("claude", args, prompt, 90_000)) as {
      is_error?: boolean;
      stop_reason?: string;
      result?: string;
      structured_output?: unknown;
    };
    if (!bruto.is_error && bruto.structured_output != null) return bruto.structured_output;
    const recusou = bruto.stop_reason === "refusal";
    if (recusou && tentativa < 2) continue;
    throw new Error(
      recusou
        ? "O Claude recusou a pergunta pelo filtro de segurança. Tente de novo ou troque o motor."
        : `O Claude não devolveu o formato pedido: ${String(bruto.result ?? "").slice(0, 200)}`
    );
  }
}

/** Codex (`codex exec`), com a assinatura do ChatGPT logada nesta máquina. */
export async function pedirCodex(modelo: string, { sistema, prompt, schema }: PedidoCli) {
  fs.mkdirSync(PASTA, { recursive: true });
  const id = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const arqSchema = path.join(PASTA, `schema-${id}.json`);
  const arqSaida = path.join(PASTA, `saida-${id}.json`);
  // O Codex exige o schema no formato estrito da OpenAI (anyOf, e não oneOf);
  // o helper da própria OpenAI já converte assim.
  const { zodResponseFormat } = await import("openai/helpers/zod");
  const estrito = zodResponseFormat(schema as never, "saida").json_schema.schema;
  fs.writeFileSync(arqSchema, JSON.stringify(estrito));
  const args = [
    "exec",
    ...(modelo ? ["-m", modelo] : []),
    "-s", "read-only",
    "--skip-git-repo-check",
    "--ephemeral",
    "--output-schema", arqSchema,
    "-o", arqSaida,
    "-", // o prompt vem pelo stdin
  ];
  try {
    await rodar("codex", args, `${sistema}\n\n${prompt}`, 120_000);
    return JSON.parse(fs.readFileSync(arqSaida, "utf8"));
  } finally {
    fs.rmSync(arqSchema, { force: true });
    fs.rmSync(arqSaida, { force: true });
  }
}

/** Motor pela assinatura. Não transmite aos pedaços: a CLI devolve tudo no fim. */
export function motorPorAssinatura(
  { sistema, registro }: DepsDoMotor,
  qual: "claude" | "codex",
  modelo: string
): Motor {
  const pedir = qual === "claude" ? pedirClaude : pedirCodex;
  const chamar = async <S extends z.ZodType>(schema: S, e: Entrada): Promise<z.infer<S>> =>
    schema.parse(await pedir(modelo, { sistema: sistema(), prompt: montarPrompt(e), schema }));
  return {
    nome: qual === "claude" ? `Claude ${modelo} (assinatura)` : `Codex ${modelo || "padrão"} (assinatura)`,
    plano: (e) => chamar(registro.Plano, e),
    resposta: (e) => chamar(registro.Resposta, e),
  };
}

/** A CLI existe nesta máquina? (não garante que está logada: isso só a 1ª chamada diz) */
export function cliInstalada(cmd: "claude" | "codex"): Promise<boolean> {
  return new Promise((ok) => {
    const p = spawn(cmd, ["--version"], { stdio: "ignore" });
    p.on("error", () => ok(false));
    p.on("close", (codigo) => ok(codigo === 0));
  });
}
