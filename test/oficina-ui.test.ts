/**
 * A tela da oficina (`oficina/index.html`) num Chromium de verdade. Roda à
 * parte do `npm test` porque abre navegador: `npm run test:oficina`.
 *
 * O que está aqui é o que quebra CALADO e só aparece com trinta alunos na
 * sala: o realce do código é um <pre> pintado ATRÁS de um <textarea>
 * transparente, e os dois só ficam juntos enquanto tiverem exatamente a
 * mesma fonte, o mesmo tamanho, a mesma entrelinha e o mesmo padding. Um
 * pixel de diferença e o cursor anda fora da letra -- a página continua
 * "funcionando", e ninguém consegue mais editar direito.
 *
 * O test/oficina.test.ts, sem navegador, cuida da lógica do código do aluno.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";

const PAGINA =
  "file://" + path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "oficina", "index.html");

let navegador: Browser;
let p: Page;
const errosDeJs: string[] = [];

describe("tela da oficina", { timeout: 60_000 }, () => {
  before(async () => {
    navegador = await chromium.launch();
    p = await navegador.newPage({ viewport: { width: 1400, height: 900 } });
    p.on("pageerror", (e) => errosDeJs.push(e.message));
    await p.goto(PAGINA);
    await p.waitForSelector("#realce span");
  });
  after(async () => navegador?.close());

  /* ----------------------------- o realce ----------------------------- */

  test("o código do aluno nasce pintado, em todas as cores", async () => {
    const porClasse = await p.evaluate(() => {
      const conta: Record<string, number> = {};
      for (const s of document.querySelectorAll("#realce span")) {
        conta[s.className] = (conta[s.className] || 0) + 1;
      }
      return conta;
    });
    // o código inicial tem comentário, texto, número, chave de objeto,
    // palavra reservada, chamada de função e expressão regular: se alguma
    // some, é porque o realçador parou de reconhecer aquilo
    for (const classe of ["t-coment", "t-texto", "t-numero", "t-prop", "t-chave", "t-func", "t-regex"]) {
      assert.ok(porClasse[classe] > 0, `nada pintado como ${classe}`);
    }
  });

  test("o texto pintado é idêntico ao que está no editor", async () => {
    // qualquer caractere a mais ou a menos desloca TODAS as linhas seguintes
    const igual = await p.evaluate(() => {
      const ta = document.getElementById("codigo") as HTMLTextAreaElement;
      return document.getElementById("realce")!.textContent === ta.value + "\n";
    });
    assert.ok(igual, "o <pre> do realce não bate com o <textarea>");
  });

  test("editor e realce têm a mesma métrica (senão o cursor sai do lugar)", async () => {
    const diferencas = await p.evaluate(() => {
      const c = getComputedStyle(document.getElementById("codigo")!);
      const r = getComputedStyle(document.getElementById("realce")!);
      const campos = ["fontFamily", "fontSize", "lineHeight", "paddingTop", "paddingLeft", "whiteSpace", "tabSize", "letterSpacing"];
      return campos.filter((k) => c[k as never] !== r[k as never]).map((k) => `${k}: ${c[k as never]} ≠ ${r[k as never]}`);
    });
    assert.deepEqual(diferencas, []);
  });

  test("digitar mantém o realce e a rolagem em dia", async () => {
    await p.evaluate(() => {
      const ta = document.getElementById("codigo") as HTMLTextAreaElement;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });
    await p.keyboard.type('\n// linha nova\nconst n = 42;\n');
    const estado = await p.evaluate(() => {
      const ta = document.getElementById("codigo") as HTMLTextAreaElement;
      const pre = document.getElementById("realce")!;
      return { igual: pre.textContent === ta.value + "\n", pintou: pre.innerHTML.includes("linha nova") };
    });
    assert.ok(estado.igual, "digitar dessincronizou o realce");
    assert.ok(estado.pintou, "o texto novo não foi pintado");

    // a rolagem acerta no evento `scroll`, que o navegador dispara DEPOIS do
    // `input` ao arrastar o cursor para dentro da vista. Espera convergir, em
    // vez de medir no meio do caminho.
    await p.waitForFunction(
      () => {
        const ta = document.getElementById("codigo") as HTMLTextAreaElement;
        return Math.abs(document.getElementById("realce")!.scrollTop - ta.scrollTop) < 2;
      },
      undefined,
      { timeout: 2000 }
    );
  });

  test("o realce não quebra a página quando o código não compila", async () => {
    // meio de aspa aberta, meio de chave solta: o realçador vê isso o tempo
    // todo, porque o aluno digita devagar
    const quebrado = await p.evaluate(() => {
      const ta = document.getElementById("codigo") as HTMLTextAreaElement;
      ta.value = 'const x = "aberta\nif (/regex sem fim\nfunction( {';
      ta.dispatchEvent(new Event("input"));
      return document.getElementById("realce")!.textContent === ta.value + "\n";
    });
    assert.ok(quebrado, "o realce perdeu texto num código pela metade");
    assert.deepEqual(errosDeJs, []);
  });

  /* ------------------------------ o toast ------------------------------ */

  test("Rodar avisa num toast, que some sozinho e não empilha", async () => {
    await p.goto(PAGINA);
    await p.waitForSelector("#realce span");

    await p.click("#btn-rodar");
    const toast = p.locator("#toasts .toast");
    await toast.waitFor({ state: "visible", timeout: 2000 });
    assert.match(await toast.innerText(), /Código recarregado/);

    // clicar três vezes seguidas mostra UM aviso, não três empilhados
    await p.click("#btn-rodar");
    await p.click("#btn-rodar");
    assert.equal(await toast.count(), 1);

    // e ele sai de cena sem ninguém fechar
    await toast.first().waitFor({ state: "detached", timeout: 6000 });
  });

  test("o toast não tapa o que está embaixo dele", async () => {
    // pointer-events:none no contêiner: um aviso de 2,6s que engole cliques
    // no meio de uma oficina é pior do que aviso nenhum
    await p.click("#btn-rodar");
    await p.locator("#toasts .toast").first().waitFor({ state: "visible" });
    const passaClique = await p.evaluate(
      () => getComputedStyle(document.getElementById("toasts")!).pointerEvents
    );
    assert.equal(passaClique, "none");
  });

  /* --------------------- o que o roteiro promete --------------------- */

  test("Conferir dá 4 de 5, e o vermelho é o do Passo 3", async () => {
    await p.goto(PAGINA);
    await p.waitForSelector("#realce span");
    await p.click("#btn-conferir");
    await p.waitForSelector(".teste");
    assert.equal(await p.locator(".teste.p").count(), 4);
    assert.equal(await p.locator(".teste.f").count(), 1);
  });

  test("o assistente do aluno responde no chat", async () => {
    await p.fill("#entrada", "quais sao minhas notas?");
    await p.click("#btn-enviar");
    await p.locator(".row.bot").last().waitFor({ state: "visible", timeout: 5000 });
    assert.ok((await p.locator(".row.bot").count()) > 0);
  });

  test("nenhum erro de JavaScript na página inteira", async () => {
    assert.deepEqual(errosDeJs, []);
  });
});
