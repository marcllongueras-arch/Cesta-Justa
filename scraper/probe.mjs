// Prueba qué webs de supermercados responden desde GitHub Actions y con qué formato.
import { writeFile, mkdir } from "node:fs/promises";
const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36";
const T = [
  ["dia-search-api", "https://www.dia.es/api/v1/search-back/search/reduced?q=leche%20entera&page=1"],
  ["dia-search-html", "https://www.dia.es/search?q=leche%20entera"],
  ["dia-plp-api", "https://www.dia.es/api/v1/plp-back/reduced/leche-huevos-y-mantequilla/leche/c/L2001"],
  ["dia-menu-api", "https://www.dia.es/api/v1/common-back/menu"],
  ["dia-sitemap", "https://www.dia.es/sitemap.xml"],
  ["carrefour-search-api", "https://www.carrefour.es/search-api/query/v1/search?query=leche%20entera&scope=desktop&lang=es&rows=24&start=0&origin=default&f.op=OR"],
  ["carrefour-plp-api", "https://www.carrefour.es/cloud-api/plp-food-papi/v1/supermercado/la-despensa/cat20001/c"],
  ["carrefour-html", "https://www.carrefour.es/supermercado/"],
  ["alcampo-api-v5", "https://www.compraonline.alcampo.es/api/v5/products/search?term=leche%20entera&limit=20"],
  ["alcampo-api-v6", "https://www.compraonline.alcampo.es/api/webproductpagews/v6/product-pages/search?term=leche%20entera&maxPageSize=20"],
  ["alcampo-html", "https://www.compraonline.alcampo.es/search?q=leche%20entera"],
  ["eroski-html", "https://supermercado.eroski.es/es/search/results/?q=leche%20entera"],
  ["consum-api", "https://tienda.consum.es/api/rest/V1.0/catalog/product?q=leche%20entera&limit=5&offset=0"],
  ["consum-cats", "https://tienda.consum.es/api/rest/V1.0/shopping/category/menu"],
  ["bonarea-html", "https://www.bonarea-online.com/es/shop/buscar?q=leche"],
  ["condis-html", "https://compraonline.condisline.com/search?q=leche"]
];
await mkdir("probe", { recursive: true });
const out = [];
for (const [name, url] of T) {
  const row = { name, url };
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/json,text/html;q=0.9,*/*;q=0.8", "Accept-Language": "es-ES,es;q=0.9" }, redirect: "follow" });
    const body = await r.text();
    Object.assign(row, { status: r.status, type: r.headers.get("content-type"), final: r.url, bytes: body.length, head: body.slice(0, 1500) });
    // pistas: JSON incrustado en HTML
    const m = body.match(/__NEXT_DATA__|window\.__INITIAL_STATE__|__NUXT__|application\/ld\+json|"price"|data-price/g);
    row.hints = [...new Set(m || [])];
    const i = body.search(/leche entera/i); if (i > 0) row.sample = body.slice(Math.max(0, i - 600), i + 900);
  } catch (e) { row.error = e.message; }
  out.push(row);
  console.log(name, row.status || row.error, row.bytes || "");
  await new Promise(r => setTimeout(r, 700));
}
await writeFile("probe/result.json", JSON.stringify(out, null, 1));
