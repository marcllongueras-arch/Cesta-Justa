// Prueba: (1) fotos de Consum, (2) buscador de Lidl con distintas cabeceras.
import { writeFile, readFile, mkdir } from "node:fs/promises";
const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36";
await mkdir("probe", { recursive: true });
const out = { consum: [], lidl: [] };
const P = JSON.parse(await readFile("precios.json", "utf8")).products.filter(p => p.chain === "consum").slice(0, 3);
for (const p of P) {
  for (const [k, u, h] of [
    ["tal cual", p.img, {}],
    ["sin parámetros", p.img.split("?")[0], {}],
    ["referer github", p.img, { Referer: "https://marcllongueras-arch.github.io/" }],
    ["referer consum", p.img, { Referer: "https://tienda.consum.es/" }],
    ["UA navegador", p.img, { "User-Agent": UA, Accept: "image/avif,image/webp,image/*,*/*;q=0.8" }]
  ]) {
    try { const r = await fetch(u, { headers: h, signal: AbortSignal.timeout(20000) }); const b = await r.arrayBuffer();
      out.consum.push({ k, u, status: r.status, type: r.headers.get("content-type"), bytes: b.byteLength, cors: r.headers.get("access-control-allow-origin"), corp: r.headers.get("cross-origin-resource-policy") });
    } catch (e) { out.consum.push({ k, u, error: e.message }); }
  }
}
const L = "https://www.lidl.es/q/api/search";
for (const [k, u, h] of [
  ["simple", `${L}?q=leche&locale=es_ES&assortment=ES&version=2.1.0`, { "User-Agent": UA, "Accept": "application/json,text/html;q=0.9,*/*;q=0.8", "Accept-Language": "es-ES,es;q=0.9" }],
  ["sin UA", `${L}?q=leche&locale=es_ES&assortment=ES&version=2.1.0`, {}],
  ["referer", `${L}?q=leche&locale=es_ES&assortment=ES&version=2.1.0&fetchsize=48&offset=0`, { "User-Agent": UA, "Accept": "application/mindshift.search+json;version=2.1.0", "Referer": "https://www.lidl.es/q/search?q=leche" }],
  ["embebido", `${L}?isEmbedded=true&onlyGrid=true&fetchsize=48&locale=es_ES&assortment=ES&offset=0&version=2.1.0&category.id=10068374`, { "User-Agent": UA, "Accept": "application/json,text/html;q=0.9,*/*;q=0.8", "Referer": "https://www.lidl.es/" }]
]) {
  try { const r = await fetch(u, { headers: h, signal: AbortSignal.timeout(25000) }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
    out.lidl.push({ k, status: r.status, type: r.headers.get("content-type"), bytes: t.length, keys: j ? Object.keys(j) : null, num: j?.numFound ?? null, items: j?.items?.length ?? null, first: j?.items ? JSON.stringify(j.items[0]).slice(0, 3500) : t.slice(0, 300) });
  } catch (e) { out.lidl.push({ k, error: e.message }); }
  await new Promise(r => setTimeout(r, 800));
}
await writeFile("probe/fotos-lidl.json", JSON.stringify(out, null, 1));
