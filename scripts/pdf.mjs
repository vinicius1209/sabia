/** Renderiza docs/slides.html em docs/Sabia-ExpoSale.pdf (16:9). */
import { chromium } from "playwright";
import path from "node:path";

const html = "file://" + path.resolve("docs/slides.html");
const saida = "docs/Sabia-ExpoSale.pdf";

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(html, { waitUntil: "networkidle" });
await p.pdf({
  path: saida,
  width: "1280px",
  height: "720px",
  printBackground: true,
  pageRanges: "1-",
});
await b.close();
console.log("gerado:", saida);
