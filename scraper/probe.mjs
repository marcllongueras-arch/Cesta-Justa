// Prueba: estructura del buscador de Lidl y cómo recorrer el catálogo entero.
import { writeFile, mkdir } from "node:fs/promises";
const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36";
await mkdir("probe", { recursive: true });
const B = "https://www.lidl.es/q/api/search";
const out = {};
const get = async (k, u) => {
  try {
    const r = await fetch(u, { headers: { "User-Agent": UA, "Accept": "application/json", "Accept-Language": "es-ES" }, signal: AbortSignal.timeout(25000) });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
    out[k] = { u, status: r.status, bytes: t.length, keys: j ? Object.keys(j) : null, num: j?.numFound ?? j?.total ?? null, items: j?.items?.length ?? null, facets: j ? JSON.stringify(j.facets || j.filters || "").slice(0, 1500) : null, first: j?.items ? JSON.stringify(j.items[0]).slice(0, 4000) : t.slice(0, 600) };
  } catch (e) { out[k] = { u, error: e.message }; }
  await new Promise(r => setTimeout(r, 700));
};
await get("leche", `${B}?q=leche&locale=es_ES&assortment=ES&version=2.1.0`);
await get("leche-p2", `${B}?q=leche&locale=es_ES&assortment=ES&version=2.1.0&offset=12&fetchsize=48`);
await get("star", `${B}?q=*&locale=es_ES&assortment=ES&version=2.1.0&fetchsize=48`);
await get("empty", `${B}?locale=es_ES&assortment=ES&version=2.1.0&fetchsize=48`);
await get("cat-alim", `${B}?category=Alimentaci%C3%B3n&locale=es_ES&assortment=ES&version=2.1.0&fetchsize=48`);
await get("patata", `${B}?q=patata&locale=es_ES&assortment=ES&version=2.1.0&fetchsize=100`);
const h = await fetch("https://www.lidl.es/c/alimentacion/s10068374", { headers: { "User-Agent": UA } }).then(r => r.text()).catch(e => e.message);
out.catPage = { links: [...new Set(String(h).match(/href="(\/c\/[^"]+)"/g) || [])].slice(0, 60), apiHints: [...new Set(String(h).match(/\/q\/api\/[^"' ]+/g) || [])].slice(0, 10) };
await writeFile("probe/lidl.json", JSON.stringify(out, null, 1));
