// Prueba rápida: formato real de las direcciones de categoría en Alcampo y Bonpreu.
import { writeFile, mkdir } from "node:fs/promises";
const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36";
await mkdir("probe", { recursive: true });
const out = {};
for (const [name, base, path] of [["bonpreu", "https://www.compraonline.bonpreuesclat.cat", "/categories"], ["alcampo", "https://www.compraonline.alcampo.es", "/categories"]]) {
  const o = out[name] = { tries: [] };
  const r = await fetch(base + path, { headers: { "User-Agent": UA, "Accept": "text/html", "Accept-Language": "es-ES" }, signal: AbortSignal.timeout(25000) });
  const html = await r.text();
  o.rootStatus = r.status;
  o.hrefs = [...new Set(html.match(/href="(\/categories\/[^"]+)"/g) || [])].slice(0, 40);
  const m = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
  const st = m ? JSON.parse(m[1]) : null;
  const cats = Object.values(st?.data?.categories?.categories || {});
  o.catSample = cats.slice(0, 4);
  const c = cats.find(x => x.children && x.children.length) || cats[0];
  const cand = [];
  if (c) {
    const p = String(c.fullURLPath || "");
    cand.push(`/categories/${p}/${c.retailerId}`, `/categories/${p.toLowerCase()}/${c.retailerId}`, `/categories/${c.retailerId}`, `/categories/${p}`, `/categories/x/${c.retailerId}`, `/categories/${p.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${c.retailerId}`, `/categories/${c.id}`);
  }
  for (const u of cand) {
    try {
      const rr = await fetch(base + u, { headers: { "User-Agent": UA, "Accept": "text/html", "Accept-Language": "es-ES" }, redirect: "manual", signal: AbortSignal.timeout(25000) });
      const t = await rr.text();
      const mm = t.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
      let n = null; try { n = mm ? Object.keys(JSON.parse(mm[1]).data?.products?.productEntities || {}).length : null; } catch {}
      o.tries.push({ u, status: rr.status, loc: rr.headers.get("location"), bytes: t.length, hasState: !!mm, products: n, head: mm ? "" : t.slice(0, 200) });
    } catch (e) { o.tries.push({ u, error: e.message }); }
    await new Promise(r => setTimeout(r, 800));
  }
}
await writeFile("probe/ocado.json", JSON.stringify(out, null, 1));
