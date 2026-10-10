// Alcampo y Bonpreu/Esclat usan la misma plataforma de tienda online (Ocado).
// Tienen un control antirrobots que, tras unas pocas peticiones, pide resolver una prueba en JavaScript.
// Por eso aquí se usa un Chrome automático (Playwright): resuelve la prueba solo y leemos
// window.__INITIAL_STATE__ de cada página de categoría (hasta 50 productos por página).
import { chromium } from "playwright";

const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const slug = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const PROMO = /folleto|promoci|oferta|ofert|novedad|novetat|black friday|campa|castanyada|lots|looney|halloween|navidad|nadal/i;

function toProduct(e, chain, base) {
  const amount = Number(e.price?.current?.amount);
  if (!amount) return null;
  const was = Number(e.price?.was?.amount || e.price?.previous?.amount || 0);
  const unitAmt = Number(e.price?.unit?.current?.amount || 0);
  const lab = String(e.price?.unit?.label || "");
  const unit = /kg|kilo/.test(lab) ? "kg" : /litre|liter|litro|\.l$|\.lt/.test(lab) ? "l" : /each|unit|ud|unitat/.test(lab) ? "ud" : "";
  const path = (e.categoryPath || []).filter(c => !PROMO.test(c));
  return {
    id: chain.slice(0, 2) + e.retailerProductId,
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

export function makeOcadoScraper({ chain, base, locale = "es-ES", idField = "retailerId", maxPages = 600, minutes = 22 }) {
  return async function scrape() {
    const t0 = Date.now(), dbg = { samples: [] };
    const browser = await chromium.launch({ args: ["--no-sandbox"] });
    try {
      const ctx = await browser.newContext({ userAgent: UA, locale, viewport: { width: 412, height: 900 } });
      await ctx.route(/\.(png|jpe?g|webp|gif|svg|woff2?|mp4)(\?|$)/i, r => r.abort());   // sin imágenes: más rápido
      const page = await ctx.newPage();
      async function getState(url) {
        for (let i = 1; i <= 2; i++) {
          try {
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
            // si sale la prueba antirrobots, la página se recarga sola al resolverla
            await page.waitForFunction(() => window.__INITIAL_STATE__ && window.__INITIAL_STATE__.data, null, { timeout: 30000 });
            return await page.evaluate(() => ({ data: { categories: window.__INITIAL_STATE__.data.categories, products: { productEntities: window.__INITIAL_STATE__.data.products?.productEntities || {} } } }));
          } catch (e) { dbg.lastError = e.message.slice(0, 200); await sleep(3000 * i); }
        }
        return null;
      }
      const seenCat = new Set(), queue = [], products = new Map();
      let pages = 0, full = 0;
      const enqueue = st => {
        const cats = st?.data?.categories?.categories || {};
        for (const c of Object.values(cats)) {
          const id = c?.[idField];
          if (!id || seenCat.has(id) || PROMO.test(c.name || "") || PROMO.test(c.fullURLPath || "")) continue;
          seenCat.add(id);
          queue.push(`${base}/categories/${slug(String(c.fullURLPath || c.name).split("/").pop())}/${id}`);
        }
      };
      const root = await getState(`${base}/categories`);
      if (!root) { const e = new Error(`${chain}: no se pudo abrir la página de categorías`); e.debug = dbg; throw e; }
      enqueue(root);
      dbg.rootCats = queue.slice(0, 8);
      while (queue.length && pages < maxPages && Date.now() - t0 < minutes * 60 * 1000) {
        const url = queue.shift();
        const st = await getState(url);
        pages++;
        const ents = Object.values(st?.data?.products?.productEntities || {});
        if (dbg.samples.length < 8) dbg.samples.push({ url, ok: !!st, products: ents.length });
        if (!st) continue;
        enqueue(st);
        if (ents.length >= 50) full++;
        for (const e of ents) {
          const p = toProduct(e, chain, base);
          if (p && !products.has(p.id)) products.set(p.id, p);
        }
        await sleep(600);
      }
      const list = [...products.values()];
      Object.assign(dbg, { pages, cats: seenCat.size, full, left: queue.length });
      console.log(`${chain}: ${pages} páginas, ${seenCat.size} categorías, ${list.length} productos`);
      if (list.length < 300) { const e = new Error(`${chain}: solo ${list.length} productos`); e.debug = dbg; throw e; }
      return { products: list, meta: { products: list.length, pages }, debug: dbg };
    } finally {
      await browser.close().catch(() => {});
    }
  };
}

export const scrapeAlcampo = makeOcadoScraper({ chain: "alcampo", base: "https://www.compraonline.alcampo.es", idField: "retailerId" });
export const scrapeBonpreu = makeOcadoScraper({ chain: "bonpreu", base: "https://www.compraonline.bonpreuesclat.cat", locale: "ca-ES", idField: "id" });
