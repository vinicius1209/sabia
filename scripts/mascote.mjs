/**
 * Gera o mascote do Sabiá com a API de imagem da OpenAI.
 *   node scripts/mascote.mjs
 *
 * Usa a mesma OPENAI_API_KEY do .env. As imagens caem em docs/marca/.
 */
import fs from "node:fs";
import path from "node:path";

for (const l of fs.readFileSync(".env", "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const KEY = process.env.OPENAI_API_KEY;
const MODELO = process.env.IMAGE_MODEL || "gpt-image-2.5-sunburst";
const SAIDA = "docs/marca";
fs.mkdirSync(SAIDA, { recursive: true });

/* O sabia-laranjeira e a ave nacional: dorso pardo, barriga laranja.
   O mascote precisa funcionar em icone pequeno E em banner grande, entao:
   formas simples, silhueta forte, poucas cores, sem detalhe fino. */
const BASE = `Mascote de um sabiá-laranjeira (ave nacional do Brasil): dorso marrom
acinzentado, barriga laranja terrosa, bico amarelo curto, olhos grandes e amigáveis.

ESTILO OBRIGATÓRIO, sempre igual entre as imagens: ilustração VETORIAL CHAPADA,
cores sólidas em áreas planas, contorno escuro uniforme ao redor de toda a figura,
formas simples e geométricas, paleta reduzida a poucos tons.
NÃO use pintura digital, NÃO use sombreado suave ou degradê realista, NÃO use textura
de pena detalhada, NÃO coloque sombra no chão, NÃO coloque brilho ou iluminação.
Fundo totalmente transparente.

Silhueta forte que continua legível reduzida a um ícone pequeno. Simpático e
inteligente, sem ser infantil demais. Sem texto, sem letras, sem marca d'água.`;

const VARIANTES = [
  { nome: "sabia-01-mascote", extra: "Corpo inteiro, de frente, pousado, postura curiosa com a cabeça levemente inclinada." },
  { nome: "sabia-02-icone", extra: "Somente a cabeça, de frente, enquadrada como ícone de aplicativo, centralizada, bem generosa na moldura." },
  { nome: "sabia-03-acao", extra: "De perfil em voo suave, asas abertas, carregando um pequeno envelope de carta no bico, sugerindo que traz uma informação." },
  { nome: "sabia-04-pensando", extra: "Sentado, uma asa encostada no queixo em pose pensativa, olhando para cima, com um pequeno balão de pensamento vazio ao lado da cabeça." },
  { nome: "sabia-05-buscando", extra: "Segurando uma lupa grande com a asa, olhando através dela com expressão concentrada, como quem está procurando uma informação." },
  { nome: "sabia-06-confuso", extra: "Expressão confusa e envergonhada, cabeça inclinada, uma asa coçando a nuca, com um pequeno ponto de interrogação flutuando acima." },
  { nome: "sabia-07-comemorando", extra: "Asas abertas para cima comemorando, expressão alegre, com pequenas estrelinhas de brilho ao redor." },
];
// permite gerar so as novas:  APENAS=sabia-04,sabia-05 node scripts/mascote.mjs
const filtro = process.env.APENAS?.split(",").map((s) => s.trim());

for (const v of VARIANTES) {
  if (filtro && !filtro.some((f) => v.nome.startsWith(f))) continue;
  process.stdout.write(`gerando ${v.nome}... `);
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODELO,
      prompt: `${BASE}\n${v.extra}`,
      size: "1024x1024",
      n: 1,
      // fundo transparente: sem isso vira uma caixa branca em cima de slide escuro
      background: "transparent",
      output_format: "png",
    }),
  });
  const j = await r.json();
  if (j.error) {
    console.log(`FALHOU: ${j.error.message?.slice(0, 120)}`);
    continue;
  }
  const item = j.data?.[0];
  const destino = path.join(SAIDA, `${v.nome}.png`);
  if (item?.b64_json) {
    fs.writeFileSync(destino, Buffer.from(item.b64_json, "base64"));
  } else if (item?.url) {
    const img = await fetch(item.url);
    fs.writeFileSync(destino, Buffer.from(await img.arrayBuffer()));
  } else {
    console.log("resposta sem imagem");
    continue;
  }
  console.log(`ok -> ${destino} (${(fs.statSync(destino).size / 1024).toFixed(0)} KB)`);
}
