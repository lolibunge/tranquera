/**
 * Números escritos a mano: "1.234,5", "1234.5", "2,35", "2.35", "12.500".
 * Con coma, la coma es decimal y los puntos son miles. Sin coma, un punto es
 * decimal salvo que el número tenga forma de miles (12.500, 1.250.000).
 */
export function parseAmount(raw: string): number | null {
  const v = raw.trim().replace(/\s+/g, "").replace(/^(US\$|\$|U\$S)/i, "");
  if (!v) return null;
  let normalized: string;
  if (v.includes(",")) normalized = v.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(v)) normalized = v.replace(/\./g, "");
  else normalized = v;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
