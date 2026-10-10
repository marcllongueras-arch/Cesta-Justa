// Junta los catálogos de todas las cadenas en precios.json.
// Si una cadena falla, se conservan sus datos del día anterior.
import { readFile, writeFile } from "node:fs/promises";
import { scrapeMercadona } from "./mercadona.mjs";
import { scrapeConsum } from "./consum.mjs";
import { normalize } from "./normalize.mjs";

const SOURCES = { mercadona: scrapeMercadona, consum: scrapeConsum };
const only = (process.env.ONLY || "").split(",").filter(Boolean);

let prev = { chains: {}, products: [] };
try { prev = JSON.parse(await readFile("precios.json", "utf8")); } catch {}
const today = new Date().toISOString().slice(0, 10);
const chains = {}; let products = []; let ok = 0;

for (const [name, fn] of Object.entries(SOURCES)) {
  if (only.length && !only.includes(name)) continue;
  try {
    const t = Date.now();
    const r = await fn();
    chains[name] = { ...r.meta, updated: today };
    products.push(...r.products.map(normalize));
    ok++;
    console.log(`${name}: ${r.products.length} productos en ${Math.round((Date.now() - t) / 1000)} s`);
  } catch (e) {
    console.error(`${name}: ERROR ${e.message}. Se mantienen los datos anteriores.`);
    const old = (prev.products || []).filter(p => p.chain === name);
    if (old.length) { chains[name] = prev.chains?.[name] || { products: old.length }; products.push(...old); }
  }
}
if (!ok) { console.error("Ninguna cadena se pudo actualizar."); process.exit(1); }

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
console.log(`Total: ${products.length} productos de ${Object.keys(chains).length} cadenas.`);
