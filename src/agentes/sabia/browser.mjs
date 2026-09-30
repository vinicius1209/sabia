import { chromium } from "playwright";
import { caminhos } from "../../nucleo/config.ts";
import { mascaraLigada, scriptDaMascara, termosDaMascara } from "./mascara.ts";

const CLASSAPP = "https://classapp.com.br";

let ctx = null;
let page = null;
let entityId = null;
/** como pedir o codigo 2FA, guardado para conseguir religar a sessao sozinho */
let pedirCodigo2fa = null;

/** Sobe (ou reaproveita) o navegador com perfil persistente.
 *  O perfil guarda os cookies, inclusive o "trust device" de 30 dias,
 *  entao normalmente nao precisa repetir o 2FA. */
export async function getBrowser() {
  // se o navegador foi fechado na mao, descarta e sobe outro
  if (ctx && (!page || page.isClosed())) {
    try { await ctx.close(); } catch { /* ja estava morto */ }
    ctx = null; page = null; entityId = null;
  }
  if (ctx) return { ctx, page };
  // o perfil mora no home do agente (~/.sabia/navegador), fora do projeto
  ctx = await chromium.launchPersistentContext(caminhos.navegador(), {
    headless: process.env.SHOW_BROWSER === "0",
    viewport: { width: 1280, height: 860 },
    args: ["--window-size=1300,900"],
    // Fixos de propósito: o ClassApp escreve o nome do mês no idioma do
    // navegador, e o calendário é lido por esse nome. Sem isto, a mesma
    // página muda de cara conforme o computador da feira.
    locale: "en-US",
    timezoneId: "America/Sao_Paulo",
  });
  // No telão, nome, matrícula, nascimento, filiação e telefone aparecem
  // borrados (ver mascara.ts). A primeira aba já existia antes do script:
  // recarrega para ela também nascer mascarada.
  if (mascaraLigada(process.env)) {
    await ctx.addInitScript(scriptDaMascara, { termos: termosDaMascara(process.env) });
  }
  page = ctx.pages()[0] || (await ctx.newPage());
  if (mascaraLigada(process.env) && page.url() !== "about:blank") await page.reload().catch(() => {});
  return { ctx, page };
}

export async function closeBrowser() {
  if (ctx) await ctx.close();
  ctx = null; page = null; entityId = null;
}

const clickIfVisible = async (p, selector, timeout = 2500) => {
  try {
    const el = p.locator(selector).first();
    await el.waitFor({ state: "visible", timeout });
    await el.click();
    return true;
  } catch { return false; }
};

/**
 * Garante sessao logada no ClassApp.
 * @param {object} o
 * @param {(msg:string)=>void} o.onStep        callback de progresso (vai pra UI)
 * @param {()=>Promise<string>} o.request2faCode  pede o codigo pra pessoa e espera
 */
