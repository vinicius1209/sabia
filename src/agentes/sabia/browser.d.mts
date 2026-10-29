/** Tipos para o modulo de navegador em .mjs. */
import type { BrowserContext, Page } from "playwright";

/** Seletores do login do ClassApp, nos dois idiomas (ver browser.mjs). */
export const TROCAR_PARA_CELULAR: RegExp;
export const CAMPO_CELULAR: string;
export const BOTAO_CONTINUAR: string;

export function getBrowser(): Promise<{ ctx: BrowserContext; page: Page }>;
export function closeBrowser(): Promise<void>;
export function ensureLoggedIn(opcoes: {
  onStep?: (mensagem: string) => void;
  request2faCode: () => Promise<string>;
}): Promise<string>;
export function getEntityId(): string | null;
export function getPage(): Page | null;

export function navegarAutenticado(
  url: string,
  onStep?: (mensagem: string) => void
): Promise<void>;
