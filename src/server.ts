import express, { type Request, type Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { criarAgente, type Evento } from "./agent.ts";
import { closeBrowser } from "./browser.mjs";
import { criarPortao2FA } from "./doisfatores.ts";
import { perfil } from "./perfil.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* .env simples, sem dependencia extra */
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const linha of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const PORT = Number(process.env.PORT || 8123);

/**
 * Por padrão, só esta máquina acessa. O agente está logado numa conta real
 * e responde notas, tarefas e horários de uma pessoa de verdade, sem pedir
 * senha. Aberto na rede (o comportamento antigo), qualquer um no wifi da
 * escola conseguiria perguntar as notas dela.
 * Para liberar de propósito: HOST=0.0.0.0 no .env.
 */
const HOST = process.env.HOST || "127.0.0.1";

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "ui")));

/* ---- canal de eventos para a UI (SSE) ---- */
const clientes = new Set<Response>();
function emitirBruto(payload: Record<string, unknown>) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  for (const c of clientes) c.write(msg);
}

app.get("/api/events", (req: Request, res: Response) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();
  res.write(": ok\n\n");
  clientes.add(res);
  req.on("close", () => clientes.delete(res));
});

/* ---- 2FA com pessoa no meio, com prazo e cancelamento ---- */
const portao2fa = criarPortao2FA({
  prazoMs: Number(process.env.PRAZO_2FA_MS || 3 * 60 * 1000),
  aoPedir: () => emitirBruto({ tipo: "2fa" }),
  aoEncerrar: (motivo) => emitirBruto({ tipo: "2fa_fim", motivo }),
});

app.post("/api/2fa", (req: Request, res: Response) => {
  const code = String(req.body?.code || "").trim();
  if (!code) return res.status(400).json({ erro: "codigo vazio" });
  if (!portao2fa.responder(code)) {
    return res.status(409).json({ erro: "nao estou esperando codigo" });
  }
  res.json({ ok: true });
});

app.post("/api/2fa/cancelar", (_req: Request, res: Response) => {
  res.json({ cancelado: portao2fa.cancelar() });
});

/* ---- agente ---- */
const agente = criarAgente({
  emitir: (e: Evento) => {
    if (e.tipo === "passo") console.log(`[${new Date().toTimeString().slice(0, 8)}] ${e.mensagem}`);
    emitirBruto(e as unknown as Record<string, unknown>);
  },
  request2faCode: () => portao2fa.pedir(),
});

let ocupado = false;

app.post("/api/chat", async (req: Request, res: Response) => {
  const mensagem = String(req.body?.mensagem || "").trim();
  const conversa = String(req.body?.conversa || "padrao").slice(0, 64);
  if (!mensagem) return res.status(400).json({ erro: "mensagem vazia" });
  if (ocupado) return res.status(429).json({ erro: "ja estou respondendo outra pergunta" });

  ocupado = true;
  emitirBruto({ tipo: "pensando", conversa });
  try {
    const r = await agente.perguntar(mensagem, conversa);
    emitirBruto({ tipo: "resposta", ...r, conversa });
    res.json(r);
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    emitirBruto({ tipo: "erro", mensagem: erro, conversa });
    res.status(500).json({ erro });
  } finally {
    ocupado = false;
  }
});

/** Nome da aluna e da escola para o cabeçalho da UI. Vem do .env, fora do git. */
app.get("/api/perfil", (_req: Request, res: Response) => {
  res.json(perfil());
});

app.get("/api/health", (_req: Request, res: Response) => {
  const usaGemini = (process.env.LLM_PROVIDER || "openai").toLowerCase() === "gemini";
  res.json({
    ok: true,
    provedor: agente.provedor,
    temChave: Boolean(usaGemini ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY),
    navegadorVisivel: process.env.SHOW_BROWSER !== "0",
  });
});

/* Endpoint so para teste: derruba a sessao do navegador para verificar que o
   agente se recupera sozinho. Fica atras de DEBUG_ENDPOINTS=1. */
if (process.env.DEBUG_ENDPOINTS === "1") {
  app.post("/api/debug/derrubar-sessao", async (_req: Request, res: Response) => {
    const { getBrowser } = await import("./browser.mjs");
    const { ctx } = await getBrowser();
    const antes = (await ctx.cookies()).length;
    await ctx.clearCookies();
    res.json({ cookiesRemovidos: antes });
  });
}

app.listen(PORT, HOST, () => {
  console.log(`\n  Sabiá rodando em  http://localhost:${PORT}`);
  console.log(`  Motor de IA: ${agente.provedor}`);
  console.log(
    HOST === "127.0.0.1"
      ? `  Acesso: só esta máquina (HOST=0.0.0.0 libera a rede)\n`
      : `  ATENÇÃO: aberto na rede em ${HOST}. Qualquer um no wifi lê os dados da conta.\n`
  );
});

process.on("SIGINT", async () => {
  await closeBrowser();
  process.exit(0);
});
