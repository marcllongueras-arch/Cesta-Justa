// Ahorramás (tienda en Salesforce Commerce Cloud): páginas de categoría con 100 productos.
const BASE = "https://www.ahorramas.com";
const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36";
const TOP = ["frescos", "alimentacion", "lacteos", "bebidas", "congelados", "limpieza", "cuidado-personal", "hogar", "bebe", "mascotas"];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ent = s => String(s || "").replace(/&aacute;/g, "á").replace(/&eacute;/g, "é").replace(/&iacute;/g, "í").replace(/&oacute;/g, "ó").replace(/&uacute;/g, "ú").replace(/&ntilde;/g, "ñ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

async function getHTML(url) {
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "text/html", "Accept-Language": "es-ES" } });
      if (r.ok) return await r.text();
      if (r.status === 404) return "";
    } catch {}
    await sleep(1500 * i);
  }
  return "";
}

function parseTiles(html, fallbackCat) {
  const out = [];
  const blocks = html.split(/<div class="product" data-pid="/).slice(1);
  for (const b of blocks) {
    const pid = b.slice(0, b.indexOf('"'));
    const gtm = b.match(/data-gtm-layer="([^"]+)"/);
    if (!gtm) continue;
    let g; try { g = JSON.parse(decodeURIComponent(gtm[1])); } catch { continue; }
    const price = Number(g.price);
    if (!price) continue;
    const href = b.match(/href="(\/[^"]+-\d+\.html)"/);
    const img = b.match(/<img[^>]+(?:data-src|src)="(https?:[^"]+)"/);
    const unit = b.match(/([\d.,]+)\s*€\s*\/\s*(kg|kilo|l|litro|ud|unidad)/i);
    const strike = b.match(/strike-through[\s\S]{0,300}?content="([\d.]+)"/);
    const cat1 = ent((b.match(/data-category1="([^"]*)"/) || [])[1]) || fallbackCat;
    const cat2 = ent((b.match(/data-category2="([^"]*)"/) || [])[1]);
    const u = unit ? unit[2].toLowerCase() : "";
    out.push({
      id: "ah" + pid,
      chain: "ahorramas",
      name: ent(g.name),
      brand: ent(g.brand || ""),
      desc: ent(g.name),
      cat: cat1, sub: cat2 || cat1,
      img: img ? img[1] : "",
      price,
      prev: strike && Number(strike[1]) > price ? Number(strike[1]) : null,
      refPrice: unit ? Number(unit[1].replace(/\./g, "").replace(",", ".")) : null,
      refUnit: u.startsWith("k") ? "kg" : u.startsWith("l") ? "l" : u ? "ud" : "",
      ean: "",
      url: href ? BASE + href[1] : ""
    });
  }
  return out;
}

export async function scrapeAhorramas() {
  const products = new Map();
  for (const top of TOP) {
    for (let start = 0; start < 6000; start += 100) {
      const html = await getHTML(`${BASE}/${top}/?start=${start}&sz=100`);
      const tiles = parseTiles(html, top);
      for (const p of tiles) if (!products.has(p.id)) products.set(p.id, p);
      if (tiles.length < 100) break;
      await sleep(400);
    }
  }
  const list = [...products.values()];
  if (list.length < 500) throw new Error(`Ahorramás: solo ${list.length} productos`);
  return { products: list, meta: { products: list.length } };
}
