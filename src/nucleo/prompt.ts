import { cabecalhoTemporal } from "./contexto.ts";
import type { LerConfig, PacoteDeAgente } from "./pacote.ts";
import type { Registro } from "./registro.ts";

/** O que cada fase manda para o modelo. `dados` vai estruturado, nunca
 *  concatenado no texto, para não correr risco de truncar e virar JSON quebrado. */
export interface Entrada {
  pergunta: string;
  instrucao: string;
  dados?: Record<string, unknown>;
  /** últimas trocas, para resolver perguntas de continuação ("e em física?") */
  historico?: { pergunta: string; intencao: string }[];
}

/**
 * O prompt de sistema: a identidade vem do pacote, as regras que valem para
 * qualquer agente vêm daqui.
 */
export function montarSistema(pacote: PacoteDeAgente, registro: Registro, cfg: LerConfig): string {
  return `${pacote.persona(cfg)}

Fontes disponiveis (somente leitura):
${registro.descricaoDasFontes()}

Regras que valem sempre:
- Nunca invente um dado. Se nao esta nas fontes, diga que nao encontrou.
- Se a pergunta nao precisa de dado (um "oi", um agradecimento), use intencao
  "conversa" e nenhuma ferramenta.
- Voce so sabe o que esta nas fontes acima. Se perguntarem algo fora delas, diga com
  simpatia o que voce consegue consultar, e NAO responda de memoria.
- Voce e somente leitura: nao envia mensagem nem altera nada.
- Nao use travessao no texto. Prefira virgula, ponto ou parenteses.
- Preencha "itens" sempre que houver dado concreto (valor, data, titulo). E o que a
  tela mostra em destaque. Nao repita no texto uma lista longa que ja esta nos itens.`;
}

/** Monta o texto da pergunta, cortando só o bloco de dados e avisando quando cortou. */
export function montarPrompt(e: Entrada): string {
  // O modelo não sabe que horas são. Sem isto ele chuta, e chute vira
  // "sua próxima prova foi dia 9" com hoje sendo 26.
  let txt = `${cabecalhoTemporal()}\n`;
  if (e.historico?.length) {
    const linhas = e.historico.map((h) => `- "${h.pergunta}" (era sobre: ${h.intencao})`).join("\n");
    txt += `\nConversa ate agora, da mais antiga para a mais recente:\n${linhas}\n`;
    txt += `Se a pergunta nova for continuacao (ex: "e em fisica?"), mantenha o mesmo assunto da anterior.\n`;
  }
  txt += `\nPergunta: "${e.pergunta}"\n\n${e.instrucao}`;
  if (e.dados) {
    const json = JSON.stringify(e.dados);
    const corte = 12000;
    txt += `\n\nDados lidos das fontes (JSON):\n${json.slice(0, corte)}`;
    if (json.length > corte) txt += `\n[... truncado, use o que veio acima ...]`;
  }
  return txt;
}
