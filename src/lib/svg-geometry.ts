import type { MapShape } from "./svg-map";

// Geometría de las formas del mapa (sin dependencias: se usa también en el celular).

/** Contorno aproximado de la forma como polígono (para ubicar textos y nombres). */
export function outline(shape: MapShape): [number, number][] | null {
  const a = shape.attrs;
  const n = (v?: string) => parseFloat(v ?? "0") || 0;
  if (shape.tag === "rect") {
    const x = n(a.x), y = n(a.y), w = n(a.width), h = n(a.height);
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  }
  if (shape.tag === "circle" || shape.tag === "ellipse") {
    const cx = n(a.cx), cy = n(a.cy), rx = n(a.rx ?? a.r), ry = n(a.ry ?? a.r);
    return Array.from({ length: 16 }, (_, i) => [cx + rx * Math.cos((i / 16) * 2 * Math.PI), cy + ry * Math.sin((i / 16) * 2 * Math.PI)] as [number, number]);
  }
  if (shape.tag === "polygon" || shape.tag === "polyline") {
    const v = (a.points ?? "").trim().split(/[\s,]+/).map(Number);
    const pts: [number, number][] = [];
    for (let i = 0; i + 1 < v.length; i += 2) pts.push([v[i], v[i + 1]]);
    return pts.length >= 3 ? pts : null;
  }
  return flattenPath(a.d ?? "");
}

/** Recorre un path y se queda con los puntos finales de cada tramo (alcanza para ubicar y rotular). */
function flattenPath(d: string): [number, number][] | null {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  const pts: [number, number][] = [];
  let i = 0;
  let cmd = "";
  let x = 0, y = 0, sx = 0, sy = 0;
  const num = () => Number(tokens[i++]);
  const ARGS: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const lower = cmd.toLowerCase();
    const rel = cmd === lower;
    if (lower === "z") {
      x = sx;
      y = sy;
      if (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) i++;
      continue;
    }
    const count = ARGS[lower];
    if (count === undefined || i + count > tokens.length) break;
    const args = Array.from({ length: count }, num);
    if (args.some(Number.isNaN)) break;
    if (lower === "h") x = rel ? x + args[0] : args[0];
    else if (lower === "v") y = rel ? y + args[0] : args[0];
    else {
      const ex = args[count - 2], ey = args[count - 1];
      x = rel ? x + ex : ex;
      y = rel ? y + ey : ey;
    }
    if (lower === "m") {
      sx = x;
      sy = y;
      cmd = rel ? "l" : "L"; // los pares siguientes a un M son líneas
    }
    pts.push([x, y]);
  }
  return pts.length >= 3 ? pts : null;
}

export function pointInPolygon(px: number, py: number, poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Punto para escribir el nombre: centro del contorno. */
export function centerOf(shape: MapShape): [number, number] | null {
  const poly = outline(shape);
  if (!poly) return null;
  let cx = 0;
  let cy = 0;
  for (const [x, y] of poly) {
    cx += x;
    cy += y;
  }
  return [cx / poly.length, cy / poly.length];
}
