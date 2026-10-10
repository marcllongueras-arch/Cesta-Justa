// Normaliza tamaños (kg, l, ud) y precio por unidad para poder comparar entre cadenas.
const UNITS = {
  kg: ["kg", 1], g: ["kg", 0.001], gr: ["kg", 0.001], grs: ["kg", 0.001], mg: ["kg", 1e-6],
  l: ["l", 1], lt: ["l", 1], litro: ["l", 1], litros: ["l", 1], cl: ["l", 0.01], ml: ["l", 0.001],
  ud: ["ud", 1], uds: ["ud", 1], u: ["ud", 1], unidad: ["ud", 1], unidades: ["ud", 1], dz: ["ud", 12], docena: ["ud", 12],
  lavados: ["ud", 1], rollos: ["ud", 1], bolsitas: ["ud", 1], capsulas: ["ud", 1], "cápsulas": ["ud", 1]
};
const RE = /(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|grs?|g|mg|litros?|lt|l|cl|ml|uds?|u|unidades|unidad|dz|docena|lavados|rollos|bolsitas|c[aá]psulas)(?![a-záéíóú])/gi;

export function parseSize(text) {
  if (!text) return null;
  text = String(text).replace(/(?:1\/2|media)\s*docena/gi, "6 ud").replace(/(\d+)\s*docenas?/gi, (_, n) => `${n * 12} ud`);
  let m, last = null;
  RE.lastIndex = 0;
  while ((m = RE.exec(text))) last = m;
  if (!last) return null;
  const mult = last[1] ? Number(last[1]) : 1;
  const n = Number(last[2].replace(",", "."));
  const [unit, f] = UNITS[last[3].toLowerCase()] || [];
  if (!unit || !n) return null;
  return { qty: +(mult * n * f).toFixed(4), unit };
}

const fmtQty = (q, u) => {
  if (u === "kg") return q < 1 ? `${Math.round(q * 1000)} g` : `${String(+q.toFixed(3)).replace(".", ",")} kg`;
  if (u === "l") return q < 1 ? `${Math.round(q * 1000)} ml` : `${String(+q.toFixed(3)).replace(".", ",")} L`;
  return `${+q.toFixed(2)} ud`;
};

export function normalize(p) {
  const s = parseSize(p.desc) || parseSize(p.name);
  const out = { ...p };
  if (s) {
    out.qty = s.qty; out.unit = s.unit; out.size = fmtQty(s.qty, s.unit);
    out.unitPrice = +(p.price / s.qty).toFixed(3);   // €/kg, €/l o €/ud
  } else {
    out.size = ""; out.unitPrice = p.refPrice ?? null;
    const ru = (p.refUnit || "").toLowerCase().replace(/^1\s*/, "");
    out.unit = UNITS[ru]?.[0] || null;
  }
  delete out.desc;
  if (!out.prev) delete out.prev;
  if (!out.ean) delete out.ean;
  if (!out.brand) delete out.brand;
  delete out.refPrice; delete out.refUnit;
  return out;
}
