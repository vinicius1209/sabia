/**
 * O conteúdo dos .bat do pacote portátil de Windows.
 *
 * O empacotamento em si só roda no Windows (o Chromium é um binário por
 * plataforma), e no CI é o job `pacote-windows` que confere o ZIP montado.
 * Aqui dá para conferir, em qualquer sistema, o que mais quebraria calado:
 * uma variável errada no .bat só apareceria na mão de um aluno na oficina.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { conteudoBat } from "../scripts/empacotar-windows.mjs";

const comIA = conteudoBat("deepseek");
const semIA = conteudoBat("local");

test("o .bat guarda os dados DENTRO da pasta, não no perfil do Windows", () => {
  // é o que permite apagar a pasta entre as sessões da oficina e a máquina
  // voltar limpa para o próximo aluno
  for (const bat of [comIA, semIA]) assert.match(bat, /set "SABIA_HOME=%~dp0dados"/);
});

test("o .bat aponta para o Chromium que veio no pacote", () => {
  // sem isto o Playwright procura no cache do usuário, não acha, e tenta
  // baixar 150 MB na rede da escola: justo o que o pacote existe para evitar
  for (const bat of [comIA, semIA]) assert.match(bat, /set "PLAYWRIGHT_BROWSERS_PATH=%~dp0ms-playwright"/);
});

test("o .bat roda o Node embutido, nunca o do computador", () => {
  for (const bat of [comIA, semIA]) {
    assert.match(bat, /"%~dp0node\\node\.exe"/);
    assert.match(bat, /app\\node_modules\\sabia\\bin\\sabia\.mjs/);
  }
});

test("cada .bat fixa o seu motor", () => {
  assert.match(comIA, /set "LLM_PROVIDER=deepseek"/);
  assert.match(semIA, /set "LLM_PROVIDER=local"/);
});

test("o plano B não pede chave nenhuma", () => {
  assert.doesNotMatch(semIA, /DEEPSEEK_API_KEY/);
});

test("o .bat da IA avisa, em vez de subir com a chave de exemplo", () => {
  assert.match(comIA, /DEEPSEEK_API_KEY=COLE-A-CHAVE-AQUI/);
  assert.match(comIA, /if "%DEEPSEEK_API_KEY%"=="COLE-A-CHAVE-AQUI"/);
  assert.match(comIA, /exit \/b 1/);
});

test("as linhas acabam em CRLF (o cmd erra com LF só)", () => {
  for (const bat of [comIA, semIA]) {
    assert.ok(bat.endsWith("\r\n"));
    assert.equal(bat.split("\n").length, bat.split("\r\n").length);
  }
});

test("os .bat não têm acento (a página de código da máquina varia)", () => {
  for (const bat of [comIA, semIA]) assert.doesNotMatch(bat, /[^\x00-\x7F]/);
});

test("a janela não fecha sozinha quando dá erro", () => {
  // numa oficina, uma janela que pisca e desaparece não diz o que houve
  for (const bat of [comIA, semIA]) assert.match(bat, /if errorlevel 1 pause/);
});