export async function ensureLoggedIn({ onStep = () => {}, request2faCode }) {
  if (request2faCode) pedirCodigo2fa = request2faCode;
  const { page: p } = await getBrowser();

  // Nada de cache por tempo aqui. Se ja sabemos o perfil, seguimos direto e
  // deixamos a propria navegacao descobrir se a sessao caiu (ver
  // navegarAutenticado). Assim nao gastamos 8s por pergunta E nao corremos o
  // risco de confiar numa sessao que expirou no meio.
  if (entityId) return entityId;

  onStep("Abrindo o ClassApp");
  await p.goto(CLASSAPP, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);

  // Sem sessao, o ClassApp joga para o site de marketing (www.classapp.com.br),
  // entao nao da para decidir so por "/auth" na URL.
  if (await pareceLogado(p)) {
    onStep("Já estava conectado");
    return await selectEntity(p, onStep);
  }

  onStep("Fazendo login no ClassApp");
  await p.goto(`${CLASSAPP}/auth`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);

  const phone = process.env.CLASSAPP_PHONE;
  const password = process.env.CLASSAPP_PASSWORD;
  if (!phone || !password) {
    throw new Error("Faltam CLASSAPP_PHONE / CLASSAPP_PASSWORD no .env");
  }

  // 1) trocar para a entrada por celular
  await clickIfVisible(p, 'text=/entre usando o celular/i', 5000);
  await p.waitForTimeout(800);

  // 2) telefone
  onStep("Digitando o celular");
  const phoneInput = p
    .locator('input[placeholder*="Celular" i], input[type="tel"]')
    .first();
  await phoneInput.waitFor({ state: "visible", timeout: 10000 });
  await phoneInput.fill(phone);
  await clickIfVisible(p, 'button:has-text("Continuar")', 5000);
  await p.waitForTimeout(2000);

  // 3) senha
  onStep("Digitando a senha");
  const pwInput = p.locator('input[type="password"]').first();
  await pwInput.waitFor({ state: "visible", timeout: 10000 });
  await pwInput.fill(password);
  await clickIfVisible(p, 'button:has-text("Continuar")', 5000);
  await p.waitForTimeout(3500);

  // 4) 2FA — aqui o agente PARA e pede o codigo pra pessoa dona da conta
  if (p.url().includes("/auth/code")) {
    onStep("Esperando o código que chegou no celular");
    if (typeof request2faCode !== "function") {
      throw new Error("Preciso do codigo 2FA mas nao ha como pedir (request2faCode ausente)");
    }
    const code = (await request2faCode()).trim();
    onStep("Confirmando o código");

    const codeInput = p
      .locator('input:not([type="hidden"]):visible')
      .first();
    await codeInput.fill(code);
    await p.waitForTimeout(400);
    await clickIfVisible(p, 'button:has-text("Continuar")', 5000);
    await p.waitForTimeout(3500);
  }

  // 5) confiar no dispositivo por 30 dias (mecanismo oficial do ClassApp)
  if (p.url().includes("trust-device")) {
    onStep("Salvando o login por 30 dias");
    await clickIfVisible(
      p,
      'button:has-text("Trust this device"), button:has-text("Confiar neste dispositivo")',
      5000
    );
    await p.waitForTimeout(3000);
  }

  return await selectEntity(p, onStep);
}

/** Ha sessao ativa? O site de marketing (www) significa deslogado. */
async function pareceLogado(p) {
  const url = p.url();
  if (url.includes("/auth")) return false;
  if (/\/\/www\.classapp\.com\.br/.test(url)) return false;
  if (/\/entities\/\d+/.test(url)) return true;
  // a home logada lista os perfis como links para /entities/<id>
  return (await p.locator('a[href*="/entities/"]').count()) > 0;
}

/** Entra no perfil do aluno e memoriza o entityId da URL. */
async function selectEntity(p, onStep) {
  if (!/\/entities\/\d+/.test(p.url())) {
    onStep("Entrando no perfil da aluna");
    // le o href direto do DOM: o cartao do perfil as vezes fica em menu oculto,
    // e clicar num elemento invisivel trava o Playwright por 30s.
    const href = await p.evaluate(() => {
      const achado = Array.from(document.querySelectorAll('a[href*="/entities/"]'))
        .map((a) => a.getAttribute("href"))
        .find((h) => h && /\/entities\/\d+/.test(h));
      return achado || null;
    });
    if (href) {
      await p.goto(new URL(href, CLASSAPP).toString(), { waitUntil: "domcontentloaded" });
    } else {
      await clickIfVisible(p, 'text=/Student|Aluno/i', 8000);
    }
    await p.waitForTimeout(3000);
  }
  const m = p.url().match(/\/entities\/(\d+)/);
  if (m) entityId = m[1];
  if (!entityId) {
    throw new Error(
      `Nao consegui identificar o perfil do aluno. URL atual: ${p.url()}`
    );
  }
  onStep("Conectado ao ClassApp");
  return entityId;
}

export function getEntityId() {
  return entityId;
}

export function getPage() {
  return page;
}


/**
 * Navega para uma pagina do ClassApp garantindo sessao valida.
 *
 * Em vez de conferir o login antes de toda pergunta (lento) ou confiar num
 * cache com prazo (arriscado, pode servir pagina deslogada), a gente tenta
 * direto. Se a pagina que voltou for de login/marketing, refaz o login e
 * tenta de novo. Rapido no caso normal, correto quando a sessao cai.
 */
export async function navegarAutenticado(url, onStep = () => {}) {
  const { page: p } = await getBrowser();

  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);

  if (await pareceLogado(p)) return;

  onStep("A sessão caiu, entrando de novo");
  entityId = null;
  await ensureLoggedIn({ onStep, request2faCode: pedirCodigo2fa });

  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
  if (!(await pareceLogado(p))) {
    throw new Error("Nao consegui manter a sessao do ClassApp aberta.");
  }
}
