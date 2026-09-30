import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { criarPortao2FA, DoisFatoresCancelado } from "../src/doisfatores.ts";

describe("portao do codigo 2FA", () => {
  test("entrega o codigo digitado para quem esta esperando", async () => {
    const p = criarPortao2FA({ prazoMs: 1000 });
    const espera = p.pedir();
    assert.equal(p.responder("  7KQ2PX "), true);
    assert.equal(await espera, "7KQ2PX");
    assert.equal(p.esperando(), false);
  });

  test("EXPIRA se ninguem digitar, em vez de travar para sempre", async () => {
    // este era o bug: a espera nao terminava nunca e o servidor ficava preso
    const p = criarPortao2FA({ prazoMs: 30 });
    await assert.rejects(p.pedir(), DoisFatoresCancelado);
    assert.equal(p.esperando(), false);
  });

  test("pode ser cancelado pela tela", async () => {
    const p = criarPortao2FA({ prazoMs: 1000 });
    const espera = p.pedir();
    assert.equal(p.cancelar(), true);
    await assert.rejects(espera, /cancelado/);
  });

  test("codigo sem ninguem esperando e recusado, nao explode", () => {
    const p = criarPortao2FA();
    assert.equal(p.responder("123456"), false);
    assert.equal(p.cancelar(), false);
  });

  test("avisa a tela ao abrir e ao fechar, com o motivo", async () => {
    const eventos: string[] = [];
    const p = criarPortao2FA({
      prazoMs: 30,
      aoPedir: () => eventos.push("abriu"),
      aoEncerrar: (m) => eventos.push(`fechou:${m}`),
    });
    await p.pedir().catch(() => {});
    assert.deepEqual(eventos, ["abriu", "fechou:expirou"]);
  });

  test("pedido novo derruba um pedido velho pendurado", async () => {
    const p = criarPortao2FA({ prazoMs: 1000 });
    const velho = p.pedir();
    const novo = p.pedir();
    await assert.rejects(velho, DoisFatoresCancelado);
    p.responder("999999");
    assert.equal(await novo, "999999");
  });
});
