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
 *     oficina/index.html     a página onde o aluno escreve o assistente dele
 *     offline/index.html     o Sabiá simulado, para quando a rede cai
 *     dados/                 config, sessão e conversas (apagar zera tudo)
 *     Sabia.bat              o duplo clique
 *     Sabia-sem-IA.bat       o plano B, se a API cair no meio da oficina
 *     Limpar.bat             a troca de alunos entre as sessões
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
    fs.writeFileSync(path.join(destino, "Limpar.bat"), conteudoLimpar(), "utf8");
    // o BOM faz o Bloco de Notas mostrar os acentos certos
    fs.writeFileSync(path.join(destino, "LEIA-ME.txt"), "﻿" + leiaMe(), "utf8");

    /* 5b. as duas páginas soltas da oficina. São 60 KB num pacote de 364 MB,
           e sem elas o plano B documentado não existe na máquina que precisa
           dele: a tabela de problemas manda abrir o offline/index.html
           "do repositório", e na hora em que a rede cai não há repositório
           nenhum ali. A página da oficina continua podendo ser servida na
           rede local na véspera; aqui ela deixa de ser a única forma. */
    for (const pagina of ["oficina", "offline"]) {
      const origem = path.join(raiz, pagina, "index.html");
      if (!fs.existsSync(origem)) falhar(`faltou ${pagina}/index.html para pôr no pacote`);
      fs.mkdirSync(path.join(destino, pagina), { recursive: true });
      fs.copyFileSync(origem, path.join(destino, pagina, "index.html"));
    }
    console.log("  ✓ oficina/ e offline/ no pacote (abrem sem rede e sem o Sabiá)");

    /* 6. a prova: roda o PRÓPRIO Sabia.bat, e não o node.exe por fora.
          Assim o que é conferido é o arquivo que a pessoa vai clicar: erro
          de sintaxe do cmd, caminho errado ou variável que não chega só
          apareceriam na oficina. `doctor` imprime e sai (sempre com 0), e
          `<NUL` responde ao `pause` do aviso da chave em branco. */
    console.log("  conferindo o pacote montado (rodando o proprio Sabia.bat)...");
    const doctor = execFileSync("cmd.exe", ["/d", "/c", "Sabia.bat doctor <NUL"], {
      cwd: destino,
      encoding: "utf8",
    });
    if (!doctor.includes("✓ Navegador")) falhar(`o pacote não acha o próprio Chromium:\n${doctor}`);
    if (!doctor.includes("✓ Tela compilada")) falhar(`o pacote não tem a tela:\n${doctor}`);
    // prova que SABIA_PADRAO_LLM_PROVIDER chegou: sem isto o .bat subiria no
    // motor automático, que procura CLI de assinatura que a escola não tem
    if (!doctor.includes("escolhido: deepseek")) falhar(`o .bat não entregou o motor:\n${doctor}`);
    if (!doctor.includes("\\Sabia\\dados")) falhar(`o .bat não apontou os dados para dentro da pasta:\n${doctor}`);
    console.log("  ✓ o Sabia.bat sobe o Sabiá, acha o Chromium da pasta e entrega o motor");

    /* 6b. o Limpar.bat apaga de verdade. Um Limpar que não limpa é a falha
           mais cara deste pacote: a turma seguinte entra na conta da
           anterior e ninguém percebe na hora.
           A pasta é montada aqui, com as três coisas que importam, em vez de
           esperar que o doctor a crie -- assim o teste vale mesmo que um dia
           o doctor pare de escrever qualquer coisa.
           `<NUL` não serve: o `set /p` precisa ler o "S". */
    const dados = path.join(destino, "dados");
    const montarDados = () => {
      fs.mkdirSync(path.join(dados, "navegador", "Default"), { recursive: true });
      fs.mkdirSync(path.join(dados, "conversas"), { recursive: true });
      fs.writeFileSync(path.join(dados, "config.json"), '{"CLASSAPP_PHONE":"da sessao anterior"}\n');
      fs.writeFileSync(path.join(dados, "navegador", "Default", "Cookies"), "sessao do aluno anterior");
    };
    const limpar = (args) =>
      execFileSync("cmd.exe", ["/d", "/c", `Limpar.bat${args} <NUL`], { cwd: destino, encoding: "utf8" });

    // sem confirmar, não apaga. Esta é a metade que protege: um Limpar que
    // apaga com um Enter distraído derruba a sessão de quem está no meio dela
    montarDados();
    const cancelado = limpar("");
    if (!fs.existsSync(dados)) falhar(`o Limpar.bat apagou sem ninguém confirmar:\n${cancelado}`);
    if (!cancelado.includes("Nada foi apagado")) falhar(`o Limpar.bat não avisou que parou:\n${cancelado}`);

    // confirmando, apaga tudo
    const limpeza = limpar(" /S");
    if (fs.existsSync(dados)) falhar(`o Limpar.bat não apagou a pasta dados:\n${limpeza}`);
    if (!limpeza.includes("comeca do zero")) falhar(`o Limpar.bat não confirmou a limpeza:\n${limpeza}`);
    console.log("  ✓ o Limpar.bat apaga a pasta dados inteira, e só depois de confirmar");

    // e o que o doctor por acaso tenha criado também não vai no ZIP
    fs.rmSync(dados, { recursive: true, force: true });

    /* 7. o ZIP. O tar do Windows 10+ faz zip e é bem mais rápido que o
          Compress-Archive do PowerShell nestes 7,6 mil arquivos. */
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
          "rem ===================== A CHAVE DA IA =====================",
          "rem Troque COLE-A-CHAVE-AQUI, na linha abaixo, pela chave do seu",
          "rem grupo de maquinas. Faca isso UMA vez, antes de copiar a pasta",
          "rem para o pendrive, e nao depois em cada maquina.",
          "",
          'set "CHAVE=COLE-A-CHAVE-AQUI"',
          "",
          "rem =========================================================",
          "rem Daqui para baixo nao precisa mexer.",
          "",
          'if not "%CHAVE%"=="COLE-A-CHAVE-AQUI" set "SABIA_PADRAO_DEEPSEEK_API_KEY=%CHAVE%"',
          'if "%CHAVE%"=="COLE-A-CHAVE-AQUI" (',
          "  echo.",
          "  echo   A chave da IA nao foi preenchida neste arquivo.",
          "  echo   Abra o Sabia.bat no Bloco de Notas e cole a chave na linha",
          '  echo   set "CHAVE=...", ou cole na propria tela do Sabia, em',
          "  echo   Ajustes. Sem chave nenhuma, use o Sabia-sem-IA.bat.",
          "  echo.",
          "  pause",
          ")",
        ]
      : [
          "rem O plano B: sem IA nenhuma. Continua lendo os dados reais do",
          "rem ClassApp, respondendo por regras de palavra-chave.",
        ];

  // SABIA_PADRAO_: palpite inicial, e nao trava. Variavel de ambiente de
  // verdade a tela nao consegue trocar (ver src/nucleo/config.ts), e a
  // pessoa ficaria presa ao motor e a chave que vieram do pendrive.
  const motor =
    provedor === "deepseek"
      ? [
          'set "SABIA_PADRAO_LLM_PROVIDER=deepseek"',
          'set "SABIA_PADRAO_DEEPSEEK_MODEL=deepseek-chat"',
        ]
      : ['set "SABIA_PADRAO_LLM_PROVIDER=local"'];

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
    "rem A conta do ClassApp (celular e senha) NAO fica aqui: e preenchida na",
    "rem tela, no primeiro uso, e trocada quando quiser em Ajustes.",
    'set "SABIA_HOME=%~dp0dados"',
    "",
    "rem o Chromium que veio no pacote, em vez do cache do usuario",
    'set "PLAYWRIGHT_BROWSERS_PATH=%~dp0ms-playwright"',
    "",
    ...chave,
    "",
    ...motor,
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

