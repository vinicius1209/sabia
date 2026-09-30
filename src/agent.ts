import { z } from "zod";
import { Plano, Resposta, limparResposta } from "./contracts.ts";
import { executar, metadados, descricaoDasFontes, capacidade, resumir } from "./capacidades/index.ts";
import { ensureLoggedIn } from "./browser.mjs";
import { motorLocal } from "./local.ts";
import { cabecalhoTemporal } from "./contexto.ts";
import { quemAtende } from "./perfil.ts";

/* ==================================================================
 * Arquitetura em 3 fases, deterministica:
 *
 *   1. PLANEJAR  o modelo devolve um Plano validado (intencao +
 *                raciocinio + ferramentas NA ORDEM)
 *   2. EXECUTAR  nos executamos as ferramentas nessa ordem. O modelo
 *                nao toca no navegador, so escolhe o que consultar.
 *   3. RESPONDER o modelo recebe os dados e devolve uma Resposta
 *                validada (texto + itens para a tela + fonte)
 *
 * Toda fronteira com o modelo passa por Zod. Se vier algo fora do
 * contrato, quebra aqui e nao vira acao.
 * ================================================================== */

function papel(): string {
  return `${quemAtende()}
Responde em portugues do Brasil, curto, direto e simpatico.

Fontes disponiveis (somente leitura):
${descricaoDasFontes()}

Nunca invente nota, data ou comunicado. Se a pergunta nao precisa de dado da escola
(um "oi", um agradecimento), use intencao "conversa" e nenhuma ferramenta.
Voce so sabe o que esta nas fontes acima. Se perguntarem algo que nao e da escola
(futebol, noticia, conta de matematica, curiosidade), diga com simpatia que so
consulta os sistemas da escola, e NAO responda de memoria.
Se pedirem uma disciplina que nao aparece nos dados, diga que ela nao esta no
boletim ou no horario. Nunca complete com um valor parecido.
Voce e somente leitura: nao envia mensagem para professor nem altera nada.
Nao use travessao no texto. Prefira virgula, ponto ou parenteses.

CUIDADOS IMPORTANTES:
- Preencha "itens" sempre que houver dado concreto (nota, data, titulo). E o que
  a tela mostra em destaque.`;
}

export type Evento = (
  | { tipo: "passo"; mensagem: string }
  | { tipo: "plano"; raciocinio: string; intencao: string; ferramentas: MetaFerramenta[] }
  | ({ tipo: "ferramenta_inicio" } & MetaFerramenta)
  | { tipo: "ferramenta_fim"; nome: string; ok: boolean; resumo: string }
) & {
  /** de qual conversa (aba) é o evento: sem isto, uma aba animava pela pergunta da outra */
  conversa?: string;
};

type MetaFerramenta = { nome: string; rotulo: string; fonte: string; icone: string };
type Emitir = (e: Evento) => void;

/* ----------------------- adaptadores de LLM ----------------------- */

/** O que cada fase manda para o modelo. `dados` vai estruturado, nunca
 *  concatenado no texto, para nao correr risco de truncar e virar JSON quebrado. */
export interface Entrada {
  pergunta: string;
  instrucao: string;
  dados?: Record<string, unknown>;
  /** ultimas trocas, para resolver perguntas de continuacao ("e em fisica?") */
  historico?: { pergunta: string; intencao: string }[];
}

/** Um motor sabe fazer as duas fases criativas, e so isso. Sem genericos
 *  soltos: cada metodo tem tipo de retorno concreto e validado. */
export interface Motor {
  nome: string;
  plano(entrada: Entrada): Promise<Plano>;
  resposta(entrada: Entrada): Promise<Resposta>;
}

/** Monta o texto para os modelos de verdade, cortando so o bloco de dados
 *  e avisando quando cortou. */
function montarPrompt(e: Entrada): string {
  // O modelo nao sabe que horas sao. Sem isto ele chuta, e chute vira
  // "sua proxima prova foi dia 9" com hoje sendo 26.
  let txt = `${cabecalhoTemporal()}\n`;
  if (e.historico?.length) {
    const linhas = e.historico
      .map((h) => `- "${h.pergunta}" (era sobre: ${h.intencao})`)
      .join("\n");
    txt += `\nConversa ate agora, da mais antiga para a mais recente:\n${linhas}\n`;
    txt += `Se a pergunta nova for continuacao (ex: "e em fisica?"), mantenha o mesmo assunto da anterior.\n`;
  }
  txt += `\nPergunta da aluna: "${e.pergunta}"\n\n${e.instrucao}`;
  if (e.dados) {
    const json = JSON.stringify(e.dados);
    const corte = 12000;
    txt += `\n\nDados lidos dos sistemas da escola (JSON):\n${json.slice(0, corte)}`;
    if (json.length > corte) txt += `\n[... truncado, use o que veio acima ...]`;
  }
  return txt;
}

function openai(): Motor {
  const modelo = process.env.OPENAI_MODEL || "gpt-6-luna";
  let cli: import("openai").default | null = null;

  async function pedir<S extends z.ZodType>(
    schema: S,
    nomeSchema: string,
    entrada: Entrada
  ): Promise<z.infer<S>> {
    if (!cli) {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error("Falta a OPENAI_API_KEY no .env.");
      const { default: OpenAI } = await import("openai");
      cli = new OpenAI({ apiKey: key });
    }
    const { zodResponseFormat } = await import("openai/helpers/zod");
    const r = await cli.chat.completions.create({
      model: modelo,
      messages: [
        { role: "system", content: papel() },
        { role: "user", content: montarPrompt(entrada) },
      ],
      response_format: zodResponseFormat(schema as never, nomeSchema),
    });
    return schema.parse(JSON.parse(r.choices[0].message.content ?? "{}"));
  }

  return {
    nome: `OpenAI ${modelo}`,
    plano: (e) => pedir(Plano, "plano", e),
    resposta: (e) => pedir(Resposta, "resposta", e),
  };
}

