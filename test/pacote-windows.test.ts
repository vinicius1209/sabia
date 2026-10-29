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

test("cada .bat escolhe o seu motor", () => {
  assert.match(comIA, /set "SABIA_PADRAO_LLM_PROVIDER=deepseek"/);
  assert.match(semIA, /set "SABIA_PADRAO_LLM_PROVIDER=local"/);
});

test("o plano B não pede chave nenhuma", () => {
  assert.doesNotMatch(semIA, /DEEPSEEK_API_KEY/);
});

test("a chave e o motor são padrão, não trava: a tela ainda troca", () => {
  // variável de ambiente de verdade o config.ts não deixa a tela mexer. Se
  // o .bat exportasse DEEPSEEK_API_KEY direto, colar uma chave nova em
  // Ajustes não faria nada -- e a tela ainda diria "chave salva".
  for (const bat of [comIA, semIA]) {
    assert.doesNotMatch(bat, /^set "LLM_PROVIDER=/m);
    assert.doesNotMatch(bat, /^set "DEEPSEEK_API_KEY=/m);
  }
  assert.match(comIA, /set "SABIA_PADRAO_DEEPSEEK_API_KEY=%CHAVE%"/);
});

test("a chave fica numa linha só, achável por quem não programa", () => {
  assert.match(comIA, /^set "CHAVE=COLE-A-CHAVE-AQUI"\r$/m);
});

test("o .bat da IA avisa quando ninguém preencheu a chave", () => {
  assert.match(comIA, /if "%CHAVE%"=="COLE-A-CHAVE-AQUI" \(/);
  // e não exporta a chave de exemplo como se fosse chave
  assert.match(comIA, /if not "%CHAVE%"=="COLE-A-CHAVE-AQUI" set "SABIA_PADRAO_DEEPSEEK_API_KEY=/);
  // sem sair: dá para colar a chave na própria tela, em Ajustes
  assert.doesNotMatch(comIA, /exit \/b 1/);
});

test("o .bat não guarda a conta do ClassApp", () => {
  // é de cada aluno, tem de sumir com a pasta dados\ no fim da sessão
  for (const bat of [comIA, semIA]) assert.doesNotMatch(bat, /CLASSAPP_(PHONE|PASSWORD)=/);
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
