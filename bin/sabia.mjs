#!/usr/bin/env node
// O comando `sabia`. Fica em JavaScript simples de propósito: num Node antigo,
// isto ainda roda e explica o que fazer, em vez de quebrar com erro de sintaxe.
const [maior, menor] = process.versions.node.split(".").map(Number);
if (maior < 22 || (maior === 22 && menor < 12)) {
  console.error(
    `\n  O Sabiá precisa do Node 22.12 ou mais novo, e este computador tem o ${process.versions.node}.\n` +
      "  Baixe a versão LTS em https://nodejs.org e rode o comando de novo.\n"
  );
  process.exit(1);
}
await import("../dist/sabia.mjs");
