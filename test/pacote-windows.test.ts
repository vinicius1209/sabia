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
import { conteudoBat, conteudoLimpar } from "../scripts/empacotar-windows.mjs";

const comIA = conteudoBat("deepseek");
const semIA = conteudoBat("local");
const limpar = conteudoLimpar();

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

/* ------------------- o Limpar.bat, a troca de alunos ------------------- */

test("o Limpar.bat apaga a pasta dados INTEIRA, e não só o config.json", () => {
  // apagar só o config.json é pior do que não limpar: o perfil do navegador
  // sobrevive, o Sabiá entra na sessão velha antes de olhar a conta nova, e
  // o aluno da sessão seguinte recebe o boletim do anterior
  assert.match(limpar, /rmdir \/s \/q "dados"/);
  assert.doesNotMatch(limpar, /config\.json/);
});

test("o Limpar.bat pergunta antes, e só o S apaga", () => {
  assert.match(limpar, /set \/p "RESPOSTA=/);
  assert.match(limpar, /if \/i "%RESPOSTA%"=="S" goto apagar/);
  // Enter vazio não apaga: RESPOSTA é zerada antes do set /p
  assert.ok(limpar.indexOf('set "RESPOSTA="') < limpar.indexOf('set /p "RESPOSTA='));
});

test("a pergunta não mora dentro de bloco de parênteses", () => {
  // num bloco, %RESPOSTA% é trocado pelo valor ANTIGO (vazio) quando o cmd lê
  // o bloco, antes do set /p rodar: a resposta da pessoa nunca contaria
  const depoisDoSetP = limpar.slice(limpar.indexOf('set /p "RESPOSTA='));
  const ate = depoisDoSetP.slice(0, depoisDoSetP.indexOf("goto apagar"));
  assert.doesNotMatch(ate, /\(/);
});

test("o /S pula a pergunta (script, e o teste do empacotador)", () => {
  assert.match(limpar, /if \/i "%~1"=="\/S" goto apagar/);
  assert.match(limpar, /^:apagar\r$/m);
});

test("o Limpar.bat não troca a página de código", () => {
  // chcp 65001 estraga o `set /p` quando a entrada não é o teclado -- foi o
  // que fez o teste do CI ver "cancelado" em vez da resposta. Aqui não se
  // imprime acento nenhum, então não há o que a página de código resolver.
  // o comando, não a palavra: o próprio .bat tem um `rem` explicando a ausência
  assert.doesNotMatch(limpar, /^chcp/m);
  assert.match(comIA, /^chcp 65001/m); // lá ela é necessária: o Node imprime acento
});

test("o Limpar.bat avisa quando o Sabiá está aberto segurando o perfil", () => {
  // o Chrome trava arquivos do perfil: limpar pela metade é pior do que não
  // limpar, porque parece que limpou
  assert.match(limpar, /if exist "dados" \(/);
  assert.match(limpar, /NAO consegui apagar tudo/);
  assert.match(limpar, /exit \/b 1/);
});

test("o Limpar.bat não encosta na chave da IA", () => {
  // a chave mora no Sabia.bat: limpar entre sessões não pode custar uma
  // viagem ao Bloco de Notas em 30 máquinas
  assert.doesNotMatch(limpar, /CHAVE=|DEEPSEEK|SABIA_PADRAO_/);
  assert.match(limpar, /A chave da IA NAO se perde/);
});

test("o Limpar.bat não fecha a janela sem a pessoa ler", () => {
  // em todos os caminhos: já limpo, cancelado, falhou e deu certo
  // (\r no fim: o arquivo é CRLF, e `$` do JS casa antes do \n, não do \r)
  assert.equal(limpar.match(/^ *pause\r$/gm)?.length, 4);
});

test("as linhas acabam em CRLF (o cmd erra com LF só)", () => {
  for (const bat of [comIA, semIA, limpar]) {
    assert.ok(bat.endsWith("\r\n"));
    assert.equal(bat.split("\n").length, bat.split("\r\n").length);
  }
});

test("os .bat não têm acento (a página de código da máquina varia)", () => {
  for (const bat of [comIA, semIA, limpar]) assert.doesNotMatch(bat, /[^\x00-\x7F]/);
});

test("a janela não fecha sozinha quando dá erro", () => {
  // numa oficina, uma janela que pisca e desaparece não diz o que houve
  for (const bat of [comIA, semIA]) assert.match(bat, /if errorlevel 1 pause/);
});
