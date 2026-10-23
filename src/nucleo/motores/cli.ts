import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { montarPrompt, type Entrada } from "../prompt.ts";
import { extrairParcial, type DepsDoMotor, type Motor } from "./tipos.ts";

/**
 * Motores que usam a ASSINATURA de quem roda, pelas CLIs oficiais que o Frota
 * também usa (claude, codex, agy), em vez de chave de API. Mesmo contrato dos
 * outros motores: a CLI recebe o JSON Schema e devolve saída estruturada.
 *
 * Cada chamada roda numa pasta vazia, sem ferramentas e sem MCP: sem isso a
 * CLI carregaria o CLAUDE.md/AGENTS.md de quem estiver por perto e viraria um
 * agente de código dentro do nosso agente.
 */

export type QualCli = "claude" | "codex" | "agy";

export interface PedidoCli {
  sistema: string;
  prompt: string;
  schema: z.ZodType;
  /** texto da resposta até onde já foi escrito (só o Claude transmite) */
  aoEscrever?: (parcial: string) => void;
  /** "Parar" mata o processo da CLI na hora, em vez de esperar ela terminar */
  sinal?: AbortSignal;
}

const PASTA = path.join(os.tmpdir(), "sabia-motor-cli");

/** Roda a CLI; `aoLinha` recebe cada linha do stdout assim que ela chega. */
export function rodar(
  cmd: string,
  args: string[],
  entrada: string,
  prazoMs: number,
  aoLinha?: (linha: string) => void,
  sinal?: AbortSignal
): Promise<string> {
  fs.mkdirSync(PASTA, { recursive: true });
  return new Promise((ok, falha) => {
    const nome = path.basename(cmd).replace(/\.(exe|cmd|bat)$/i, "");
    if (sinal?.aborted) return falha(new Error(`${nome} parado antes de começar`));
    let alvo: ComoRodar;
    try {
      alvo = comoRodar(cmd);
    } catch (e) {
      return falha(e instanceof Error ? e : new Error(String(e)));
    }
    // `signal` do spawn: abortar mata o processo (SIGTERM) e dispara "error"
    const p = spawn(alvo.arquivo, [...alvo.antes, ...args], {
      cwd: PASTA,
      stdio: ["pipe", "pipe", "pipe"],
      signal: sinal,
      windowsHide: true,
    });
    let saida = "";
    let erro = "";
    let resto = "";
    const timer = setTimeout(() => {
      p.kill("SIGTERM");
      falha(new Error(`${nome} passou de ${prazoMs / 1000}s sem responder`));
    }, prazoMs);
    p.stdout.on("data", (d: Buffer) => {
      const txt = d.toString();
      saida += txt;
      if (!aoLinha) return;
      resto += txt;
      const linhas = resto.split("\n");
      resto = linhas.pop() ?? "";
      for (const l of linhas) if (l.trim()) aoLinha(l);
    });
    p.stderr.on("data", (d) => (erro += d));
    p.on("error", (e) => {
      clearTimeout(timer);
      falha(new Error(sinal?.aborted ? `${nome} parado a pedido` : `Não consegui rodar "${nome}": ${e.message}`));
    });
    p.on("close", (codigo) => {
      clearTimeout(timer);
      if (aoLinha && resto.trim()) aoLinha(resto);
      if (codigo === 0) ok(saida);
      else falha(new Error(`${nome} saiu com ${codigo}: ${(erro || saida).trim().slice(0, 300)}`));
    });
    p.stdin.end(entrada);
  });
}

interface ResultadoClaude {
  type?: string;
  is_error?: boolean;
  stop_reason?: string;
  result?: string;
  structured_output?: unknown;
}

/**
 * Claude Code (`claude -p`), com a assinatura logada nesta máquina.
 *
 * Com `aoEscrever`, usa `stream-json` com mensagens parciais: a saída
 * estruturada chega como uma chamada à ferramenta StructuredOutput, e os
 * pedaços dela (`input_json_delta`) são o JSON da resposta sendo escrito.
 * Medido: 47 pedaços para uma resposta de três frases.
 */
