/* ==================================================================
 * A máscara do telão.
 *
 * Na feira, a janela do navegador fica no projetor ao lado do chat. O
 * ClassApp e o Portal mostram o nome completo, a matrícula, a data de
 * nascimento, a filiação e o telefone da dona da conta. Isto borra esses
 * pedaços NA TELA, sem mudar o que o Sabiá lê: filtro de CSS não muda o
 * innerText, então os leitores continuam vendo tudo.
 *
 * Falha fechada: a página nasce invisível (opacity 0) e só aparece depois
 * que a máscara passou por ela. Se a máscara quebrar, o telão mostra uma
 * página em branco, nunca os dados. (Opacidade não atrapalha o Playwright:
 * para ele, elemento com opacity 0 continua visível e clicável.)
 *
 * MASCARA=0 desliga, para depurar em casa.
 * ================================================================== */

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** palavras curtas do nome que apareceriam em qualquer texto ("de", "da") */
const CONECTIVOS = new Set(["de", "da", "do", "das", "dos", "e"]);

/**
 * O que a máscara procura, já sem acento e em minúsculas:
 *  - cada palavra do nome configurado (o Portal mostra o nome completo, e
 *    o nome configurado costuma ser só o primeiro: a linha inteira borra);
 *  - o telefone da conta, com ou sem separadores;
 *  - qualquer e-mail ou telefone, e o texto logo depois de rótulos como
 *    "Matrícula" e "Nascimento" (isso vem pronto no script).
 */
export function termosDaMascara(env: Record<string, string | undefined>): string[] {
  const nome = semAcento(env.ALUNO_NOME ?? "")
    .split(/[^a-z]+/)
    .filter((p) => p.length >= 3 && !CONECTIVOS.has(p))
    .map((p) => `\\b${escapar(p)}\\b`);
  const digitos = (env.CLASSAPP_PHONE ?? "").replace(/\D/g, "");
  // os 8 últimos dígitos bastam, e aceitam "0000-1234", "00001234", "(11) 9 0000-1234"
  const fone = digitos.length >= 8 ? [digitos.slice(-8).split("").join("[\\s.()-]*")] : [];
  return [...nome, ...fone];
}

/** A máscara está ligada? (é o padrão: só desliga com MASCARA=0) */
export const mascaraLigada = (env: Record<string, string | undefined>) => env.MASCARA !== "0";

/**
 * O script que roda em TODA página e em todo frame, antes do site.
 * Precisa ser autossuficiente: o Playwright manda o texto da função para o
 * navegador, então nada de fora dela existe lá dentro.
 */
export function scriptDaMascara({ termos }: { termos: string[] }) {
  const CLASSE = "sabia-mascara";
  // PRIMEIRO esconde; qualquer erro daqui para baixo deixa a página em branco
  const estilo = document.createElement("style");
  const OCULTO = "html{opacity:0!important}";
  // o borrão cresce com a letra: 8px não esconde um título de 24px
  const BORRADO =
    `.${CLASSE}{filter:blur(max(8px,.5em))!important}` +
    // campos de formulário (o telefone e a senha do login) sempre borrados
    "input:not([type=hidden]),textarea{filter:blur(6px)!important}" +
    // rosto: foto de perfil em qualquer lugar, e TODA imagem do Portal (a foto
    // da aluna fica no cabeçalho e no boletim; logo borrado não faz falta)
    "img[class*=avatar i],[class*=avatar i] img,[class*=foto i] img,img[src*=foto i]{filter:blur(12px)!important}" +
    (/activesoft/i.test(location.hostname) ? "img,[style*=background-image]:empty{filter:blur(12px)!important}" : "");
  estilo.textContent = OCULTO + BORRADO;
  // O script roda antes de existir o <html>. Este vigia põe o estilo assim que
  // ele nasce (antes da primeira pintura), e de volta se a página trocar o
  // <head> inteiro. Vem antes de tudo que pode falhar.
  const colocar = () => {
    const raiz = document.head || document.documentElement;
    if (raiz && !estilo.isConnected) raiz.appendChild(estilo);
  };
  colocar();
  new MutationObserver(colocar).observe(document, { childList: true, subtree: true });

  const tirarAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  // os dados em si: o nome, o telefone da conta, e qualquer e-mail/telefone
  const dado = new RegExp(
    [...termos, "[\\w.+-]+@[\\w-]+\\.[\\w.]+", "\\(?\\d{2}\\)?\\s?9?\\s?\\d{4}[\\s.-]?\\d{4}\\b"].join("|"),
    "i"
  );
  // rótulos cujo VALOR vem ao lado ("Matrícula: 12345", ou o rótulo numa célula e o valor na outra)
  const rotulo =
    /^(n[o°º.]*\s*)?(matricula|data de nascimento|nascimento|nascido|filiacao|mae|pai|responsave(l|is)|cpf|rg|ra|telefone|celular|e-?mail|nome( do aluno| da aluna| completo)?|alun[oa](\(a\))?|estudante)(?![a-z])\s*:?/;

  const borrar = (el: Element | null) => {
    if (el && el !== document.body && el !== document.documentElement) el.classList.add(CLASSE);
  };

  const conferirTexto = (no: Text) => {
    const pai = no.parentElement;
    if (!pai || pai.closest(`.${CLASSE}`) || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(pai.tagName)) return;
    const texto = tirarAcento((no.textContent || "").trim());
    if (!texto) return;
    if (dado.test(texto)) {
      borrar(pai);
      // a foto costuma estar no mesmo cartão do nome
      for (let c: Element | null = pai.parentElement, n = 0; c && n < 4; c = c.parentElement, n++) {
        if ((c as HTMLElement).innerText.length > 300) break;
        c.querySelectorAll("img").forEach(borrar);
      }
      return;
    }
    if (!rotulo.test(texto)) return;
    // "Matrícula: 12345" no mesmo texto: borra ele
    if (texto.replace(rotulo, "").trim()) return borrar(pai);
    // só o rótulo: o valor está ao lado. Borra a linha se ela for curta,
    // senão o elemento seguinte (nunca a página inteira)
    const linha = pai.closest("tr, li, dl, p") || pai.parentElement;
    if (linha && (linha as HTMLElement).innerText.length < 160) borrar(linha);
    else borrar(pai.nextElementSibling);
  };

  const varrer = (raiz: Node) => {
    if (raiz.nodeType === Node.TEXT_NODE) return conferirTexto(raiz as Text);
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) conferirTexto(n as Text);
  };

  // o que chega depois (telas de React e Angular montam tudo aos poucos).
  // O observador roda antes da próxima pintura: o dado novo não pisca.
  new MutationObserver((mudancas) => {
    try {
      for (const m of mudancas) {
        if (m.type === "characterData") conferirTexto(m.target as Text);
        m.addedNodes.forEach(varrer);
      }
    } catch {
      estilo.textContent = OCULTO + BORRADO; // na dúvida, some
    }
  }).observe(document, { childList: true, subtree: true, characterData: true });

  const revelar = () => {
    try {
      varrer(document.documentElement);
      estilo.textContent = BORRADO; // só agora a página aparece
    } catch {
      /* fica invisível: melhor em branco do que com os dados */
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", revelar, { once: true });
  else revelar();
}
