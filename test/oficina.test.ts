/**
 * A oficina (`oficina/index.html`): o código que o aluno recebe, e os quatro
 * passos que a página manda ele fazer nesse código.
 *
 * Por que isto existe: os passos são texto numa página e o código é texto na
 * mesma página. Nada liga um ao outro. Se alguém reescrever o código inicial,
 * o Passo 3 pode continuar mandando procurar uma linha que não existe mais, e
 * trinta alunos descobrem isso ao mesmo tempo, no meio da oficina.
 *
 * Então cada teste aqui aplica um passo de verdade no código de verdade.
 * Sem navegador: o código do aluno é JavaScript puro.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/*
 * CRLF vira LF na leitura: no Windows o git entrega o arquivo com \r\n, e os
 * testes daqui casam o código linha a linha (split("\n"), regex com \n no
 * meio). Sem isto a suíte passa no Mac e no Linux e quebra só no runner
 * Windows do CI -- que é justo a máquina da oficina.
 */
const PAGINA = readFileSync(new URL("../oficina/index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");

/* ------------------------------------------------------------------
   Os quatro ajudantes que a página entrega ao código do aluno.
   O teste traz a própria cópia, e confere que a lista não mudou.
   ------------------------------------------------------------------ */
const HOJE = "2026-10-29";
const VENCIDO_ANTIGO = "2026-09-30";
const VENCIDO_RECENTE = "2026-10-25";
const FUTURO = "2026-11-09";

const hoje = () => HOJE;
const dataBr = (iso: string) => {
  const p = String(iso).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}` : String(iso);
};
const semAcento = (s: string) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const tabela = (titulo: string, linhas: [string, string][]) =>
  `<div class="k">${titulo}</div>` +
  linhas.map(([a, b]) => `<div class="l"><span>${a}</span><span class="v">${b}</span></div>`).join("");

/* ------------------------------------------------------------------
   Pegar o código inicial e compilar, como a página faz
   ------------------------------------------------------------------ */
function codigoInicial(): string {
  const m = PAGINA.match(
    /<script type="text\/plain" id="codigo-inicial">([\s\S]*?)<\/script>/,
  );
  assert.ok(m, "a página perdeu o bloco #codigo-inicial");
  return m[1]
    .replace("__PRAZO_1__", VENCIDO_ANTIGO)
    .replace("__PRAZO_2__", VENCIDO_RECENTE)
    .replace("__PRAZO_3__", FUTURO)
    .replace("__AVISO_1__", "2026-10-27")
    .replace("__AVISO_2__", "2026-10-28")
    .trim();
}

type Resposta = { texto?: string; tabela?: string };
type Agente = {
  ESCOLA: {
    aluno: string;
    notas: Record<string, { b1: number; b2: number; b3: number }>;
    trabalhos: { materia: string; titulo: string; prazo: string }[];
  };
  responder: (pergunta: string) => Resposta;
};

function compilar(fonte: string): Agente {
  const corpo = `"use strict";\n${fonte}\n;return { ESCOLA: ESCOLA, responder: responder };`;
  const f = new Function("hoje", "dataBr", "semAcento", "tabela", corpo);
  return f(hoje, dataBr, semAcento, tabela) as Agente;
}

/** Tudo que o aluno vê de uma resposta: o texto e a tabela, juntos. */
function perguntar(agente: Agente, pergunta: string) {
  const r = agente.responder(pergunta) ?? {};
  return { ...r, tudo: String(r.texto ?? "") + String(r.tabela ?? "") };
}

/** O trecho que a página manda copiar, no passo n (1 a 4), bloco i. */
function trechoDoPasso(n: number, i = 0): string {
  const passos = PAGINA.split(/aba: "/).slice(1);
  assert.equal(passos.length, 4, "a página não tem mais quatro passos");
  const trechos = [...passos[n - 1].matchAll(/<div class="trecho">([\s\S]*?)<\/div>/g)].map((m) =>
    m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\\`/g, "`"),
  );
  assert.ok(trechos[i], `o Passo ${n} perdeu o trecho ${i + 1}`);
  return trechos[i];
}

/* ==================================================================
   O contrato entre a página e o código do aluno
   ================================================================== */
