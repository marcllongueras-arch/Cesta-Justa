// Prueba 2: estructura detallada de Consum y Alcampo.
import { writeFile, mkdir } from "node:fs/promises";
const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36";
const H = { "User-Agent": UA, "Accept": "application/json,text/html;q=0.9,*/*;q=0.8", "Accept-Language": "es-ES,es;q=0.9" };
await mkdir("probe", { recursive: true });
const get = async u => { const r = await fetch(u, { headers: H }); return { status: r.status, text: await r.text() }; };

// Consum: búsqueda completa y listado por categoría
const c1 = await get("https://tienda.consum.es/api/rest/V1.0/catalog/product?q=leche%20entera&limit=2&offset=0");
await writeFile("probe/consum-search.json", c1.text);
const c2 = await get("https://tienda.consum.es/api/rest/V1.0/catalog/product?limit=100&offset=0&categories=2811");
await writeFile("probe/consum-cat.txt", `status ${c2.status}\n` + c2.text.slice(0, 3000));
const c3 = await get("https://tienda.consum.es/api/rest/V1.0/catalog/product?limit=100&offset=0");
let total = null; try { total = JSON.parse(c3.text).totalCount; } catch {}
await writeFile("probe/consum-all.txt", `status ${c3.status} total ${total}\n`);

// Alcampo: estado inicial de la página de búsqueda
const a = await get("https://www.compraonline.alcampo.es/search?q=leche%20entera");
const m = a.text.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
let info = { status: a.status, found: !!m };
if (m) {
  try {
    const st = JSON.parse(m[1]);
    info.topKeys = Object.keys(st);
    const s = JSON.stringify(st);
    const i = s.indexOf('"price"');
    info.priceSample = s.slice(Math.max(0, i - 1500), i + 1500);
    const j = s.indexOf('"productId"'); info.productSample = s.slice(Math.max(0, j - 300), j + 1500);
  } catch (e) { info.parseError = e.message; info.raw = m[1].slice(0, 2000); }
}
const ld = a.text.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
info.ld = ld ? ld[1].slice(0, 1500) : null;
const api = [...new Set(a.text.match(/\/api\/[a-zA-Z0-9\/_\-.]+/g) || [])].slice(0, 40); info.apiPaths = api;
await writeFile("probe/alcampo.json", JSON.stringify(info, null, 1));
const a2 = await get("https://www.compraonline.alcampo.es/categories");
await writeFile("probe/alcampo-cats.txt", `status ${a2.status}\n` + [...new Set(a2.text.match(/\/categories\/[a-z0-9\-]+\/[A-Za-z0-9]+/g) || [])].slice(0, 80).join("\n"));
console.log("ok", c1.status, c2.status, c3.status, total, a.status, !!m);
