/**
 * Monta o Sabiá portátil para Windows: uma pasta que roda de onde estiver,
 * sem instalar nada, sem administrador e sem baixar nada na hora.
 *
 * Feito para a oficina: 30 máquinas de laboratório, quatro sessões no dia.
 * Lá não se pode contar com administrador (instalar o Node pede), nem com a
 * internet da escola (30 × 150 MB de Chromium ao mesmo tempo não passa), nem
 * com a máquina guardar estado entre sessões (laboratório reinicia limpo).
 *
 *   Sabia/
 *     node/node.exe          o Node desta máquina (no Windows, basta o .exe)
 *     app/node_modules/      o sabia instalado, com playwright e express
 *     ms-playwright/         o Chromium já baixado
 *     dados/                 config, sessão e conversas (apagar zera tudo)
 *     Sabia.bat              o duplo clique
 *     Sabia-sem-IA.bat       o plano B, se a API cair no meio da oficina
 *
 *   node scripts/empacotar-windows.mjs
 *
 * SÓ RODA NO WINDOWS: o Chromium é um binário por plataforma, e o Playwright
 * não baixa o de outro sistema. No CI isso cai no runner windows-latest.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const saida = path.join(raiz, "pacote-windows");
const destino = path.join(saida, "Sabia");

const falhar = (msg) => {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
};

const npm = (args, cwd, env) =>
  // o npm no Windows é um .cmd: precisa do shell (os argumentos aqui são fixos)
  execFileSync("npm.cmd", args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    shell: true,
    stdio: ["ignore", "pipe", "inherit"],
  });

async function montar() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sabia-windows-"));
  const versao = JSON.parse(fs.readFileSync(path.join(raiz, "package.json"), "utf8")).version;

  try {
    fs.rmSync(saida, { recursive: true, force: true });
    fs.mkdirSync(destino, { recursive: true });

    /* 1. o pacote, igual ao que o npx instala */
    console.log("  compilando e empacotando...");
    execFileSync("npm.cmd", ["run", "build"], { cwd: raiz, stdio: "inherit", shell: true });
    const [{ filename }] = JSON.parse(npm(["pack", "--json", "--ignore-scripts", "--pack-destination", tmp], raiz));

    /* 2. instalado numa pasta limpa, sem as ferramentas de desenvolvimento.
          O Chromium NÃO vem pelo npm: ele é baixado no passo 4, para dentro
          da pasta, e não para o cache do usuário que montou o ZIP. */
    console.log(`  instalando ${filename} em app/...`);
    const app = path.join(destino, "app");
    fs.mkdirSync(app);
    npm(["init", "-y"], app);
    npm(["install", "--no-audit", "--no-fund", "--omit=dev", path.join(tmp, filename)], app, {
      PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1",
    });

    // o mesmo Playwright que os testes usaram, como o conferir-pacote.mjs exige
    const versaoDe = (pasta) =>
      JSON.parse(fs.readFileSync(path.join(pasta, "node_modules", "playwright", "package.json"), "utf8")).version;
    if (versaoDe(app) !== versaoDe(raiz)) falhar(`Playwright ${versaoDe(app)} no pacote, mas ${versaoDe(raiz)} nos testes`);
    console.log(`  ✓ Playwright ${versaoDe(app)}, o mesmo dos testes`);

    /* 3. o Node. No Windows o node.exe é autossuficiente: não precisa do zip
          oficial inteiro nem do npm, que o pacote não usa para rodar. Copiar o
          desta máquina (em vez de baixar uma versão escolhida a dedo) garante
          que vai o MESMO Node que o CI acabou de testar. */
    const node = path.join(destino, "node");
    fs.mkdirSync(node);
    fs.copyFileSync(process.execPath, path.join(node, "node.exe"));
    console.log(`  ✓ Node ${process.versions.node} embutido (node.exe, ${mb(path.join(node, "node.exe"))})`);

    /* 4. o Chromium, para dentro da pasta */
    console.log("  baixando o Chromium para dentro do pacote (uns 150 MB)...");
    const navegadores = path.join(destino, "ms-playwright");
    execFileSync(process.execPath, [path.join(app, "node_modules", "playwright", "cli.js"), "install", "chromium"], {
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: navegadores },
      stdio: "inherit",
    });
    if (!fs.existsSync(navegadores)) falhar("o Chromium não foi para dentro do pacote");

    /* 5. os atalhos e o recado */
    escreverBat(path.join(destino, "Sabia.bat"), "deepseek");
    escreverBat(path.join(destino, "Sabia-sem-IA.bat"), "local");
    // o BOM faz o Bloco de Notas mostrar os acentos certos
    fs.writeFileSync(path.join(destino, "LEIA-ME.txt"), "﻿" + leiaMe(), "utf8");

    /* 6. a prova: o Node embutido roda o Sabiá e ACHA o Chromium da pasta.
          Sem isto, um erro de caminho só apareceria na oficina. */
    console.log("  conferindo o pacote montado...");
    const doctor = execFileSync(
      path.join(node, "node.exe"),
      [path.join(app, "node_modules", "sabia", "bin", "sabia.mjs"), "doctor"],
      {
        env: {
          ...process.env,
          SABIA_HOME: path.join(tmp, "home"),
          PLAYWRIGHT_BROWSERS_PATH: navegadores,
        },
        encoding: "utf8",
      }
    );
    if (!doctor.includes("✓ Navegador")) falhar(`o pacote não acha o próprio Chromium:\n${doctor}`);
    if (!doctor.includes("✓ Tela compilada")) falhar(`o pacote não tem a tela:\n${doctor}`);
    console.log("  ✓ o Node embutido sobe o Sabiá e acha o Chromium da pasta");

    /* 7. o ZIP. O tar do Windows 10+ faz zip e é bem mais rápido que o
          Compress-Archive do PowerShell nestes 250 MB. */
    const zip = path.join(saida, `sabia-windows-${versao}.zip`);
    console.log("  compactando...");
    execFileSync("tar", ["-a", "-c", "-f", zip, "-C", saida, "Sabia"], { stdio: "inherit" });
    console.log(`\n  Pronto: ${path.relative(raiz, zip)} (${mb(zip)})\n`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  }
}