export async function pedirClaude(modelo: string, { sistema, prompt, schema, aoEscrever, sinal }: PedidoCli) {
  const args = [
    "-p",
    "--model", modelo,
    "--system-prompt", sistema,
    "--tools", "",
    "--strict-mcp-config",
    "--setting-sources", "",
    "--no-session-persistence",
    // draft-7: o validador da CLI não reconhece o "$schema" do draft 2020-12
    "--json-schema", JSON.stringify(z.toJSONSchema(schema, { target: "draft-7" })),
    ...(aoEscrever
      ? ["--output-format", "stream-json", "--verbose", "--include-partial-messages"]
      : ["--output-format", "json"]),
  ];

  const umaVez = async (): Promise<ResultadoClaude> => {
    if (!aoEscrever) return JSON.parse(await rodar(exe("claude"), args, prompt, 90_000, undefined, sinal)) as ResultadoClaude;
    let acumulado = "";
    let mostrado = "";
    let final: ResultadoClaude = {};
    await rodar(exe("claude"), args, prompt, 90_000, (linha) => {
      let e: { type?: string; event?: { type?: string; delta?: { type?: string; partial_json?: string } } };
      try {
        e = JSON.parse(linha);
      } catch {
        return;
      }
      if (e.type === "result") final = e as ResultadoClaude;
      const d = e.event?.type === "content_block_delta" ? e.event.delta : undefined;
      if (d?.type !== "input_json_delta" || !d.partial_json) return;
      acumulado += d.partial_json;
      const parcial = extrairParcial(acumulado, "resposta");
      if (parcial && parcial !== mostrado) {
        mostrado = parcial;
        aoEscrever(parcial);
      }
    }, sinal);
    return final;
  };

  // Recusa do filtro de segurança acontece de forma intermitente (visto no
  // teste: a mesma pergunta recusada e aceita em seguida). Uma segunda
  // tentativa resolve a maioria; se recusar de novo, o erro sobe.
  for (let tentativa = 1; ; tentativa++) {
    const r = await umaVez();
    if (!r.is_error && r.structured_output != null) return r.structured_output;
    const recusou = r.stop_reason === "refusal";
    if (recusou && tentativa < 2) continue;
    throw new Error(
      recusou
        ? "O Claude recusou a pergunta pelo filtro de segurança. Tente de novo ou troque o motor."
        : erroDeLogin(r.result) ?? `O Claude não devolveu o formato pedido: ${String(r.result ?? "").slice(0, 200)}`
    );
  }
}

/** Codex (`codex exec`), com a assinatura do ChatGPT logada nesta máquina. */
export async function pedirCodex(modelo: string, { sistema, prompt, schema, sinal }: PedidoCli) {
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
    await rodar(exe("codex"), args, `${sistema}\n\n${prompt}`, 120_000, undefined, sinal);
    return JSON.parse(fs.readFileSync(arqSaida, "utf8"));
  } finally {
    fs.rmSync(arqSchema, { force: true });
    fs.rmSync(arqSaida, { force: true });
  }
}

/**
 * Antigravity (`agy -p`), o sucessor do Gemini CLI, com a conta Google logada.
 * As armadilhas vieram do adaptador do Frota (adapters.rs), que já apanhou delas:
 *   - sem `--dangerously-skip-permissions`, o print mode trava esperando uma
 *     aprovação que ninguém pode dar (stdin fechado);
 *   - tem teto de tempo PRÓPRIO (`--print-timeout`), que mata o turno com um
 *     erro indistinguível de falha real; passamos o nosso, explícito;
 *   - `result.response` mistura a narração com a resposta: só vale o
 *     `structured_output`.
 * Não tem flag de prompt de sistema: ele vai junto do prompt, como no Codex.
 */
export async function pedirAgy(modelo: string, { sistema, prompt, schema, sinal }: PedidoCli) {
  const args = [
    "-p", `${sistema}\n\n${prompt}`,
    ...(modelo ? ["--model", modelo] : []),
    "--output-format", "json",
    "--json-schema", JSON.stringify(z.toJSONSchema(schema, { target: "draft-7" })),
    "--dangerously-skip-permissions",
    "--sandbox",
    "--disable-slash-commands",
    "--print-timeout", "2m",
  ];
  // O agy recebe o prompt como argumento, e o Windows corta a linha de comando
  // em 32.767 caracteres: uma pergunta com o boletim inteiro passaria disso.
  if (process.platform === "win32" && args.join(" ").length > 30_000) {
    throw new Error("Esta pergunta ficou grande demais para o Antigravity no Windows. Troque para o Claude ou o Codex.");
  }
  const bruto = await rodar(exe("agy"), args, "", 150_000, undefined, sinal);
  const r = JSON.parse(bruto) as { status?: string; structured_output?: unknown; response?: string };
  if (r.status === "SUCCESS" && r.structured_output != null) return r.structured_output;
  throw new Error(erroDeLogin(r.response) ?? `O agy não devolveu o formato pedido: ${String(r.response ?? "").slice(0, 200)}`);
}

/** CLI instalada mas não logada: a mensagem que ajuda de verdade. */
function erroDeLogin(texto?: string): string | null {
  return texto && /log ?in|login|auth|credential|not logged|unauthorized/i.test(texto)
    ? "A CLI não está logada nesta máquina. Abra o terminal, rode ela uma vez e faça o login."
    : null;
}

