/**
 * A máscara do telão, num Chromium de verdade com páginas de mentira (nada de
 * rede, nada da conta). Roda à parte do `npm test` porque abre navegador:
 * `npm run test:mascara`.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, type Browser, type Page } from "playwright";
import { scriptDaMascara, termosDaMascara } from "../src/agentes/sabia/mascara.ts";

const PAGINA = `<!doctype html><html><head><title>Portal</title></head><body>
  <header><img id="foto" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="60" height="60" /><h2 id="nome">AURORA LIS EXEMPLO FICTICIO</h2><span id="turma">Ensino Médio 3BEM</span></header>
  <table>
    <tr id="mat"><td>Matrícula</td><td>123456</td></tr>
    <tr id="nota"><td>Matemática</td><td>9,5</td></tr>
  </table>
  <p id="nasc">Data de nascimento: 01/02/2009</p>
  <dl id="fil"><dt>Filiação</dt><dd>Fulana de Tal</dd></dl>
  <p id="fone">Contato: (47) 99999-1234</p>
  <p id="prof">Prof. Rafael Pai-Nosso, Paisagismo</p>
  <input id="senha" type="password" value="segredo" />
</body></html>`;

let navegador: Browser;
let pagina: Page;

async function abrir(termos: string[], html = PAGINA) {
  const ctx = await navegador.newContext();
  await ctx.addInitScript(scriptDaMascara, { termos });
  await ctx.route("https://portal.teste/**", (r) => r.fulfill({ contentType: "text/html; charset=utf-8", body: html }));
  pagina = await ctx.newPage();
  await pagina.goto("https://portal.teste/");
  return pagina;
}

const borrado = (p: Page, id: string) =>
  p.evaluate((id) => {
    const el = document.getElementById(id)!;
    for (let e: Element | null = el; e; e = e.parentElement) if (getComputedStyle(e).filter.includes("blur")) return true;
    return false;
  }, id);
const opacidade = (p: Page) => p.evaluate(() => getComputedStyle(document.documentElement).opacity);

describe("mascara do telao", { timeout: 30_000 }, () => {
  before(async () => {
    navegador = await chromium.launch();
  });
  after(async () => {
    await navegador.close();
  });

  const termos = termosDaMascara({ ALUNO_NOME: "Aurora", CLASSAPP_PHONE: "(47) 90000-5678" });

  test("borra nome, matricula, nascimento, filiacao, telefone e campos", async () => {
    const p = await abrir(termos);
    for (const id of ["nome", "foto", "mat", "nasc", "fil", "fone", "senha"]) {
      assert.equal(await borrado(p, id), true, `${id} ficou legivel no telao`);
    }
    assert.equal(await opacidade(p), "1", "a pagina nao apareceu depois da mascara");
  });

  test("nao borra o que e a demonstracao (notas, turma, nome de professor)", async () => {
    const p = await abrir(termos);
    for (const id of ["nota", "turma", "prof"]) assert.equal(await borrado(p, id), false, `${id} foi borrado`);
  });

  test("o borrao cresce com a letra (8px nao esconde um titulo grande)", async () => {
    const p = await abrir(termos);
    const raio = await p.evaluate(() => {
      const h = document.getElementById("nome")!;
      h.style.fontSize = "40px";
      return parseFloat(getComputedStyle(h).filter.match(/blur\(([\d.]+)px\)/)![1]);
    });
    assert.ok(raio >= 20, `borrao de ${raio}px num titulo de 40px`);
  });

  test("o leitor continua lendo tudo: borrar e so na tela", async () => {
    const p = await abrir(termos);
    assert.match(await p.evaluate(() => document.body.innerText), /AURORA LIS EXEMPLO FICTICIO/);
  });

  test("o que chega depois (tela montada aos poucos) tambem e borrado", async () => {
    const p = await abrir(termos);
    await p.evaluate(() => {
      const el = document.createElement("div");
      el.id = "depois";
      el.textContent = "Aluna: Aurora Lis";
      document.body.appendChild(el);
    });
    assert.equal(await borrado(p, "depois"), true);
  });

  test("falha fechada: se a mascara quebrar, a pagina fica em branco", async () => {
    const p = await abrir(["(regex quebrado"]);
    assert.equal(await opacidade(p), "0", "a mascara quebrou e a pagina apareceu com os dados");
  });

  test("termos: palavras do nome sem conectivos, e o telefone com qualquer separador", () => {
    const t = termosDaMascara({ ALUNO_NOME: "Aurora da Silva", CLASSAPP_PHONE: "47900005678" });
    const re = new RegExp(t.join("|"), "i");
    assert.equal(re.test("silva"), true);
    assert.equal(re.test("rua da praia"), false, '"da" do nome borraria qualquer texto');
    assert.equal(re.test("9 0000-5678"), true);
    assert.deepEqual(termosDaMascara({}), []);
  });
});
