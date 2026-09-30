import { cabecalhoTemporal } from "./contexto.ts";
import type { LerConfig, PacoteDeAgente } from "./pacote.ts";
import { montarMemoria, type Troca } from "./memoria.ts";
import type { Registro } from "./registro.ts";

/** O que cada fase manda para o modelo. `dados` vai estruturado, nunca
 *  concatenado no texto, para não correr risco de truncar e virar JSON quebrado. */
export interface Entrada {
  pergunta: string;
  instrucao: string;
  dados?: Record<string, unknown>;
  /** as trocas anteriores desta conversa; a memória decide o que cabe (ver memoria.ts) */
  historico?: Troca[];
  /** "Parar": o motor cancela a chamada (mata a CLI, fecha a conexão) */
  sinal?: AbortSignal;
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
  "conversa" e nenhuma ferramenta. Pedido de um valor que as fontes tem nunca e
  "conversa", mesmo que o valor ja tenha aparecido antes: consulte de novo.
- Voce so sabe o que esta nas fontes acima. Se perguntarem algo fora delas, diga com
  simpatia o que voce consegue consultar, e NAO responda de memoria.
- Se uma fonte falhar ou vier indisponivel, diga que nao conseguiu ler aquela fonte agora
  e o motivo. Nunca complete com o que "costuma" estar la.
- Se um dado for ambiguo, estiver cortado ou voce nao souber o que uma sigla significa,
  mostre como esta na fonte e diga isso. Nao interprete nem complete.
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
  const memoria = montarMemoria(e.historico ?? []);
  if (memoria) {
    txt +=
      `\nConversa ate agora (da mais antiga para a mais recente):\n${memoria}\n\n` +
      `Use a conversa para entender a pergunta nova ("e em fisica?", "essa materia", "dela"). ` +
      `Ela NAO e fonte: dado novo so vale se vier das fontes lidas AGORA, e se o dado de agora ` +
      `divergir do que voce respondeu antes, vale o de agora.\n`;
  }
  txt += `\nPergunta: "${e.pergunta}"\n\n${e.instrucao}`;
  if (e.dados) {
    const json = JSON.stringify(e.dados);
    // Medido com dados reais (set/2026): boletim ~9 mil caracteres, comunicados
    // até ~4 mil, horários ~3 mil, diário ~2 mil, calendário ~1,5 mil. Com 12 mil,
    // uma pergunta que lesse boletim E comunicados cortava a segunda fonte. 24 mil
    // cabe as cinco juntas; passou disso, o aviso abaixo diz que cortou.
    const corte = 24000;
    txt += `\n\nDados lidos das fontes (JSON):\n${json.slice(0, corte)}`;
    if (json.length > corte) txt += `\n[... truncado, use o que veio acima ...]`;
  }
  return txt;
}
