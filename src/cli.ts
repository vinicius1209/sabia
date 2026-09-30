/**
 * O ponto de entrada.
 *
 *   npm start           sobe o agente e abre a tela no navegador
 *   npm run doctor      diz o que falta para funcionar
 *
 * SABIA_AGENTE escolhe o pacote em src/agentes/<id> (padrão: sabia).
 * SABIA_ABRIR=0 não abre o navegador sozinho.
 * SABIA_AGORA=2026-09-26T10:00:00-03:00 congela o relógio (só para ensaio).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { carregarConfig, home, lerConfig, migrarNavegador } from "./nucleo/config.ts";
import net from "node:net";
import { congelarRelogio } from "./nucleo/contexto.ts";
import { conferirEstrutura, formasConhecidas, mudancas } from "./nucleo/estruturas.ts";
import { disponibilidade, motorEscolhido } from "./nucleo/motores/index.ts";
import { criarRegistro } from "./nucleo/registro.ts";
import type { PacoteDeAgente } from "./nucleo/pacote.ts";
import { criarServidor } from "./nucleo/servidor.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pastaWeb = path.join(raiz, "web", "dist");

const { importouDotEnv } = carregarConfig(raiz);
const migrouNavegador = migrarNavegador(raiz);
congelarRelogio(process.env.SABIA_AGORA);

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

  const servidor = app.listen(PORT, HOST, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`\n  ${pacote.nome} rodando em  ${url}`);
    console.log(`  Motor: ${motor().nome}${motorEscolhido().automatico ? " (escolhido no automático)" : ""}`);
    console.log(`  Dados locais em ${home()}`);
    if (importouDotEnv) console.log("  (importei o .env do projeto para lá)");
    if (migrouNavegador) console.log("  (copiei a sessão do navegador para lá, sem precisar de 2FA de novo)");
    // relógio congelado é para ensaio; no app de verdade, "já passou" ficaria errado
    if (process.env.SABIA_AGORA) console.log(`  ATENÇÃO: relógio congelado em ${process.env.SABIA_AGORA} (SABIA_AGORA)`);
    console.log(
      HOST === "127.0.0.1"
        ? "  Acesso: só esta máquina (HOST=0.0.0.0 libera a rede)\n"
        : `  ATENÇÃO: aberto na rede em ${HOST}. Qualquer um no wifi lê os dados da conta.\n`
    );
    if (process.env.SABIA_ABRIR !== "0" && !process.env.CI) abrirNavegador(url);
  });

  servidor.on("error", (e: NodeJS.ErrnoException) => {
    if (e.code !== "EADDRINUSE") throw e;
    console.log(`\n  A porta ${PORT} já está em uso: provavelmente outro ${pacote.nome} está rodando.`);
    console.log(`  Feche o outro, ou suba em outra porta: PORT=${PORT + 1} npm start\n`);
    process.exit(1);
  });

  // Rede de segurança: um erro esquecido vira log, e não a demonstração caindo
  // na frente da turma. (O Node derruba o processo em rejeição não tratada.)
  process.on("unhandledRejection", (e) => {
    console.error("  Erro não tratado (o Sabiá continua no ar):", e instanceof Error ? e.message : e);
  });

  // SIGTERM também: é o que o Frota e os gerenciadores de processo mandam.
  // Só com SIGINT, o tratador de SIGTERM do Playwright fechava o navegador e
  // o servidor seguia vivo, segurando a porta.
  const sair = async () => {
    await encerrar().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", sair);
  process.on("SIGTERM", sair);
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
  const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const conhecidas = formasConhecidas();
  const mudou = new Map(mudancas().map((m) => [m.capacidade, m]));
  linhas.push(`\n  Formato das fontes (a forma da página, conferida a cada leitura)`);
  for (const c of pacote.capacidades) {
    const m = mudou.get(c.nome);
    if (m) linhas.push(`⚠ ${c.rotulo}: mudou de formato em ${dia(m.desde)}`);
    else if (conhecidas[c.nome]) linhas.push(`✓ ${c.rotulo}: igual ao conhecido (visto em ${dia(conhecidas[c.nome].vistaEm)})`);
    else linhas.push(`· ${c.rotulo}: ainda não lido`);
  }
  console.log(`\n  ${pacote.nome} · diagnóstico\n\n${linhas.map((l) => (l.startsWith("\n") ? l : `  ${l}`)).join("\n")}\n`);

  if (process.argv.includes("--fontes")) await conferirFontes();
  else console.log("  Para entrar em cada fonte de verdade e conferir: npm run doctor -- --fontes\n");
}

/** A porta do app está em uso? (ele segura o perfil do navegador) */
function appAberto(): Promise<boolean> {
  const porta = Number(process.env.PORT || 8123);
  return new Promise((ok) => {
    const s = net.connect(porta, "127.0.0.1");
    s.once("connect", () => (s.destroy(), ok(true)));
    s.once("error", () => ok(false));
  });
}

/**
 * Entra em cada fonte de verdade, lê com os argumentos padrão e confere a
 * forma da página. É o comando para rodar na véspera de uma apresentação.
 */
async function conferirFontes() {
  if (await appAberto()) {
    console.log(`  Feche o ${pacote.nome} antes: ele usa a mesma sessão do navegador que esta conferência.\n`);
    process.exitCode = 1;
    return;
  }
  process.env.SHOW_BROWSER ??= "0";
  const registro = criarRegistro(pacote.capacidades);
  console.log("  Conferindo as fontes de verdade (pode levar um minuto e meio)...\n");
  try {
    await pacote.preparar?.({
      passo: () => {},
      pedirCodigo: async () => {
        throw new Error("A sessão expirou e pediu o código de verificação: entre uma vez pela tela (npm start).");
      },
    });
  } catch (e) {
    console.log(`  ✗ Não consegui entrar: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 1;
    await pacote.encerrar?.();
    return;
  }
  let falhas = 0;
  for (const c of pacote.capacidades) {
    let forma = "";
    try {
      const dados = await registro.executar(c.nome, registro.argsPadrao(c.nome), () => {}, (d) => {
        forma = conferirEstrutura(c.nome, d);
      });
      const indisponivel = (dados as { formato?: string; motivo?: string }).formato === "indisponivel";
      if (indisponivel) {
        falhas++;
        console.log(`  ✗ ${c.rotulo}: ${(dados as { motivo: string }).motivo}`);
      } else if (forma === "mudou") {
        console.log(`  ⚠ ${c.rotulo}: leu, mas a página mudou de formato. Confira as respostas.`);
      } else {
        console.log(`  ✓ ${c.rotulo}: ${registro.resumir(c.nome, dados)}`);
      }
    } catch (e) {
      falhas++;
      console.log(`  ✗ ${c.rotulo}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  await pacote.encerrar?.();
  console.log(falhas ? `\n  ${falhas} fonte(s) com problema.\n` : "\n  Todas as fontes lidas com segurança.\n");
  if (falhas) process.exitCode = 1;
}
