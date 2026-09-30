import { z } from "zod";
import { defineCapacidade } from "../../../nucleo/capacidade.ts";
import { getBrowser, getEntityId, navegarAutenticado } from "../browser.mjs";

const CLASSAPP = "https://classapp.com.br";

export const Saida = z.object({
  total: z.number(),
  comunicados: z.array(
    z.object({ titulo: z.string(), detalhe: z.string(), href: z.string().nullable() })
  ),
  conteudoDoMaisRecente: z.string().nullable(),
});

export default defineCapacidade({
  nome: "ler_comunicados",
  rotulo: "Comunicados da escola",
  fonte: "ClassApp",
  icone: "📣",
  intencao: "avisos",
  descricao:
    "os avisos e comunicados que a escola mandou no ClassApp. A data que aparece " +
    "é quando a escola ENVIOU a mensagem, nunca um prazo: não invente prazos.",
  entrada: z.object({
    limite: z
      .number().int().min(1).max(30).nullable()
      .describe("quantos comunicados listar; null para o padrao (12)"),
  }),
  saida: Saida,

  async ler({ limite: pedido }, passo) {
    const limite = pedido ?? 12;
    const { page } = await getBrowser();
    const id = getEntityId();
    passo("Lendo os comunicados");

    // A lista é renderizada por JS: esperar tempo fixo às vezes pegava a
    // página ainda vazia. Esperamos os itens e, se vier vazio, recarregamos.
    const carregar = async () => {
      await navegarAutenticado(`${CLASSAPP}/entities/${id}/messages`, passo);
      await page.locator('a[href*="/messages/"]').first()
        .waitFor({ state: "attached", timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(1500);
    };

    let itens: { titulo: string; detalhe: string; href: string | null }[] = [];
    for (let i = 0; i < 3 && !itens.length; i++) {
      if (i > 0) passo(`A lista veio vazia, tentando de novo (${i + 1}ª vez)`);
      await carregar();
      itens = await page.evaluate((max: number) => {
        const out: { titulo: string; detalhe: string; href: string | null }[] = [];
        const vistos = new Set<string>();
        for (const a of Array.from(document.querySelectorAll('a[href*="/messages/"]'))) {
          const row = a.closest("li, tr, div");
          if (!row) continue;
          const txt = (row as HTMLElement).innerText.trim();
          if (!txt || vistos.has(txt)) continue;
          vistos.add(txt);
          const linhas = txt.split("\n").map((s) => s.trim()).filter(Boolean);
          out.push({
            titulo: linhas[0] || "",
            detalhe: linhas.slice(1, 4).join(" · "),
            href: a.getAttribute("href"),
          });
          if (out.length >= max) break;
        }
        return out;
      }, limite);
    }

    let destaque: string | null = null;
    if (itens[0]?.href) {
      passo(`Abrindo "${itens[0].titulo}"`);
      await page.goto(new URL(itens[0].href, CLASSAPP).toString(), { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2200);
      destaque = await page.evaluate(() => {
        const t = document.body.innerText;
        const i = t.indexOf("from");
        return (i >= 0 ? t.slice(i) : t).slice(0, 3000);
      });
    }
    return { total: itens.length, comunicados: itens, conteudoDoMaisRecente: destaque };
  },

  resumir: (d) => `${d.total} comunicados lidos`,

  local: {
    sinais: { forte: /aviso|comunicado|recado|novidade/, fraco: /importante|semana|aconteceu|escola/ },
    raciocinio: "Vou ler os comunicados que a escola enviou no ClassApp.",
    responder(_pergunta, d) {
      return {
        resposta: d.comunicados.length
          ? `A escola enviou ${d.total} comunicados. Os mais recentes são estes.`
          : "Não consegui ler os comunicados agora.",
        itens: d.comunicados.slice(0, 6).map((m) => ({
          rotulo: m.detalhe || "Comunicado",
          valor: m.titulo,
        })),
      };
    },
  },
});
