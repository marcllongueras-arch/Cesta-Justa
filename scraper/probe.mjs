// Prueba 4: paginación de Alcampo/Bonpreu (plataforma Ocado) y estructura de Ahorramás.
import { writeFile, mkdir } from "node:fs/promises";
const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36";
const H = { "User-Agent": UA, "Accept": "text/html,application/json;q=0.9,*/*;q=0.8", "Accept-Language": "es-ES,es;q=0.9" };
await mkdir("probe", { recursive: true });
const get = async (u, h = {}) => { try { const r = await fetch(u, { headers: { ...H, ...h } }); return { status: r.status, type: r.headers.get("content-type"), text: await r.text(), headers: Object.fromEntries(r.headers) }; } catch (e) { return { status: 0, text: e.message }; } };
const state = html => { const m = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/); try { return m ? JSON.parse(m[1]) : null; } catch { return null; } };
const out = {};

async function ocado(name, base, catPath) {
  const o = {};
  const r1 = await get(base + catPath);
  const st = state(r1.text);
  if (!st) { o.err = "sin estado " + r1.status; return o; }
  const ents = st.data?.products?.productEntities || {};
  o.page1Count = Object.keys(ents).length;
  o.listerPage = JSON.stringify(st.data?.listerPage || {}).slice(0, 2500);
  o.search = JSON.stringify(st.data?.search || {}).slice(0, 800);
  o.categories = JSON.stringify(st.data?.categories || {}).slice(0, 2500);
  const first = Object.values(ents)[0]; o.entitySample = JSON.stringify(first || {}).slice(0, 2500);
  o.apiPaths = [...new Set(r1.text.match(/\/api\/[a-zA-Z0-9\/_\-.]+/g) || [])].slice(0, 30);
  o.scripts = [...new Set(r1.text.match(/src="([^"]+\.js)"/g) || [])].slice(0, 15);
  for (const q of ["?page=2", "?offset=30", "?pageSize=300"]) {
    const r = await get(base + catPath + q); const s2 = state(r.text);
    o["try" + q] = { status: r.status, count: Object.keys(s2?.data?.products?.productEntities || {}).length, firstIdDiffers: s2 ? Object.keys(s2.data.products.productEntities)[0] !== Object.keys(ents)[0] : null };
  }
  const sm = await get(base + "/sitemap.xml"); o.sitemap = { status: sm.status, head: sm.text.slice(0, 1500) };
  return o;
}
out.alcampo = await ocado("alcampo", "https://www.compraonline.alcampo.es", "/categories/frescos/OC2112");
out.bonpreu = await ocado("bonpreu", "https://www.compraonline.bonpreuesclat.cat", "/categories");

// Ahorramás (parece Salesforce Commerce Cloud)
const ah = await get("https://www.ahorramas.com/buscador?q=leche");
const i = ah.text.indexOf("data-price"); const j = ah.text.indexOf("product-tile");
out.ahorramas = {
  status: ah.status,
  tileSample: ah.text.slice(Math.max(0, j - 200), j + 3000),
  priceSample: ah.text.slice(Math.max(0, i - 1500), i + 800),
  links: [...new Set(ah.text.match(/href="(\/[a-z0-9\-\/]+)"/g) || [])].slice(0, 60),
  paging: [...new Set(ah.text.match(/(start|sz)=\d+[^"']{0,60}/g) || [])].slice(0, 10)
};
const ah2 = await get("https://www.ahorramas.com/buscador?q=leche&start=0&sz=100");
out.ahorramas.sz100 = { status: ah2.status, tiles: (ah2.text.match(/product-tile/g) || []).length, tiles1: (ah.text.match(/product-tile/g) || []).length };
const ahs = await get("https://www.ahorramas.com/sitemap_index.xml"); out.ahorramas.sitemap = { status: ahs.status, head: ahs.text.slice(0, 1000) };

await writeFile("probe/result4.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out).length);