/**
 * O .bat da troca de alunos entre as sessões da oficina.
 *
 * Apagar só o config.json NÃO serve, e falha de um jeito pior do que não
 * limpar: o perfil do navegador sobrevive, o login do ClassApp confere a
 * sessão antes de olhar as credenciais, e o aluno novo digita a conta
 * dele para receber o boletim do aluno anterior. Tem de ser a pasta
 * inteira -- e é por isso que isto existe como botão, e não como recado
 * pedindo para alguém apagar a pasta certa com pressa entre duas turmas.
 */
export function conteudoLimpar() {
  const linhas = [
    "@echo off",
    "rem Limpa o Sabia entre as sessoes da oficina: apaga a pasta dados\\, que",
    "rem guarda a conta, a sessao do navegador e as conversas de quem usou.",
    "rem Sem isto o proximo aluno abre o Sabia dentro da conta do anterior.",
    "rem",
    "rem Limpar.bat      pergunta antes (o duplo clique)",
    "rem Limpar.bat /S   apaga direto, sem perguntar (script, e o teste do CI)",
    "rem",
    "rem Sem chcp de proposito: aqui nao se imprime acento nenhum, e a pagina",
    "rem de codigo 65001 estraga o `set /p` quando a entrada nao e o teclado.",
    "setlocal",
    'cd /d "%~dp0"',
    "",
    "echo.",
    "echo   Limpar o Sabia para o proximo aluno",
    "echo   -----------------------------------",
    "echo.",
    "",
    'if not exist "dados" (',
    "  echo   Ja esta limpo: nao existe pasta dados aqui.",
    "  echo.",
    "  pause",
    "  exit /b 0",
    ")",
    "",
    'if /i "%~1"=="/S" goto apagar',
    "",
    "echo   Vai apagar a pasta dados, que tem:",
    "echo     - a conta do ClassApp que foi preenchida na tela",
    "echo     - a sessao do navegador, com o login de 30 dias",
    "echo     - as conversas desta sessao",
    "echo.",
    "echo   A chave da IA NAO se perde: ela mora no Sabia.bat.",
    "echo.",
    "",
    // sem bloco de parenteses: dentro de um, %RESPOSTA% seria trocado pelo
    // valor ANTIGO (vazio) na hora de ler o bloco, antes do set /p rodar
    'set "RESPOSTA="',
    'set /p "RESPOSTA=  Apagar agora? Digite S e de Enter: "',
    'if /i "%RESPOSTA%"=="S" goto apagar',
    "",
    "echo.",
    "echo   Nada foi apagado.",
    "echo.",
    "pause",
    "exit /b 0",
    "",
    ":apagar",
    'rmdir /s /q "dados"',
    "",
    "rem o Chrome segura arquivos do perfil enquanto esta aberto: se sobrou",
    "rem pasta, foi isso, e limpar pela metade e pior do que nao limpar",
    'if exist "dados" (',
    "  echo.",
    "  echo   NAO consegui apagar tudo.",
    "  echo   O Sabia deve estar aberto. Feche a janela preta com Ctrl+C,",
    "  echo   feche o navegador que ele abriu, e rode este Limpar de novo.",
    "  echo.",
    "  pause",
    "  exit /b 1",
    ")",
    "",
    "echo.",
    "echo   Pronto. O proximo aluno comeca do zero.",
    "echo.",
    "pause",
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
1. Copie o ZIP (sabia-windows-*.zip) do pendrive para a Área de Trabalho e
   extraia ali: clique com o botão direito e "Extrair tudo".
   Copie o ZIP, e não a pasta já extraída: são 7 mil arquivos pequenos, e
   copiar um arquivo só de 364 MB é bem mais rápido.
   Não rode direto do pendrive: o navegador fica lento demais.
   A máquina precisa de uns 1,3 GB livres (o ZIP mais a pasta extraída).
2. Entre na pasta Sabia e dê dois cliques em Sabia.bat.
3. A tela abre no navegador. Siga os três passos: escolher a IA,
   preencher a conta do ClassApp e fazer o primeiro login (o código
   de dois fatores é pedido na própria tela).
4. Para fechar, aperte Ctrl+C na janela preta.

Se o Windows mostrar "O Windows protegeu o seu computador", clique em
"Mais informações" e depois em "Executar assim mesmo". Isso acontece
porque o pacote não tem assinatura digital paga.

ONDE FICA A CHAVE DA IA
-----------------------
No Sabia.bat, na linha

    set "CHAVE=COLE-A-CHAVE-AQUI"

Abra o arquivo no Bloco de Notas, troque COLE-A-CHAVE-AQUI pela chave da
DeepSeek e salve. Faça isso UMA vez, antes de copiar a pasta para o
pendrive, e não depois em cada máquina.

Se a chave furar no meio da oficina, dá para colar outra sem fechar nada:
na tela do Sabiá, Ajustes -> Motor de IA. Essa troca vale só até você
apagar a pasta "dados"; depois disso volta a valer a chave do Sabia.bat.

ONDE FICA O LOGIN DO CLASSAPP
-----------------------------
Em arquivo nenhum: celular e senha são preenchidos NA TELA.

  - na primeira vez, no passo 2 do assistente que abre sozinho;
  - depois, quando quiser: Ajustes -> a seção da conta. Troque os
    campos, salve, e clique em "Conectar" logo abaixo para refazer o
    login com a conta nova.

Ficam gravados em dados\\config.json, só nesta máquina. É de propósito
que não estão no Sabia.bat: a chave da IA é a mesma nas 30 máquinas, mas
a conta é de cada aluno e precisa sumir no fim da sessão.

ENTRE AS SESSÕES (a troca de alunos)
------------------------------------
Feche o Sabiá e dê dois cliques em **Limpar.bat**. Ele apaga a pasta
"dados", que guarda a conta, a sessão do navegador e as conversas de quem
usou, e pede confirmação antes. A chave da IA não se perde: ela está no
Sabia.bat.

Sem limpar, o próximo aluno abre o Sabiá já dentro da conta do anterior.

Não adianta apagar só o "config.json" de dentro de "dados": a sessão do
navegador continua de pé, e o Sabiá entra nela antes de olhar a conta
que o aluno novo preencheu — ele digitaria a conta dele e receberia o
boletim do aluno anterior. É a pasta inteira, e é isso que o Limpar.bat
faz.

SE A IA CAIR
------------
Use o Sabia-sem-IA.bat. Ele continua lendo os dados reais do ClassApp e
responde por regras de palavra-chave, sem chamar modelo nenhum.

SE A REDE CAIR
--------------
Abra o offline\\index.html: é o Sabiá simulado, com dados fictícios, que
abre no navegador sem internet e sem subir nada.

A PÁGINA DA OFICINA
-------------------
oficina\\index.html é a página onde o aluno escreve o próprio assistente,
antes de ver o Sabiá. Um arquivo só, com dados fictícios, que abre com
dois cliques. Não precisa do Sabiá rodando nem de internet.

O QUE TEM DENTRO
----------------
node\\        o Node, só o node.exe (não mexe no Windows)
app\\         o Sabiá e as bibliotecas dele
ms-playwright\\  o navegador que o Sabiá opera
oficina\\     a página do aluno (abre sozinha)
offline\\     o Sabiá simulado, para quando a rede cai
dados\\       criada no primeiro uso; é o que o Limpar.bat apaga

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