function gemini(): Motor {
  const modelo = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  let cli: { models: { generateContent(a: unknown): Promise<{ text?: string }> } } | null = null;

  async function pedir<S extends z.ZodType>(schema: S, entrada: Entrada): Promise<z.infer<S>> {
    if (!cli) {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error("Falta a GEMINI_API_KEY no .env.");
      const { GoogleGenAI } = await import("@google/genai");
      cli = new GoogleGenAI({ apiKey: key }) as never;
    }
    // zod v4 converte sozinho. A biblioteca zod-to-json-schema (v3) nao
    // entende zod v4 e devolvia um schema VAZIO, sem erro nenhum: o Gemini
    // recebia zero estrutura e o parse falhava depois.
    const r = await cli!.models.generateContent({
      model: modelo,
      contents: [{ role: "user", parts: [{ text: montarPrompt(entrada) }] }],
      config: {
        systemInstruction: papel(),
        responseMimeType: "application/json",
        responseSchema: z.toJSONSchema(schema),
      },
    });
    return schema.parse(JSON.parse(r.text ?? "{}"));
  }

  return {
    nome: `Gemini ${modelo}`,
    plano: (e) => pedir(Plano, e),
    resposta: (e) => pedir(Resposta, e),
  };
}

/* --------------------------- o agente ----------------------------- */

export function criarMotor(escolha = process.env.LLM_PROVIDER || "openai"): Motor {
  const e = escolha.toLowerCase();
  return e === "local" ? motorLocal() : e === "gemini" ? gemini() : openai();
}

export function criarAgente({
  emitir,
  request2faCode,
  // Injetáveis para teste: sem eles o laço do agente só rodava com modelo
  // de verdade e navegador aberto, e por isso não tinha teste nenhum.
  motor = criarMotor(),
  garantirSessao = (passo: (m: string) => void) =>
    ensureLoggedIn({ onStep: passo, request2faCode }),
  executarFerramenta = executar,
}: {
  emitir: Emitir;
  request2faCode: () => Promise<string>;
  motor?: Motor;
  garantirSessao?: (passo: (m: string) => void) => Promise<unknown>;
  executarFerramenta?: typeof executar;
}) {
  const llm = motor;

  // Um histórico por conversa (uma aba = uma conversa). Antes era um só para
  // o servidor inteiro: o "e em física?" de um aluno herdava o assunto da
  // pergunta do aluno anterior.
  type Troca = { pergunta: string; intencao: string };
  const conversas = new Map<string, Troca[]>();
  const MAX_CONVERSAS = 50;
  const MAX_TROCAS = 8;

  function historicoDe(id: string): Troca[] {
    let h = conversas.get(id);
    if (!h) {
      if (conversas.size >= MAX_CONVERSAS) {
        conversas.delete(conversas.keys().next().value as string); // a mais antiga
      }
      h = [];
      conversas.set(id, h);
    }
    return h;
  }

  async function perguntar(pergunta: string, conversaId = "padrao"): Promise<Resposta> {
    const historico = historicoDe(conversaId);
    const sinal = (e: Evento) => emitir({ ...e, conversa: conversaId });
    const passo = (mensagem: string) => sinal({ tipo: "passo", mensagem });
    // FASE 0: sessao (pode pausar pedindo o codigo 2FA para a pessoa)
    await garantirSessao(passo);

    // FASE 1: planejar
    passo("Entendendo a pergunta");
    const plano = await llm.plano({
      pergunta,
      instrucao: "Monte o plano para responder.",
      historico: historico.slice(-4),
    });
    historico.push({ pergunta, intencao: plano.intencao });
    if (historico.length > MAX_TROCAS) historico.splice(0, historico.length - MAX_TROCAS);

    sinal({
      tipo: "plano",
      raciocinio: plano.raciocinio,
      intencao: plano.intencao,
      ferramentas: plano.ferramentas.map((f) => metadados(f.nome)),
    });

    // FASE 2: executar, na ordem que o plano definiu
    const coletado: Record<string, unknown> = {};
    for (const { nome, args } of plano.ferramentas) {
      sinal({ tipo: "ferramenta_inicio", ...metadados(nome) });
      try {
        // os argumentos que o modelo escolheu, validados de novo pelo contrato
        const dados = await executarFerramenta(nome, args, passo);
        coletado[nome] = dados;
        sinal({ tipo: "ferramenta_fim", nome, ok: true, resumo: resumir(nome, dados) });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        coletado[nome] = { erro: msg };
        sinal({ tipo: "ferramenta_fim", nome, ok: false, resumo: msg });
      }
    }

    // FASE 3: responder
    passo("Escrevendo a resposta");
    const resposta = await llm.resposta({
      pergunta,
      instrucao: plano.ferramentas.length
        ? "Responda com base APENAS nos dados abaixo."
        : "Nenhuma fonte foi consultada, responda apenas conversando.",
      dados: plano.ferramentas.length ? coletado : undefined,
    });

    // A fonte nao e opiniao do modelo: sabemos exatamente o que foi lido.
    // (o modelo ja respondeu "nenhuma" depois de consultar o ClassApp)
    const fonteReal = plano.ferramentas.length
      ? capacidade(plano.ferramentas[0].nome).fonte
      : "nenhuma";

    return limparResposta({ ...resposta, fonte: fonteReal });
  }

  return { perguntar, provedor: llm.nome };
}

