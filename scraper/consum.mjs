// Catálogo de la tienda online de Consum (API pública de tienda.consum.es).
const BASE = "https://tienda.consum.es/api/rest/V1.0";
const HEADERS = { "Accept": "application/json", "User-Agent": "CestaJusta/1.0 (uso personal)", "Accept-Language": "es-ES" };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJSON(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(25000) });
      if (r.ok) return await r.json();
      console.warn(`Consum HTTP ${r.status} (intento ${i}) ${url}`);
    } catch (e) { console.warn(`Consum red (intento ${i}): ${e.message}`); }
    await sleep(2000 * i);
  }
  throw new Error("No se pudo descargar " + url);
}

// Árbol de categorías: id de cualquier nivel → [categoría principal, subcategoría]
async function categoryMap() {
  const tree = await getJSON(`${BASE}/shopping/category/menu`);
  const map = new Map();
  const walk = (nodes, top, sub, depth) => {
    for (const n of nodes || []) {
      const t = depth === 0 ? n.name : top;
      const s = depth === 1 ? n.name : sub;
      map.set(n.id, [t, s || t]);
      walk(n.subcategories, t, s, depth + 1);
    }
  };
  walk(tree, null, null, 0);
  return map;
}

export async function scrapeConsum() {
  const cats = await categoryMap();
  const seen = new Map();
  const LIMIT = 100;
  let offset = 0, total = Infinity;
  while (offset < total) {
    const d = await getJSON(`${BASE}/catalog/product?limit=${LIMIT}&offset=${offset}&orderById=5`);
    total = d.totalCount ?? 0;
    for (const p of d.products || []) {
      const pd = p.productData || {}, pr = p.priceData || {};
      const vals = (pr.prices || []).map(x => ({ id: x.id, v: x.value?.centAmount, u: x.value?.centUnitAmount }));
      const base = vals.find(x => x.id === "PRICE") || vals[0];
      if (!base || base.v == null) continue;
      const best = vals.reduce((a, b) => (b.v != null && b.v < a.v ? b : a), base);
      const leaf = (p.categories || [])[0];
      const [cat, sub] = (leaf && cats.get(leaf.id)) || ["Otros", leaf?.name || "Otros"];
      seen.set("c" + p.id, {
        id: "c" + p.id,
        chain: "consum",
        name: pd.name,
        brand: pd.brand?.name || "",
        desc: pd.description || "",
        cat, sub,
        img: pd.imageURL || "",
        price: best.v,
        prev: best.v < base.v ? base.v : null,
        refPrice: best.u ?? null,
        refUnit: pr.unitPriceUnitType || "",
        ean: p.ean || "",
        url: pd.url || ""
      });
    }
    offset += LIMIT;
    if (!(d.products || []).length) break;
    await sleep(300);
  }
  const products = [...seen.values()];
  if (products.length < 1000) throw new Error(`Consum: solo ${products.length} productos.`);
  return { products, meta: { products: products.length } };
}
