// Alcampo y Bonpreu/Esclat usan la misma plataforma de tienda online (Ocado).
// Cada página de categoría trae hasta 50 productos en window.__INITIAL_STATE__;
// recorremos todo el árbol de categorías y juntamos los productos sin repetir.
const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const slug = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const PROMO = /folleto|promoci|oferta|novedad|black friday|campa/i;

async function getState(url, lang) {
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "text/html", "Accept-Language": lang } });
      if (r.ok) {
        const html = await r.text();
        const m = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
        if (m) return JSON.parse(m[1]);
      } else if (r.status === 404) return null;
    } catch (e) { /* reintento */ }
    await sleep(1500 * i);
  }
  return null;
}

function toProduct(e, chain, base) {
  const amount = Number(e.price?.current?.amount);
  if (!amount) return null;
  const was = Number(e.price?.was?.amount || e.price?.previous?.amount || 0);
  const unitAmt = Number(e.price?.unit?.current?.amount || 0);
  const lab = e.price?.unit?.label || "";
  const unit = /kg/.test(lab) ? "kg" : /litre|liter|litro|\.l$/.test(lab) ? "l" : /each|unit|ud/.test(lab) ? "ud" : "";
  const path = (e.categoryPath || []).filter(c => !PROMO.test(c));
  return {
    id: chain[0] + chain[1] + e.retailerProductId,
    chain,
    name: e.name,
    brand: e.brand || "",
    desc: e.name,
    cat: path[0] || "Otros",
    sub: path[1] || path[0] || "Otros",
    img: e.image?.src || "",
    price: amount,
    prev: was > amount ? was : null,
    refPrice: unitAmt || null,
    refUnit: unit,
    ean: "",
    url: `${base}/products/${slug(e.name)}/${e.retailerProductId}`
  };
}

export function makeOcadoScraper({ chain, base, lang = "es-ES", maxPages = 1500 }) {
  return async function scrape() {
    const seenCat = new Set(), queue = [], products = new Map();
    let pages = 0, full = 0;
    const enqueue = st => {
      const cats = st?.data?.categories?.categories || {};
      for (const c of Object.values(cats)) {
        if (!c?.retailerId || seenCat.has(c.retailerId) || PROMO.test(c.name || "")) continue;
        seenCat.add(c.retailerId);
        const last = String(c.fullURLPath || c.name).split("/").pop();
        queue.push(`${base}/categories/${slug(last)}/${c.retailerId}`);
      }
    };
    const t0 = Date.now(), dbg = { samples: [] };
    const root = await getState(`${base}/categories`, lang);
    if (!root) { const e = new Error(`${chain}: no se pudo leer la página de categorías`); e.debug = dbg; throw e; }
    enqueue(root);
    dbg.rootCats = queue.slice(0, 15);
    while (queue.length && pages < maxPages && Date.now() - t0 < 20 * 60 * 1000) {
      const url = queue.shift();
      const st = await getState(url, lang);
      pages++;
      const ents = Object.values(st?.data?.products?.productEntities || {});
      if (dbg.samples.length < 12) dbg.samples.push({ url, ok: !!st, products: ents.length, cats: Object.keys(st?.data?.categories?.categories || {}).length });
      if (!st) continue;
      enqueue(st);
      if (ents.length >= 50) full++;
      for (const e of ents) {
        const p = toProduct(e, chain, base);
        if (p && !products.has(p.id)) products.set(p.id, p);
      }
      await sleep(250);
    }
    const list = [...products.values()];
    console.log(`${chain}: ${pages} páginas, ${seenCat.size} categorías, ${full} páginas llenas (pueden faltar productos)`);
    Object.assign(dbg, { pages, cats: seenCat.size, full, left: queue.length });
    if (list.length < 300) { const e = new Error(`${chain}: solo ${list.length} productos`); e.debug = dbg; throw e; }
    return { products: list, meta: { products: list.length, pages }, debug: dbg };
  };
}

export const scrapeAlcampo = makeOcadoScraper({ chain: "alcampo", base: "https://www.compraonline.alcampo.es" });
export const scrapeBonpreu = makeOcadoScraper({ chain: "bonpreu", base: "https://www.compraonline.bonpreuesclat.cat", lang: "ca-ES,es;q=0.8" });
