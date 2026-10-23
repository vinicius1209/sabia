/**
 * Monta o Sabiá para rodar em qualquer computador, sem o código-fonte:
 *
 *   dist/sabia.mjs   o servidor inteiro num arquivo só, já em JavaScript
 *   dist/marca/      o mascote (o pacote do agente procura ao lado do código)
 *
 * Por que compilar, se o Node roda TypeScript direto? Porque ele se recusa a
 * fazer isso com arquivo dentro de node_modules, que é onde o pacote mora
 * quando alguém instala com npx ou npm -g.
 *
 * As dependências (playwright, express, zod...) ficam de fora: o npm instala.
 */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const dist = path.join(raiz, "dist");

fs.rmSync(dist, { recursive: true, force: true });
await build({
  entryPoints: [path.join(raiz, "src", "cli.ts")],
  outfile: path.join(dist, "sabia.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  logLevel: "warning",
  // o import dinâmico de pacotes fora do mapa (SABIA_AGENTE=outro) é só para
  // quem roda do código-fonte; no pacote ele cai na mensagem de erro
  logOverride: { "unsupported-dynamic-import": "silent" },
});
fs.cpSync(path.join(raiz, "src", "agentes", "sabia", "marca"), path.join(dist, "marca"), { recursive: true });
console.log("  dist/ pronto");
