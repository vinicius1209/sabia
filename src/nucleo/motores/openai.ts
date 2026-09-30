import type { z } from "zod";
import { montarPrompt, type Entrada } from "../prompt.ts";
import { extrairParcial, type DepsDoMotor, type Motor } from "./tipos.ts";

/** OpenAI pela API, com structured outputs e a resposta chegando aos pedaços. */
export function motorOpenAI({ sistema, registro }: DepsDoMotor, modelo: string): Motor {
  let cli: import("openai").default | null = null;

  async function cliente() {
    if (!cli) {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error("Falta a chave da OpenAI. Configure em Ajustes.");
      const { default: OpenAI } = await import("openai");
      cli = new OpenAI({ apiKey: key });
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
    const corpo = {
      model: modelo,
      messages: [
        { role: "system" as const, content: sistema() },
        { role: "user" as const, content: montarPrompt(entrada) },
      ],
      response_format: zodResponseFormat(schema as never, nomeSchema),
    };
    if (!aoEscrever) {
      const r = await c.chat.completions.create(corpo, { signal: entrada.sinal });
      return schema.parse(JSON.parse(r.choices[0].message.content ?? "{}"));
    }
    const fluxo = await c.chat.completions.create({ ...corpo, stream: true }, { signal: entrada.sinal });
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

  return {
    nome: `OpenAI ${modelo}`,
    plano: (e) => pedir(registro.Plano, "plano", e),
    resposta: (e, aoEscrever) => pedir(registro.Resposta, "resposta", e, aoEscrever),
  };
}