const PEDIR: Record<QualCli, typeof pedirClaude> = { claude: pedirClaude, codex: pedirCodex, agy: pedirAgy };
const NOME: Record<QualCli, string> = { claude: "Claude", codex: "Codex", agy: "Antigravity" };

/** Motor pela assinatura. Só o Claude transmite a resposta aos pedaços. */
export function motorPorAssinatura({ sistema, registro }: DepsDoMotor, qual: QualCli, modelo: string): Motor {
  const pedir = PEDIR[qual];
  const chamar = async <S extends z.ZodType>(
    schema: S,
    e: Entrada,
    aoEscrever?: (parcial: string) => void
  ): Promise<z.infer<S>> =>
    schema.parse(await pedir(modelo, { sistema: sistema(), prompt: montarPrompt(e), schema, aoEscrever, sinal: e.sinal }));
  return {
    nome: `${NOME[qual]} ${modelo || "padrão"} (assinatura)`,
    plano: (e) => chamar(registro.Plano, e),
    resposta: (e, aoEscrever) => chamar(registro.Resposta, e, aoEscrever),
  };
}

/**
 * A CLI existe nesta máquina? Procura no PATH, sem rodar nada: é chamada a
 * cada pergunta pelo modo automático, e rodar `--version` custaria segundos.
 * (Não garante que está logada: isso só a primeira chamada diz.)
 */
export function caminhoDaCli(cmd: QualCli): string | null {
  const windows = process.platform === "win32";
  // O Sabiá pode ser aberto com um PATH curto (pelo Finder, por um serviço):
  // procura também onde as CLIs costumam morar, e roda pelo caminho achado.
  const extras = windows
    ? [
        path.join(os.homedir(), ".local", "bin"), // instalador nativo do Claude Code
        ...(process.env.APPDATA ? [path.join(process.env.APPDATA, "npm")] : []), // npm install -g
      ]
    : [path.join(os.homedir(), ".local", "bin"), "/opt/homebrew/bin", "/usr/local/bin"];
  const pastas = [...(process.env.PATH ?? "").split(path.delimiter).filter(Boolean), ...extras];
  // No Windows o arquivo tem extensão (claude.exe, codex.cmd); o .exe vem
  // antes, e o .ps1 do npm fica de fora (o Node não roda PowerShell direto).
  const nomes = windows ? [".exe", ".cmd", ".bat"].map((ext) => cmd + ext) : [cmd];
  for (const d of pastas) {
    for (const n of nomes) {
      const p = path.join(d, n);
      try {
        fs.accessSync(p, windows ? fs.constants.F_OK : fs.constants.X_OK);
        if (fs.statSync(p).isFile()) return p;
      } catch {
        // não está nesta pasta
      }
    }
  }
  return null;
}

/** Como rodar uma CLI: o programa, e os argumentos que vão antes dos nossos. */
export interface ComoRodar {
  arquivo: string;
  antes: string[];
}

/**
 * O script que um atalho .cmd do npm roda. O npm instala CLIs no Windows como
 * um .cmd que termina em:
 *
 *   "%_prog%"  "%dp0%\node_modules\@anthropic-ai\claude-code\cli.js" %*
 *
 * Devolve o caminho depois do %dp0% (relativo à pasta do .cmd), ou null.
 */
export function alvoDoAtalhoNpm(texto: string): string | null {
  const m = texto.match(/"%~?dp0%?\\?([^"%]+)"\s+%\*/i);
  return m ? m[1] : null;
}

/**
 * No Windows, o Node se recusa a executar .cmd sem passar pelo shell (desde a
 * correção de segurança de abril de 2024), e pelo shell as aspas do prompt e
 * do JSON Schema se perderiam. Então o .cmd do npm é lido e o script por trás
 * dele roda direto com o Node. Executável de verdade (.exe) roda como está.
 */
export function comoRodar(caminho: string): ComoRodar {
  if (!/\.(cmd|bat)$/i.test(caminho)) return { arquivo: caminho, antes: [] };
  let texto = "";
  try {
    texto = fs.readFileSync(caminho, "utf8");
  } catch {
    // cai na mensagem abaixo
  }
  const alvo = alvoDoAtalhoNpm(texto);
  if (!alvo) {
    throw new Error(
      `Não sei rodar ${path.basename(caminho)} (não é um atalho do npm). Instale a CLI pelo npm ou pelo instalador oficial.`
    );
  }
  const script = path.join(path.dirname(caminho), alvo);
  return /\.exe$/i.test(script) ? { arquivo: script, antes: [] } : { arquivo: process.execPath, antes: [script] };
}

export const cliInstalada = (cmd: QualCli): boolean => caminhoDaCli(cmd) !== null;

/** o executável para o spawn: o caminho achado, ou o nome (e o erro fica claro) */
const exe = (cmd: QualCli) => caminhoDaCli(cmd) ?? cmd;