function mb(arquivo) {
  return `${(fs.statSync(arquivo).size / 1024 / 1024).toFixed(0)} MB`;
}

/**
 * Os .bat ficam sem acento no nome e no conteúdo de propósito: o cmd lê o
 * arquivo na página de código da máquina, e acento viraria caractere torto
 * numa máquina de escola com configuração regional diferente.
 *
 * As quebras de linha vão em CRLF: o cmd erra ao ler .bat com LF só.
 */
function escreverBat(arquivo, provedor) {
  fs.writeFileSync(arquivo, conteudoBat(provedor), "utf8");
}

export function conteudoBat(provedor) {
  const chave =
    provedor === "deepseek"
      ? [
          "rem ===== A CHAVE DA IA =====",
          "rem Troque COLE-A-CHAVE-AQUI pela chave do seu grupo de maquinas,",
          "rem UMA VEZ, antes de copiar a pasta para o pendrive.",
          'set "DEEPSEEK_API_KEY=COLE-A-CHAVE-AQUI"',
          'set "DEEPSEEK_MODEL=deepseek-chat"',
          "",
          'if "%DEEPSEEK_API_KEY%"=="COLE-A-CHAVE-AQUI" (',
          "  echo.",
          "  echo   A chave da IA nao foi preenchida neste arquivo.",
          "  echo   Abra o Sabia.bat no Bloco de Notas e cole a chave,",
          "  echo   ou use o Sabia-sem-IA.bat para rodar sem IA.",
          "  echo.",
          "  pause",
          "  exit /b 1",
          ")",
        ]
      : [
          "rem O plano B: sem IA nenhuma. Continua lendo os dados reais do",
          "rem ClassApp, respondendo por regras de palavra-chave.",
        ];

  const linhas = [
    "@echo off",
    "rem O Sabia portatil. Nao instala nada, nao pede administrador.",
    "chcp 65001 >nul",
    "setlocal",
    'cd /d "%~dp0"',
    "",
    "rem Tudo da pessoa fica DENTRO desta pasta, nao no perfil do Windows:",
    "rem apagar a pasta dados\\ zera o Sabia. Faca isso entre as sessoes da",
    "rem oficina, senao o proximo aluno entra na conta do anterior.",
    'set "SABIA_HOME=%~dp0dados"',
    "",
    "rem o Chromium que veio no pacote, em vez do cache do usuario",
    'set "PLAYWRIGHT_BROWSERS_PATH=%~dp0ms-playwright"',
    "",
    `set "LLM_PROVIDER=${provedor}"`,
    ...chave,
    "",
    'echo   Subindo o Sabia... a tela abre no navegador. Para fechar, Ctrl+C.',
    "echo.",
    '"%~dp0node\\node.exe" "%~dp0app\\node_modules\\sabia\\bin\\sabia.mjs" %*',
    "",
    "rem se caiu com erro, a janela fica aberta para a pessoa ler o motivo",
    "if errorlevel 1 pause",
  ];
  return linhas.join("\r\n") + "\r\n";
}

