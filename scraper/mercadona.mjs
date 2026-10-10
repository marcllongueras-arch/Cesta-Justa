// Catálogo de la tienda online de Mercadona (API interna de tienda.mercadona.es).

const BASE = "https://tienda.mercadona.es/api";
let WH = process.env.WH || "";          // código de almacén, si ya se conoce
const HEADERS = { "Accept": "application/json", "User-Agent": "CestaJusta/1.0 (uso personal)" };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJSON(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: HEADERS });
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
      console.warn(`HTTP ${r.status} en ${url} (intento ${i})`);
    } catch (e) { console.warn(`Error de red en ${url} (intento ${i}): ${e.message}`); }
    await sleep(1500 * i);
  }
  throw new Error("No se pudo descargar " + url);
}

// Pide a la web el almacén que corresponde a un código postal (cabecera x-customer-wh).
async function warehouseForCP(cp) {
  try {
    const r = await fetch(`${BASE}/postal-codes/actions/change-pc/`, {
      method: "PUT",
      headers: { ...HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ new_postal_code: cp })
    });
    const wh = r.headers.get("x-customer-wh");
    console.log(`CP ${cp} → almacén ${wh || "(no indicado)"} [HTTP ${r.status}]`);
    return wh || "";
  } catch (e) { console.warn("No se pudo resolver el almacén:", e.message); return ""; }
}

const num = v => (v == null || v === "") ? null : Number(String(v).replace(",", "."));

function toProduct(p, cat, sub) {
  const pi = p.price_instructions || {};
  const price = num(pi.unit_price) ?? num(pi.bulk_price);
  if (price == null || isNaN(price)) return null;
  const prev = num(pi.previous_unit_price);
  const ref = num(pi.reference_price);
  return {
    id: "m" + p.id,
    chain: "mercadona",
    name: p.display_name,
    brand: "",
    desc: [p.packaging, pi.unit_size && pi.size_format ? `${pi.unit_size} ${pi.size_format}` : ""].filter(Boolean).join(" "),
    cat, sub,
    img: p.thumbnail || "",
    price,
    prev: prev && prev > price ? prev : null,
    refPrice: ref,
    refUnit: pi.reference_format || "",
    ean: "",
    url: p.share_url || `https://tienda.mercadona.es/product/${p.id}`
  };
}

export async function scrapeMercadona(cp = process.env.CP || "") {
  if (!WH && cp) WH = await warehouseForCP(cp);
  const q = `lang=es${WH ? "&wh=" + WH : ""}`;

  const root = await getJSON(`${BASE}/categories/?${q}`);
  const groups = root?.results || [];
  if (!groups.length) throw new Error("La lista de categorías vino vacía: puede que la web haya cambiado.");

  const seen = new Map();
  for (const g of groups) {
    for (const c of g.categories || []) {
      const data = await getJSON(`${BASE}/categories/${c.id}/?${q}`);
      for (const block of data?.categories || []) {
        for (const p of block.products || []) {
          const prod = toProduct(p, g.name, c.name);
          if (prod && !seen.has(prod.id)) seen.set(prod.id, prod);
        }
      }
      await sleep(250);
    }
  }
  const products = [...seen.values()];
  if (products.length < 500) throw new Error(`Mercadona: solo ${products.length} productos.`);
  return { products, meta: { products: products.length, warehouse: WH || "por defecto", cp: cp || null } };
}
