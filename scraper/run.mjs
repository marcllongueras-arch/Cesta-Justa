// Junta los catálogos de todas las cadenas en precios.json.
// Si una cadena falla, se conservan sus datos del día anterior.
import { readFile, writeFile } from "node:fs/promises";
import { scrapeMercadona } from "./mercadona.mjs";
import { scrapeConsum } from "./consum.mjs";
import { scrapeAhorramas } from "./ahorramas.mjs";
import { scrapeLidl } from "./lidl.mjs";
import { normalize } from "./normalize.mjs";

const ocado = name => async () => (await import("./ocado.mjs"))[name]();
const SOURCES = { mercadona: scrapeMercadona, consum: scrapeConsum, ahorramas: scrapeAhorramas, lidl: scrapeLidl, alcampo: ocado("scrapeAlcampo"), bonpreu: ocado("scrapeBonpreu") };
// Alcampo y Bonpreu bloquean las conexiones desde servidores: solo se intentan si se piden expresamente
// (o cuando el script se ejecute desde una conexión de casa).
const DEFAULT = ["mercadona", "consum", "ahorramas", "lidl"];
const only = (process.env.ONLY || "").split(",").filter(Boolean);
if (!only.length) only.push(...DEFAULT);

let prev = { chains: {}, products: [] };
try { prev = JSON.parse(await readFile("precios.json", "utf8")); } catch {}
const today = new Date().toISOString().slice(0, 10);
const chains = {}; let products = []; let ok = 0; const estado = {};

for (const [name, fn] of Object.entries(SOURCES)) {
  if (only.length && !only.includes(name)) {   // cadena no pedida: se conservan sus datos
    const old = (prev.products || []).filter(p => p.chain === name);
    if (old.length) { chains[name] = prev.chains?.[name] || { products: old.length }; products.push(...old); }
    continue;
  }
  try {
    const t = Date.now();
    const LIMIT = 28 * 60 * 1000;   // ninguna cadena puede bloquear el resto
    const r = await Promise.race([fn(), new Promise((_, ko) => setTimeout(() => ko(new Error(`tardó más de ${LIMIT / 60000} min`)), LIMIT).unref())]);
    chains[name] = { ...r.meta, updated: today };
    products.push(...r.products.map(normalize));
    ok++;
    console.log(`${name}: ${r.products.length} productos en ${Math.round((Date.now() - t) / 1000)} s`);
    estado[name] = { ok: true, products: r.products.length, seconds: Math.round((Date.now() - t) / 1000), debug: r.debug || null };
  } catch (e) {
    console.error(`${name}: ERROR ${e.message}. Se mantienen los datos anteriores.`);
    estado[name] = { ok: false, error: e.message, debug: e.debug || null };
    const old = (prev.products || []).filter(p => p.chain === name);
    if (old.length) { chains[name] = prev.chains?.[name] || { products: old.length }; products.push(...old); }
  }
}
if (!ok || products.length < 1000) {
  console.error("No hay datos nuevos suficientes; se guarda solo el informe.");
  await writeFile("estado.json", JSON.stringify({ updated: new Date().toISOString(), estado }, null, 1));
  process.exit(0);
}

// Historial de precios (últimos 30 cambios por producto)
let history = {};
try { history = JSON.parse(await readFile("historial.json", "utf8")); } catch {}
for (const p of products) {
  const h = history[p.id] || (history[p.id] = []);
  const last = h[h.length - 1];
  if (!last || last[1] !== p.price) h.push([today, p.price]);
  if (h.length > 30) h.splice(0, h.length - 30);
}

products.sort((a, b) => a.chain.localeCompare(b.chain) || a.cat.localeCompare(b.cat, "es") || a.name.localeCompare(b.name, "es"));
await writeFile("precios.json", JSON.stringify({ version: 2, updated: today, chains, products }));
await writeFile("historial.json", JSON.stringify(history));
await writeFile("estado.json", JSON.stringify({ updated: new Date().toISOString(), estado }, null, 1));
console.log(`Total: ${products.length} productos de ${Object.keys(chains).length} cadenas.`);
process.exit(0);
