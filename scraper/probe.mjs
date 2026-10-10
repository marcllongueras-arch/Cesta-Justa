// Prueba 3: API de Alcampo y más cadenas.
import { writeFile, mkdir } from "node:fs/promises";
const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36";
const H = { "User-Agent": UA, "Accept": "application/json,text/html;q=0.9,*/*;q=0.8", "Accept-Language": "es-ES,es;q=0.9" };
await mkdir("probe", { recursive: true });
const get = async (u, h = {}) => { try { const r = await fetch(u, { headers: { ...H, ...h } }); return { status: r.status, type: r.headers.get("content-type"), text: await r.text() }; } catch (e) { return { status: 0, text: e.message }; } };
const out = {};

// --- Alcampo: buscar objetos de producto dentro del estado inicial
const a = await get("https://www.compraonline.alcampo.es/categories/frescos/OC2112");
const m = a.text.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
if (m) {
  const st = JSON.parse(m[1]);
  const found = [];
  const walk = (o, path, d) => {
    if (!o || typeof o !== "object" || d > 9 || found.length > 6) return;
    if (!Array.isArray(o) && ("retailerProductId" in o || "productId" in o) && JSON.stringify(o).includes("price")) { found.push({ path, sample: JSON.stringify(o).slice(0, 1500) }); return; }
    for (const k of Object.keys(o)) walk(o[k], path + "." + k, d + 1);
  };
  walk(st.data, "data", 0);
  out.alcampoState = { dataKeys: Object.keys(st.data || {}), found };
}
for (const [k, u] of [
  ["v6-search", "https://www.compraonline.alcampo.es/api/webproductpagews/v6/product-pages/search?includeAdditionalPageInfo=true&maxPageSize=50&maxProductsToDecorate=50&tag=web&term=leche"],
  ["v6-cat", "https://www.compraonline.alcampo.es/api/webproductpagews/v6/product-pages?categoryId=OC2112&includeAdditionalPageInfo=true&maxPageSize=50&maxProductsToDecorate=50&tag=web"],
  ["v5-bop", "https://www.compraonline.alcampo.es/api/webproductpagews/v5/products/bop?retailerProductId=6431"],
  ["cats-v2", "https://www.compraonline.alcampo.es/api/webproductpagews/v2/categories"],
  ["v1-cat-tree", "https://www.compraonline.alcampo.es/api/webproductpagews/v1/category-tree"]
]) { const r = await get(u); out["alcampo-" + k] = { status: r.status, type: r.type, head: r.text.slice(0, 1200) }; await new Promise(r => setTimeout(r, 500)); }

// --- Otras cadenas
for (const [k, u] of [
  ["lidl-ofertas", "https://www.lidl.es/es/ofertas"],
  ["lidl-search-api", "https://www.lidl.es/q/api/search?q=leche&locale=es_ES&assortment=ES&version=2.1.0"],
  ["aldi", "https://www.aldi.es/productos.html"],
  ["aldi-search", "https://www.aldi.es/es/search.html?q=leche"],
  ["bonpreu", "https://www.compraonline.bonpreuesclat.cat/search?q=llet"],
  ["caprabo", "https://www.capraboacasa.com/es/search?q=leche"],
  ["ahorramas", "https://www.ahorramas.com/buscador?q=leche"],
  ["hipercor", "https://www.hipercor.es/supermercado/buscar/?term=leche"],
  ["elcorteingles", "https://www.elcorteingles.es/supermercado/buscar/?term=leche"],
  ["gadis", "https://www.gadisline.com/buscar/?q=leche"],
  ["bm", "https://www.online.bmsupermercados.es/es/buscar?q=leche"],
  ["froiz", "https://tienda.froiz.com/buscar?q=leche"],
  ["condis", "https://www.condisline.com/es/search?q=leche"],
  ["masymas", "https://www.supermercadosmasymas.com/buscar?q=leche"],
  ["family-cash", "https://www.familycash.es/buscar?q=leche"],
  ["dia-home", "https://www.dia.es/"]
]) {
  const r = await get(u);
  const hints = [...new Set(r.text.match(/__NEXT_DATA__|__INITIAL_STATE__|__NUXT__|application\/ld\+json|"price"|data-price|"ean"|Cloudflare|captcha|Access Denied/gi) || [])];
  out[k] = { status: r.status, type: r.type, bytes: r.text.length, hints, head: r.text.slice(0, 400) };
  await new Promise(r => setTimeout(r, 500));
}
await writeFile("probe/result3.json", JSON.stringify(out, null, 1));
console.log(Object.entries(out).map(([k, v]) => `${k}: ${v.status ?? "-"}`).join("\n"));
