// Descarga el catálogo de la tienda online de Mercadona y lo guarda en precios.json.
// Se ejecuta cada día en GitHub Actions (ver .github/workflows/precios.yml).
// Uso local: node scraper/mercadona.mjs   (opcional: CP=08001 node scraper/mercadona.mjs)
import { writeFile, readFile } from "node:fs/promises";

const BASE = "https://tienda.mercadona.es/api";
const CP = process.env.CP || "";        // código postal para elegir el almacén (precios de esa zona)
let WH = process.env.WH || "";          // código de almacén, si ya se conoce
const OUT = process.env.OUT || "precios.json";
const HEADERS = { "Accept": "application/json", "User-Agent": "CestaJusta/1.0 (uso personal)" };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJSON(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: HEADERS });
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
      console.warn(`HTTP ${r.status} en ${url} (intento ${i})`);
    } catch (e) { console.warn(`Error de red en ${url} (intento ${i}): ${e.message}`); }
    await sleep(1500 * i);
  }
  throw new Error("No se pudo descargar " + url);
}

// Pide a la web el almacén que corresponde a un código postal (cabecera x-customer-wh).
async function warehouseForCP(cp) {
  try {
    const r = await fetch(`${BASE}/postal-codes/actions/change-pc/`, {
      method: "PUT",
      headers: { ...HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ new_postal_code: cp })
    });
    const wh = r.headers.get("x-customer-wh");
    console.log(`CP ${cp} → almacén ${wh || "(no indicado)"} [HTTP ${r.status}]`);
    return wh || "";
  } catch (e) { console.warn("No se pudo resolver el almacén:", e.message); return ""; }
}

const num = v => (v == null || v === "") ? null : Number(String(v).replace(",", "."));

function toProduct(p, cat, sub) {
  const pi = p.price_instructions || {};
  const price = num(pi.unit_price) ?? num(pi.bulk_price);
  if (price == null || isNaN(price)) return null;
  const prev = num(pi.previous_unit_price);
  const ref = num(pi.reference_price);
  return {
    id: "m" + p.id,
    name: p.display_name,
    pack: p.packaging || "",
    size: pi.unit_size && pi.size_format ? `${String(pi.unit_size).replace(".", ",")} ${pi.size_format}` : "",
    cat, sub,
    img: p.thumbnail || "",
    prices: { mercadona: price },
    ref: ref != null ? { mercadona: `${ref.toFixed(2).replace(".", ",")} €/${pi.reference_format || "ud"}` } : {},
    prev: prev && prev > price ? { mercadona: prev } : undefined,
    url: { mercadona: p.share_url || `https://tienda.mercadona.es/product/${p.id}` }
  };
}

async function main() {
  if (!WH && CP) WH = await warehouseForCP(CP);
  const q = `lang=es${WH ? "&wh=" + WH : ""}`;

  const root = await getJSON(`${BASE}/categories/?${q}`);
  const groups = root?.results || [];
  if (!groups.length) throw new Error("La lista de categorías vino vacía: puede que la web haya cambiado.");

  const seen = new Map();
  let subcats = 0;
  for (const g of groups) {
    for (const c of g.categories || []) {
      subcats++;
      const data = await getJSON(`${BASE}/categories/${c.id}/?${q}`);
      for (const block of data?.categories || []) {
        for (const p of block.products || []) {
          const prod = toProduct(p, g.name, c.name);
          if (prod && !seen.has(prod.id)) seen.set(prod.id, prod);
        }
      }
      await sleep(250); // sin prisas: no saturar la web
    }
  }

  const products = [...seen.values()].sort((a, b) => a.cat.localeCompare(b.cat, "es") || a.name.localeCompare(b.name, "es"));
  if (products.length < 500) throw new Error(`Solo ${products.length} productos: algo ha fallado, no se guarda nada.`);

  // Historial corto de precios (últimos 30 cambios por producto) para ver subidas y bajadas
  let history = {};
  try { history = JSON.parse(await readFile("historial.json", "utf8")); } catch {}
  const today = new Date().toISOString().slice(0, 10);
  for (const p of products) {
    const h = history[p.id] || (history[p.id] = []);
    const last = h[h.length - 1];
    if (!last || last[1] !== p.prices.mercadona) h.push([today, p.prices.mercadona]);
    if (h.length > 30) h.splice(0, h.length - 30);
  }

  const out = {
    updated: today,
    chains: { mercadona: { products: products.length, warehouse: WH || "por defecto", cp: CP || null } },
    products
  };
  await writeFile(OUT, JSON.stringify(out));
  await writeFile("historial.json", JSON.stringify(history));
  console.log(`OK: ${products.length} productos de ${subcats} subcategorías (almacén ${WH || "por defecto"}).`);
}

main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
