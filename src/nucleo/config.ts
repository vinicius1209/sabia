import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/* ==================================================================
 * Configuração e o HOME do agente.
 *
 * Tudo que é da pessoa (chaves, conta, nome, sessão do navegador,
 * conversas) mora em ~/.sabia, fora do repositório. O código pode ser
 * público e atualizado sem encostar nesses dados.
 *
 * A configuração é um mapa simples com os mesmos nomes do .env, porque
 * o resto do sistema já lê de process.env. Precedência:
 *   variável de ambiente de verdade  >  ~/.sabia/config.json  >  .env
 * A de ambiente vence sempre e não pode ser trocada pela tela.
 * ================================================================== */

export function home(): string {
  return process.env.SABIA_HOME || path.join(os.homedir(), ".sabia");
}

export const caminhos = {
  config: () => path.join(home(), "config.json"),
  navegador: () => path.join(home(), "navegador"),
  conversas: () => path.join(home(), "conversas"),
};

/** chaves que vieram do ambiente real: a tela não consegue sobrescrever */
const doAmbiente = new Set<string>();
let carregado = false;

function lerArquivo(): Record<string, string> {
  try {
    const bruto = JSON.parse(fs.readFileSync(caminhos.config(), "utf8"));
    return Object.fromEntries(
      Object.entries(bruto as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")])
    );
  } catch {
    return {};
  }
}

function escrever(cfg: Record<string, string>) {
  fs.mkdirSync(home(), { recursive: true, mode: 0o700 });
  // 0600: tem senha e chave de API aqui dentro
  fs.writeFileSync(caminhos.config(), JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
}

export function lerDotEnv(arquivo: string): Record<string, string> {
  if (!fs.existsSync(arquivo)) return {};
  const out: Record<string, string> = {};
  for (const linha of fs.readFileSync(arquivo, "utf8").split("\n")) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

/**
 * Carrega a configuração em process.env. Na primeira vez, importa o .env do
 * projeto (quem já usava continua funcionando sem refazer nada).
 * Devolve o que aconteceu, para o terminal contar.
 */
export function carregarConfig(raizDoProjeto: string): { importouDotEnv: boolean } {
  if (!carregado) {
    for (const k of Object.keys(process.env)) doAmbiente.add(k);
    carregado = true;
  }
  const dotEnv = lerDotEnv(path.join(raizDoProjeto, ".env"));
  let importouDotEnv = false;
  if (!fs.existsSync(caminhos.config()) && Object.keys(dotEnv).length) {
    escrever(dotEnv);
    importouDotEnv = true;
  }
  const arquivo = lerArquivo();
  for (const [k, v] of Object.entries({ ...dotEnv, ...arquivo })) {
    if (!doAmbiente.has(k)) process.env[k] = v;
  }
  return { importouDotEnv };
}

export const lerConfig = (chave: string): string => process.env[chave] ?? "";

export function veioDoAmbiente(chave: string): boolean {
  return doAmbiente.has(chave);
}

/** Grava na config do home e aplica na hora. Valor vazio apaga a chave. */
export function salvarConfig(parcial: Record<string, string>) {
  const atual = lerArquivo();
  for (const [k, v] of Object.entries(parcial)) {
    if (veioDoAmbiente(k)) continue;
    if (v === "") {
      delete atual[k];
      delete process.env[k];
    } else {
      atual[k] = v;
      process.env[k] = v;
    }
  }
  escrever(atual);
}

/**
 * O perfil do navegador (cookies, o "confiar neste dispositivo" de 30 dias)
 * ficava em .profile-chrome/ dentro do projeto. Copia uma vez para o home,
 * para não pedir 2FA de novo. O original fica onde está.
 */
export function migrarNavegador(raizDoProjeto: string): boolean {
  const antigo = path.join(raizDoProjeto, ".profile-chrome");
  const novo = caminhos.navegador();
  if (fs.existsSync(novo) || !fs.existsSync(antigo)) return false;
  fs.mkdirSync(home(), { recursive: true, mode: 0o700 });
  fs.cpSync(antigo, novo, {
    recursive: true,
    // travas do Chrome aberto não podem ir junto
    filter: (origem) => !/Singleton(Lock|Socket|Cookie)$/.test(origem),
  });
  return true;
}
