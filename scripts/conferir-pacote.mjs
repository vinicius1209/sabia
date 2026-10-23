/**
 * Confere o Sabiá do jeito que outra pessoa vai usar: empacota, instala numa
 * pasta limpa, roda o comando `sabia` pelo atalho do npm e sobe o servidor de
 * verdade (baixando o navegador, se for a primeira vez). Roda no CI em Linux,
 * macOS e Windows.
 *
 *   node scripts/conferir-pacote.mjs
 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const windows = process.platform === "win32";
const npm = (args, cwd) =>
  // no Windows o npm é um .cmd: precisa do shell (aqui os argumentos são fixos e seguros)
  execFileSync(windows ? "npm.cmd" : "npm", args, { cwd, encoding: "utf8", shell: windows, stdio: ["ignore", "pipe", "inherit"] });

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sabia-pacote-"));
const home = path.join(tmp, "home");
const falhar = (msg) => {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
};

try {
  console.log("  compilando e empacotando...");
  // o build escreve no stdout: roda antes, e o pack (com --json) sai limpo
  execFileSync(windows ? "npm.cmd" : "npm", ["run", "build"], { cwd: raiz, stdio: "inherit", shell: windows });
  const [{ filename }] = JSON.parse(npm(["pack", "--json", "--ignore-scripts", "--pack-destination", tmp], raiz));
  const proibidos = execFileSync("tar", ["-tzf", path.join(tmp, filename)], { encoding: "utf8" })
    .split(/\r?\n/)
    .filter((f) => /(^|\/)(\.env|\.profile-chrome|conversas|estruturas\.json|config\.json)/.test(f));
  if (proibidos.length) falhar(`o pacote leva arquivo que não pode: ${proibidos.join(", ")}`);

  console.log(`  instalando ${filename} numa pasta limpa...`);
  const app = path.join(tmp, "app");
  fs.mkdirSync(app);
  npm(["init", "-y"], app);
  npm(["install", "--no-audit", "--no-fund", path.join(tmp, filename)], app);

  // o comando `sabia` pelo atalho que o npm criou (sabia.cmd no Windows)
  const versao = npm(["exec", "--no", "--", "sabia", "--versao"], app).trim();
  const esperada = JSON.parse(fs.readFileSync(path.join(raiz, "package.json"), "utf8")).version;
  if (versao !== esperada) falhar(`sabia --versao disse "${versao}", esperava ${esperada}`);
  console.log(`  ✓ sabia --versao: ${versao}`);

  const env = { ...process.env, SABIA_HOME: home, PORT: "8199", CI: "1" };
  const bin = path.join(app, "node_modules", "sabia", "bin", "sabia.mjs");
  const doctor = execFileSync(process.execPath, [bin, "doctor"], { env, encoding: "utf8" });
  if (!doctor.includes("diagnóstico") || !doctor.includes("sabia doctor --fontes")) falhar(`doctor estranho:\n${doctor}`);
  console.log("  ✓ sabia doctor");

  console.log("  subindo o servidor (na primeira vez baixa o navegador)...");
  const servidor = spawn(process.execPath, [bin, "--sem-abrir"], { env, stdio: ["ignore", "inherit", "inherit"] });
  const fim = Date.now() + 5 * 60_000;
  let agente = null;
  while (Date.now() < fim && servidor.exitCode === null) {
    try {
      const r = await fetch("http://127.0.0.1:8199/api/agente");
      if (r.ok) {
        agente = await r.json();
        break;
      }
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!agente) {
    servidor.kill();
    falhar("o servidor não respondeu");
  }
  const tela = await (await fetch("http://127.0.0.1:8199/")).text();
  const mascote = await fetch("http://127.0.0.1:8199/marca/sabia-02-icone.png");
  servidor.kill();
  if (agente.nome !== "Sabiá") falhar(`/api/agente respondeu ${JSON.stringify(agente).slice(0, 200)}`);
  if (!tela.includes('<div id="root">')) falhar("a tela não veio");
  if (!mascote.ok) falhar(`o mascote não veio (${mascote.status})`);
  console.log("  ✓ servidor no ar: tela, API e mascote");
  console.log("\n  Pacote conferido.\n");
} finally {
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
