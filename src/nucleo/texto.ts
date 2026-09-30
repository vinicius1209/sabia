/** Helpers de texto do núcleo. */

/** tira acento e caixa, para "fisica" casar com "Física" */
export const semAcento = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Uma linha de progresso que a tela mostra enquanto o agente trabalha. */
export type Passo = (mensagem: string) => void;