describe("a página e o código do aluno", () => {
  test("os ajudantes entregues ao código são os quatro que este teste imita", () => {
    assert.match(
      PAGINA,
      /new Function\("hoje", "dataBr", "semAcento", "tabela", corpo\)/,
      "a lista de ajudantes mudou na página; atualize este teste junto",
    );
  });

  test("o código inicial compila e responde", () => {
    const a = compilar(codigoInicial());
    assert.equal(typeof a.responder, "function");
    assert.ok(perguntar(a, "oi").tudo.includes("Ana"));
  });

  test("os prazos de exemplo deixam dois vencidos e um no futuro", () => {
    // o Passo 3 só funciona se houver prazo vencido para achar, e prazo
    // futuro para sobrar depois do conserto
    const dias = [...PAGINA.matchAll(/__PRAZO_\d__", maisDias\((-?\d+)\)/g)].map((m) => Number(m[1]));
    assert.equal(dias.length, 3, "a página não tem mais três prazos");
    assert.equal(dias.filter((d) => d < 0).length, 2, "era para ter dois prazos vencidos");
    assert.equal(dias.filter((d) => d > 0).length, 1, "era para ter um prazo no futuro");
  });
});

/* ==================================================================
   Passo 1 · o aluno no código (dado)
   ================================================================== */
describe("Passo 1, a matéria nova", () => {
  test("a linha que a instrução cita é mesmo a do nome do aluno", () => {
    const passo = PAGINA.split(/aba: "/)[1];
    const n = Number(passo.match(/linha (\d+)<\/b>/)?.[1]);
    assert.ok(n, "o Passo 1 não cita mais uma linha");
    const linha = codigoInicial().split("\n")[n - 1] ?? "";
    assert.match(linha, /aluno:/, `a instrução manda na linha ${n}, mas lá está: ${linha.trim()}`);
  });

  test("o trecho entra na lista de notas e a média é respondida", () => {
    const fonte = codigoInicial().replace("notas: {", "notas: {\n    " + trechoDoPasso(1));
    const a = compilar(fonte);
    assert.ok(a.ESCOLA.notas["astronomia"], "a matéria nova não entrou em ESCOLA.notas");
    // (9.0 + 8.5 + 10.0) / 3 = 9.1666... -> 9.2
    assert.ok(
      perguntar(a, "minha nota de astronomia").tudo.includes("9.2"),
      "ele não respondeu a média da matéria que o aluno acabou de escrever",
    );
  });

  test("matéria que o aluno não escreveu não é inventada", () => {
    const a = compilar(codigoInicial());
    const r = perguntar(a, "minha nota de geografia");
    assert.ok(!r.tudo.includes("geografia"), "ele inventou uma nota de geografia");
  });
});

/* ==================================================================
   Passo 2 · uma capacidade nova (condição)
   ================================================================== */
describe("Passo 2, a regra nova", () => {
  test("o marcador que a instrução manda procurar existe no código", () => {
    assert.ok(
      codigoInicial().includes("// --- NÃO SEI ---"),
      "o Passo 2 manda colar antes do // --- NÃO SEI ---, e ele não está mais lá",
    );
  });

  test("a regra da piscina entra e passa a ser respondida", () => {
    const antes = compilar(codigoInicial());
    assert.ok(
      !perguntar(antes, "a piscina abre quando?").tudo.includes("terça"),
      "ele já sabia da piscina antes do passo; o passo perdeu a graça",
    );

    const fonte = codigoInicial().replace(
      "  // --- NÃO SEI ---",
      trechoDoPasso(2) + "\n  // --- NÃO SEI ---",
    );
    const depois = compilar(fonte);
    assert.ok(
      perguntar(depois, "a piscina abre quando?").tudo.includes("terça"),
      "a regra nova não respondeu",
    );
    // e o que já funcionava continua funcionando
    assert.ok(perguntar(depois, "minha nota de física").tudo.includes("5.8"));
  });
});

/* ==================================================================
   Passo 3 · o erro que já estava lá (a data)
   ================================================================== */
describe("Passo 3, o prazo vencido", () => {
  const LINHA_ERRADA = "    const pendentes = ESCOLA.trabalhos;";

  test("a linha que a instrução manda trocar existe, exatamente assim", () => {
    assert.ok(
      codigoInicial().includes(LINHA_ERRADA.trim()),
      "o Passo 3 manda trocar `const pendentes = ESCOLA.trabalhos;`, que não está mais no código",
    );
  });

  test("antes do conserto, ele manda entregar trabalho com prazo vencido", () => {
    const a = compilar(codigoInicial());
    const r = perguntar(a, "quais trabalhos estão pendentes?");
    const vencidos = a.ESCOLA.trabalhos.filter((x) => x.prazo < hoje());
    assert.ok(vencidos.length > 0, "não sobrou prazo vencido para o aluno achar");
    for (const v of vencidos) {
      assert.ok(r.tudo.includes(v.titulo), `o erro do Passo 3 sumiu: ${v.titulo} não foi listado`);
    }
  });

  test("depois do conserto, só sobra o prazo que ainda não venceu", () => {
    const fonte = codigoInicial().replace(LINHA_ERRADA.trim(), trechoDoPasso(3).trim());
    const a = compilar(fonte);
    const r = perguntar(a, "quais trabalhos estão pendentes?");
    for (const t of a.ESCOLA.trabalhos) {
      const deviaAparecer = t.prazo >= hoje();
      assert.equal(
        r.tudo.includes(t.titulo),
        deviaAparecer,
        deviaAparecer
          ? `${t.titulo} vence em ${t.prazo} e devia aparecer`
          : `${t.titulo} venceu em ${t.prazo} e não devia aparecer`,
      );
    }
  });

  test("o conserto usa o hoje() que a página entrega, e não uma data escrita na mão", () => {
    assert.match(trechoDoPasso(3), /hoje\(\)/);
  });
});

/* ==================================================================
   Passo 4 · quebrar de propósito, e o filtro de palavras
   ================================================================== */
describe("Passo 4, a sabotagem", () => {
  /** A regra das notas, como está escrita no código inicial. */
  function regraDasNotas() {
    const m = codigoInicial().match(/if \(\/([^/]+)\/\.test\(t\)\) \{\n\s*const materia/);
    assert.ok(m, "não achei mais a regra das notas no código inicial");
    return m[1];
  }

  /** Separa as alternativas do `|`, sem quebrar as que estão dentro de (). */
  function alternativas(fonte: string) {
    const out: string[] = [];
    let nivel = 0;
    let atual = "";
    for (const c of fonte) {
      if (c === "(") nivel++;
      if (c === ")") nivel--;
      if (c === "|" && nivel === 0) {
        out.push(atual);
        atual = "";
      } else atual += c;
    }
    out.push(atual);
    return out;
  }

  test("a linha que o Passo 4 manda estragar é a que está no código", () => {
    assert.ok(
      trechoDoPasso(4).includes(regraDasNotas().replace("boletim|", "")),
      "o trecho do Passo 4 não é mais a regra das notas sem o |boletim",
    );
  });

  test("tirar |boletim faz a pergunta do boletim cair no não sei", () => {
    const regra = regraDasNotas();
    assert.ok(regra.includes("boletim|") || regra.includes("|boletim"), "a palavra boletim saiu da regra");

    const antes = compilar(codigoInicial());
    assert.ok(perguntar(antes, "como está meu boletim?").tabela, "o boletim já não era entendido");

    const fonte = codigoInicial().replace(regra, regra.replace("boletim|", "").replace("|boletim", ""));
    const depois = compilar(fonte);
    assert.ok(
      !perguntar(depois, "como está meu boletim?").tabela,
      "tirar a palavra do filtro não mudou nada; o teste da página não acusaria",
    );
  });

  /**
   * A lição do slide 11: um caso curto para CADA palavra do filtro. Palavra
   * nova no filtro sem exemplo aqui faz este teste falhar de propósito.
   */
  test("cada palavra do filtro de notas é entendida", () => {
    const exemplos: Record<string, string> = {
      nota: "qual minha nota",
      boletim: "como está meu boletim?",
      media: "qual minha média",
      desempenho: "como está meu desempenho",
      "como.*(vou|estou)": "como eu estou na escola?",
    };
    const a = compilar(codigoInicial());
    for (const alt of alternativas(regraDasNotas())) {
      const pergunta = exemplos[alt];
      assert.ok(pergunta, `a regra das notas ganhou "${alt}" e nenhum teste cobre essa palavra`);
      assert.ok(
        perguntar(a, pergunta).tabela,
        `"${pergunta}" devia chegar na regra das notas por causa de "${alt}"`,
      );
    }
  });
});
