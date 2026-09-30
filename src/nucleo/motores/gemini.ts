import { z } from "zod";
import { montarPrompt, type Entrada } from "../prompt.ts";
import { extrairParcial, type DepsDoMotor, type Motor } from "./tipos.ts";

/** Gemini pela API, com responseSchema e a resposta chegando aos pedaços. */
export function motorGemini({ sistema, registro }: DepsDoMotor, modelo: string): Motor {
  let cli: import("@google/genai").GoogleGenAI | null = null;

  async function pedir<S extends z.ZodType>(
    schema: S,
    entrada: Entrada,
    aoEscrever?: (parcial: string) => void
  ): Promise<z.infer<S>> {
    if (!cli) {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error("Falta a chave do Gemini. Configure em Ajustes.");
      const { GoogleGenAI } = await import("@google/genai");
      cli = new GoogleGenAI({ apiKey: key });
    }
    // zod v4 converte sozinho. A biblioteca zod-to-json-schema (v3) não
    // entende zod v4 e devolvia um schema VAZIO, sem erro nenhum: o Gemini
    // recebia zero estrutura e o parse falhava depois. `responseJsonSchema`
    // (e não `responseSchema`) é o campo que aceita JSON Schema padrão.
    const pedido = {
      model: modelo,
      contents: [{ role: "user", parts: [{ text: montarPrompt(entrada) }] }],
      config: {
        systemInstruction: sistema(),
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(schema),
        abortSignal: entrada.sinal,
      },
    };
    if (!aoEscrever) {
      const r = await cli.models.generateContent(pedido);
      return schema.parse(JSON.parse(r.text ?? "{}"));
    }
    let acumulado = "";
    let mostrado = "";
    for await (const pedaco of await cli.models.generateContentStream(pedido)) {
      acumulado += pedaco.text ?? "";
      const parcial = extrairParcial(acumulado, "resposta");
      if (parcial && parcial !== mostrado) {
        mostrado = parcial;
        aoEscrever(parcial);
      }
    }
    return schema.parse(JSON.parse(acumulado || "{}"));
  }

  return {
    nome: `Gemini ${modelo}`,
    plano: (e) => pedir(registro.Plano, e),
    resposta: (e, aoEscrever) => pedir(registro.Resposta, e, aoEscrever),
  };
}
