// Lidl: su buscador público devuelve todo el surtido (q=*), 60 artículos por página.
// Nos quedamos con alimentación, droguería y similares (los de bazar llevan categoría "Categorías/Hogar…", "Bricolaje"…).
const B = "https://www.lidl.es/q/api/search";
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Solo alimentación, frescos, bebidas y droguería; fuera bricolaje, muebles, juguetes, multimedia…
const KEEP = /^(Food|F\+V|P\+F|Alimentaci|Fruta|Salud y cuidados|El mundo del vino|Bebidas|Droguer|Frescos|Panader|Carne|Pescado|Congelad|L[aá]cteos|Despensa)/i;
const NONFOOD = /^Categorías\/(Hogar|Bricolaje|Jardín|Deporte|Moda|Bebé|Juguetes|Electr|Ocio|Cocina|Tecnolog|Herramient|Mascotas\/Accesorios|Decoraci)/i;

async function page(offset) {
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await fetch(`${B}?q=*&offset=${offset}&fetchsize=60&locale=es_ES&assortment=ES&version=2.1.0`, { signal: AbortSignal.timeout(25000) });
      if (r.ok) return await r.json();
    } catch {}
    await sleep(2000 * i);
  }
  return null;
}

function toProduct(it) {
  const d = it.gridbox?.data; if (!d) return null;
  const cat = String(d.category || "");
  const top = cat.replace(/^Categorías\//, "").split("/")[0];
  if (NONFOOD.test(cat) || !KEEP.test(top)) return null;
  if (/[»«]/.test(d.fullTitle || "") || /planta|maceta|tensi[oó]metro|afeitadora|rizador|secador|cepillo el[eé]ctrico/i.test(d.fullTitle || "")) return null;   // aparatos y plantas
  const plus = d.lidlPlus?.[0]?.price;
  const price = Number(d.price?.price) || Number(plus?.price) || 0;
  if (!price) return null;
  const old = Number(d.price?.oldPrice || d.price?.discount?.deletedPrice || 0);
  const pack = d.price?.packaging?.text || plus?.packaging?.text || "";
  const base = String(d.price?.basePrice?.text || plus?.basePrice?.text || "");
  const bm = base.match(/([\d.,]+)\s*€?\s*\/?\s*(kg|l|ud|unidad)/i) || base.match(/(kg|l)\s*=\s*([\d.,]+)/i);
  const parts = cat.replace(/^Categorías\//, "").split("/").filter(Boolean);
  const plusOnly = !Number(d.price?.price) && !!plus;
  return {
    id: "li" + (d.productId || d.erpNumber || it.code),
    chain: "lidl",
    name: String(d.fullTitle || d.title || "").replace(/®/g, "").replace(/\s+/g, " ").trim(),
    brand: d.brand?.name ? d.brand.name.replace(/®/g, "") : "",
    desc: `${d.title || ""} ${pack}`,
    cat: parts[0] === "F+V" ? "Fruta y verdura" : parts[0] === "Food" ? "Alimentación" : (parts[0] || "Alimentación"),
    sub: parts[1] || parts[0] || "",
    img: d.image || d.imageList?.[0] || "",
    price,
    prev: old > price ? old : null,
    refPrice: bm ? Number(String(bm[1].match(/\d/) ? bm[1] : bm[2]).replace(",", ".")) : null,
    refUnit: bm ? (/kg/i.test(bm[0]) ? "kg" : /\bl\b/i.test(bm[0]) ? "l" : "ud") : "",
    ean: "",
    note: plusOnly ? "Precio con Lidl Plus" : "",
    url: "https://www.lidl.es" + (d.canonicalUrl || d.canonicalPath || "")
  };
}

export async function scrapeLidl() {
  const first = await page(0);
  const total = first?.numFound || 0;
  if (!total) throw new Error("Lidl: el buscador no devolvió artículos");
  const products = new Map();
  const add = j => { for (const it of j?.items || []) { const p = toProduct(it); if (p && !products.has(p.id)) products.set(p.id, p); } };
  add(first);
  for (let off = 60; off < total && off < 12000; off += 60) { add(await page(off)); await sleep(350); }
  const list = [...products.values()];
  if (list.length < 100) throw new Error(`Lidl: solo ${list.length} productos de alimentación`);
  return { products: list, meta: { products: list.length, total } };
}
