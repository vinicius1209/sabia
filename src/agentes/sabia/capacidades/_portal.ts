import { getBrowser, getEntityId, navegarAutenticado } from "../browser.mjs";
import type { Page } from "playwright";
import type { Passo } from "../../../nucleo/texto.ts";
import type { Linha } from "../util.ts";

const CLASSAPP = "https://classapp.com.br";

/**
 * Abre o Portal Activesoft pelo acesso integrado do ClassApp.
 * Toda capacidade que mora no Activesoft começa por aqui.
 */
export async function abrirPortal(passo: Passo = () => {}) {
  const { ctx, page } = await getBrowser();
  const id = getEntityId();

  // Cada acesso gera aba nova com token curto. Abas de execuções anteriores
  // ficam com token expirado e davam leitura de lixo, então limpamos antes.
  for (const pg of ctx.pages()) {
    if (/activesoft/i.test(pg.url())) await pg.close().catch(() => {});
  }

  passo("Procurando o Portal do Aluno");
  await navegarAutenticado(`${CLASSAPP}/entities/${id}/accesses`, passo);
  await page.waitForTimeout(2200);

  passo("Abrindo o Portal do Aluno");
  await page.locator('button:has-text("Access"), button:has-text("Acessar")').first().click();
  await page.waitForTimeout(2500);

  const [portal] = await Promise.all([
    ctx.waitForEvent("page", { timeout: 25000 }).catch(() => null),
    page
      .locator('text=/Click here to access|Clique aqui para acessar/i')
      .first()
      .click()
      .catch(() => {}),
  ]);

  let alvo = portal;
  for (const pg of ctx.pages()) if (/activesoft.*Mobile/i.test(pg.url())) alvo = pg;
  if (!alvo) throw new Error("Nao consegui abrir o Portal Activesoft");

  await alvo.bringToFront();
  await alvo.waitForLoadState("domcontentloaded");
  await alvo.waitForTimeout(2500);
  return alvo;
}

/**
 * Navega para um item do menu do portal LENDO O HREF, em vez de adivinhar
 * o nome do arquivo. Chutar "horarios.asp" dava 404; o link certo era
 * "quadroHorarios_selecionarTurma.asp?IdAluno=N" e estava no menu.
 */
export async function irParaItemDoMenu(alvo: Page, padrao: RegExp, passo: Passo = () => {}) {
  const href = await alvo.evaluate(
    (origem: string) =>
      Array.from(document.querySelectorAll("a"))
        .map((a) => a.getAttribute("href") || "")
        .find((h) => new RegExp(origem, "i").test(h)) || null,
    padrao.source
  );
  if (!href) throw new Error(`Nao achei no menu do portal um link casando com ${padrao}`);
  await alvo.goto(new URL(href, alvo.url()).toString(), { waitUntil: "domcontentloaded" });
  await alvo.waitForTimeout(2000);
  passo("Carregando a página");
}

/**
 * Lê todas as tabelas de todas as frames.
 * O Activesoft renderiza dentro de iframe e cada tela tem mais de uma tabela,
 * então quem chama decide qual usar.
 */
export async function lerTabelas(alvo: Page, tentativas = 6): Promise<Linha[][]> {
  for (let i = 0; i < tentativas; i++) {
    const achadas: Linha[][] = [];
    for (const f of alvo.frames()) {
      try {
        const tabs = await f.evaluate(() =>
          Array.from(document.querySelectorAll("table")).map((t) =>
            Array.from(t.querySelectorAll("tr"))
              .map((tr) =>
                Array.from(tr.querySelectorAll("th,td")).map((c) => (c as HTMLElement).innerText.trim())
              )
              .filter((l) => l.some(Boolean))
          )
        );
        for (const t of tabs) if (t.length >= 2) achadas.push(t);
      } catch { /* frame sem acesso, segue */ }
    }
    if (achadas.length) return achadas;
    await alvo.waitForTimeout(1500);
  }
  return [];
}

/** clica o botão "Buscar" que quase toda tela do portal tem */
export async function clicarBuscar(alvo: Page) {
  await alvo
    .locator('button:has-text("Buscar"), input[value*="Buscar" i]')
    .first()
    .click({ timeout: 10000 })
    .catch(() => {});
  await alvo.waitForTimeout(4000);
}
