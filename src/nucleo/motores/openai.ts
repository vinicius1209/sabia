import type { z } from "zod";
import { montarPrompt, type Entrada } from "../prompt.ts";
import { extrairParcial, type DepsDoMotor, type Motor } from "./tipos.ts";

/**
 * Motores que falam o protocolo da OpenAI pela API, com a resposta chegando
 * aos pedaços. Serve a própria OpenAI e os compatíveis (DeepSeek), que mudam
 * só o endereço, a variável da chave e a garantia de formato.
 */
export interface Provedor {
  /** aparece no nome do motor e na mensagem de chave faltando */
  nome: string;
  /** o endereço da API; vazio = a da OpenAI */
  baseURL?: string;
  /** o nome da variável de ambiente com a chave */
  chave: string;
  /**
   * O provedor garante o JSON Schema (`json_schema` com `strict`)? A OpenAI
   * sim. A DeepSeek só tem o `json_object` ("devolva um JSON qualquer"), então
   * o schema vai no texto do sistema e o `schema.parse` é a rede de proteção.
   */
  schemaEstrito: boolean;
}

export const OPENAI: Provedor = { nome: "OpenAI", chave: "OPENAI_API_KEY", schemaEstrito: true };

export const DEEPSEEK: Provedor = {
  nome: "DeepSeek",
  baseURL: "https://api.deepseek.com",
  chave: "DEEPSEEK_API_KEY",
  schemaEstrito: false,
};

export function motorOpenAI({ sistema, registro }: DepsDoMotor, modelo: string, prov: Provedor = OPENAI): Motor {
  let cli: import("openai").default | null = null;

  async function cliente() {
    if (!cli) {
      const key = process.env[prov.chave];
      if (!key) throw new Error(`Falta a chave da ${prov.nome}. Configure em Ajustes.`);
      const { default: OpenAI } = await import("openai");
      cli = new OpenAI({ apiKey: key, baseURL: prov.baseURL });
    }
    return cli;
  }

  async function pedir<S extends z.ZodType>(
    schema: S,
    nomeSchema: string,
    entrada: Entrada,
    aoEscrever?: (parcial: string) => void
  ): Promise<z.infer<S>> {
    const c = await cliente();
    const { zodResponseFormat } = await import("openai/helpers/zod");
    const formato = zodResponseFormat(schema as never, nomeSchema);
    // sem schema estrito, o modelo precisa ver o formato no prompt. A palavra
    // "JSON" tem que aparecer: a DeepSeek recusa o json_object sem ela.
    const instrucao = prov.schemaEstrito
      ? ""
      : `\n\nResponda SOMENTE com um JSON válido neste schema, sem texto fora do JSON:\n` +
        JSON.stringify(formato.json_schema.schema);
    const corpo = (consertar?: string) => ({
      model: modelo,
      messages: [
        { role: "system" as const, content: sistema() + instrucao },
        { role: "user" as const, content: montarPrompt(entrada) },
        ...(consertar ? [{ role: "user" as const, content: consertar }] : []),
      ],
      response_format: prov.schemaEstrito ? formato : ({ type: "json_object" } as const),
    });

    async function tentar(consertar?: string): Promise<z.infer<S>> {
      if (!aoEscrever) {
        const r = await c.chat.completions.create(corpo(consertar), { signal: entrada.sinal });
        return schema.parse(JSON.parse(r.choices[0].message.content ?? "{}"));
      }
      const fluxo = await c.chat.completions.create(
        { ...corpo(consertar), stream: true },
        { signal: entrada.sinal }
      );
      let acumulado = "";
      let mostrado = "";
      for await (const pedaco of fluxo) {
        acumulado += pedaco.choices[0]?.delta?.content ?? "";
        const parcial = extrairParcial(acumulado, "resposta");
        if (parcial && parcial !== mostrado) {
          mostrado = parcial;
          aoEscrever(parcial);
        }
      }
      return schema.parse(JSON.parse(acumulado || "{}"));
    }

    try {
      return await tentar();
    } catch (e) {
      // Sem schema estrito, o modelo erra o formato em ~2% das chamadas
      // (medido na DeepSeek: um numero cru dentro de "itens", que pede string).
      // Uma segunda tentativa com o erro na mao derruba isso para ~0%. Com
      // schema estrito nao ha o que consertar: o erro e real, sobe.
      if (prov.schemaEstrito || entrada.sinal?.aborted) throw e;
      const motivo = e instanceof Error ? e.message : String(e);
      return await tentar(
        "O JSON anterior foi recusado pela validação:\n" +
          motivo.slice(0, 600) +
          "\nResponda de novo, só o JSON, respeitando o schema. Todo valor de texto vai entre aspas."
      );
    }
  }

  return {
    nome: `${prov.nome} ${modelo}`,
    plano: (e) => pedir(registro.Plano, "plano", e),
    resposta: (e, aoEscrever) => pedir(registro.Resposta, "resposta", e, aoEscrever),
  };
}
