// Prueba: fotos alternativas de Consum y formato de precios/paginación de Lidl.
import { writeFile, mkdir } from "node:fs/promises";
await mkdir("probe", { recursive: true });
const out = { consum: [], lidl: {} };
const d = await fetch("https://tienda.consum.es/api/rest/V1.0/catalog/product?q=leche%20entera&limit=3&offset=0", { headers: { Accept: "application/json" } }).then(r => r.json());
for (const p of d.products) {
  const urls = [p.productData.imageURL, ...(p.media || []).map(m => m.url)];
  for (const u of urls.slice(0, 3)) {
    const r = await fetch(u).catch(e => ({ status: e.message, headers: new Map() }));
    out.consum.push({ u, status: r.status, type: r.headers.get?.("content-type") });
  }
}
const L = "https://www.lidl.es/q/api/search";
const g = async (k, q) => { const r = await fetch(`${L}?${q}&locale=es_ES&assortment=ES&version=2.1.0`); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} return [r.status, j]; };
let [s, j] = await g("patata", "q=patata");
out.lidl.patata = { s, num: j?.numFound, fetchsize: j?.fetchsize, max: j?.maxfetchsize, n: j?.items?.length,
  facets: JSON.stringify(j?.facets || "").slice(0, 2500),
  items: (j?.items || []).slice(0, 6).map(i => ({ title: i.gridbox?.data?.fullTitle, cat: i.gridbox?.data?.category, price: JSON.stringify(i.gridbox?.data?.price || {}).slice(0, 900), lidlPlus: JSON.stringify(i.gridbox?.data?.lidlPlus || "").slice(0, 400), stock: JSON.stringify(i.gridbox?.data?.stockAvailability || "").slice(0, 300), keys: Object.keys(i.gridbox?.data || {}).join(",") })) };
for (const q of ["q=patata&offset=36", "q=patata&fetchsize=100", "q=leche&offset=36&fetchsize=36", "q=*", "q=alimentacion"]) {
  [s, j] = await g("x", q); out.lidl[q] = { s, num: j?.numFound, n: j?.items?.length, first: j?.items?.[0]?.gridbox?.data?.fullTitle };
}
await writeFile("probe/fotos-lidl2.json", JSON.stringify(out, null, 1));