// função, e não const: o texto é usado lá em cima, antes desta linha
function leiaMe() {
  return `Sabiá portátil — Windows
========================

Não instala nada. Não pede administrador. Não baixa nada.

COMO USAR
---------
1. Copie esta pasta para o computador (a Área de Trabalho serve).
   Não rode direto do pendrive: o navegador fica lento demais.
2. Dê dois cliques em Sabia.bat.
3. A tela abre no navegador. Siga os três passos: escolher a IA,
   preencher a conta do ClassApp e fazer o primeiro login (o código
   de dois fatores é pedido na própria tela).
4. Para fechar, aperte Ctrl+C na janela preta.

Se o Windows mostrar "O Windows protegeu o seu computador", clique em
"Mais informações" e depois em "Executar assim mesmo". Isso acontece
porque o pacote não tem assinatura digital paga.

ANTES DA OFICINA (uma vez só)
-----------------------------
Abra o Sabia.bat no Bloco de Notas e troque COLE-A-CHAVE-AQUI pela
chave da DeepSeek. Faça isso UMA vez, antes de copiar a pasta para o
pendrive, e não depois em cada máquina.

ENTRE AS SESSÕES
----------------
Apague a pasta "dados". Ela guarda a conta, a sessão do navegador e as
conversas de quem usou. Sem apagar, o próximo aluno abre o Sabiá já
dentro da conta do aluno anterior.

SE A IA CAIR
------------
Use o Sabia-sem-IA.bat. Ele continua lendo os dados reais do ClassApp e
responde por regras de palavra-chave, sem chamar modelo nenhum.

O QUE TEM DENTRO
----------------
node\\        o Node, só o node.exe (não mexe no Windows)
app\\         o Sabiá e as bibliotecas dele
ms-playwright\\  o navegador que o Sabiá opera
dados\\       criada no primeiro uso; é o que apagar entre sessões

O Sabiá só aceita conexões desta máquina: ninguém na mesma rede acessa.
`;
}

/* Rodado direto (e não importado pelo teste): monta o pacote. */
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  if (process.platform !== "win32") {
    falhar(
      "este empacotador só roda no Windows.\n" +
        "    O Chromium é um binário por plataforma: montar daqui geraria um ZIP\n" +
        "    com o navegador errado, que falha só na mão de quem usa.\n" +
        "    No CI, o job 'pacote-windows' faz isto no runner windows-latest."
    );
  }
  await montar();
}
