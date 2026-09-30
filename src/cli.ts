/**
 * O ponto de entrada.
 *
 *   npm start           sobe o agente e abre a tela no navegador
 *   npm run doctor      diz o que falta para funcionar
 *
 * SABIA_AGENTE escolhe o pacote em src/agentes/<id> (padrão: sabia).
 * SABIA_ABRIR=0 não abre o navegador sozinho.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { carregarConfig, home, lerConfig, migrarNavegador } from "./nucleo/config.ts";
import { disponibilidade, motorEscolhido } from "./nucleo/motores/index.ts";
import type { PacoteDeAgente } from "./nucleo/pacote.ts";
import { criarServidor } from "./nucleo/servidor.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pastaWeb = path.join(raiz, "web", "dist");

const { importouDotEnv } = carregarConfig(raiz);
const migrouNavegador = migrarNavegador(raiz);

const idAgente = process.env.SABIA_AGENTE || "sabia";
if (!/^[a-z0-9-]+$/.test(idAgente)) throw new Error(`SABIA_AGENTE inválido: ${idAgente}`);
const pacote = (await import(`./agentes/${idAgente}/index.ts`)).default as PacoteDeAgente;

const comando = process.argv[2] ?? "iniciar";

if (comando === "doctor") {
  await doctor();
} else if (comando === "iniciar") {
  await iniciar();
} else {
  console.log(`Comando desconhecido: ${comando}. Use "iniciar" ou "doctor".`);
  process.exit(1);
}

async function iniciar() {
  const PORT = Number(process.env.PORT || 8123);
  /**
   * Por padrão, só esta máquina acessa. O agente está logado numa conta real
   * e responde dados de uma pessoa de verdade, sem pedir senha. Aberto na
   * rede, qualquer um no wifi conseguiria perguntar.
   * Para liberar de propósito: HOST=0.0.0.0.
   */
  const HOST = process.env.HOST || "127.0.0.1";

  if (!fs.existsSync(path.join(pastaWeb, "index.html"))) {
    console.log("\n  A tela ainda não foi compilada. Rode: npm run build:web\n");
  }

  const { app, motor, encerrar } = criarServidor({
    pacote,
    pastaWeb,
    pastaClassica: path.join(raiz, "ui"),
  });

  app.listen(PORT, HOST, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`\n  ${pacote.nome} rodando em  ${url}`);
    console.log(`  Motor: ${motor().nome}`);
    console.log(`  Dados locais em ${home()}`);
    if (importouDotEnv) console.log("  (importei o .env do projeto para lá)");
    if (migrouNavegador) console.log("  (copiei a sessão do navegador para lá, sem precisar de 2FA de novo)");
    console.log(
      HOST === "127.0.0.1"
        ? "  Acesso: só esta máquina (HOST=0.0.0.0 libera a rede)\n"
        : `  ATENÇÃO: aberto na rede em ${HOST}. Qualquer um no wifi lê os dados da conta.\n`
    );
    if (process.env.SABIA_ABRIR !== "0" && !process.env.CI) abrirNavegador(url);
  });

  process.on("SIGINT", async () => {
    await encerrar();
    process.exit(0);
  });
}

function abrirNavegador(url: string) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  spawn(cmd, [url], { stdio: "ignore", detached: true, shell: process.platform === "win32" })
    .on("error", () => {})
    .unref();
}

async function doctor() {
  const ok = (b: boolean) => (b ? "✓" : "✗");
  const linhas: string[] = [];
  const [maior] = process.versions.node.split(".").map(Number);
  linhas.push(`${ok(maior >= 24)} Node ${process.versions.node} (precisa 24 ou mais novo)`);
  linhas.push(`${ok(fs.existsSync(path.join(pastaWeb, "index.html")))} Tela compilada (npm run build:web)`);

  let chromium = false;
  try {
    const { chromium: c } = await import("playwright");
    chromium = fs.existsSync(c.executablePath());
  } catch {
    chromium = false;
  }
  linhas.push(`${ok(chromium)} Chromium do Playwright (npx playwright install chromium)`);

  linhas.push(`\n  Dados em ${home()}`);
  for (const c of pacote.campos) {
    const tem = Boolean(lerConfig(c.chave));
    linhas.push(`${c.obrigatorio ? ok(tem) : tem ? "✓" : "·"} ${c.rotulo}${c.obrigatorio ? "" : " (opcional)"}`);
  }

  const escolha = motorEscolhido();
  linhas.push(`\n  Motores (escolhido: ${escolha.id}${escolha.modelo ? ` ${escolha.modelo}` : ""})`);
  for (const m of await disponibilidade()) {
    linhas.push(`${ok(m.disponivel)} ${m.nome}${m.motivo ? `: ${m.motivo}` : ""}`);
  }
  console.log(`\n  ${pacote.nome} · diagnóstico\n\n${linhas.map((l) => (l.startsWith("\n") ? l : `  ${l}`)).join("\n")}\n`);
}
