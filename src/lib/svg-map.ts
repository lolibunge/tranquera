import { XMLParser } from "fast-xml-parser";
import { outline, pointInPolygon } from "./svg-geometry";

/**
 * Lee el SVG del mapa que sube el usuario y se queda solo con la geometría:
 * formas (path, polygon, rect, circle, ellipse, polyline) con sus transformaciones.
 * No se guarda el SVG original: así no puede traer scripts ni enlaces.
 *
 * El nombre de cada potrero sale del id, data-name (Illustrator), inkscape:label
 * o <title> de la forma o de su grupo. Los nombres genéricos ("path12", "Capa_1") se ignoran.
 */

export type MapShape = { tag: Tag; attrs: Record<string, string>; transform: string; name: string | null; background?: boolean };
export type FarmMap = { viewBox: string; shapes: MapShape[] };

const TAGS = ["path", "polygon", "polyline", "rect", "circle", "ellipse"] as const;
type Tag = (typeof TAGS)[number];

const GEOMETRY: Record<Tag, string[]> = {
  path: ["d"],
  polygon: ["points"],
  polyline: ["points"],
  rect: ["x", "y", "width", "height", "rx", "ry"],
  circle: ["cx", "cy", "r"],
  ellipse: ["cx", "cy", "rx", "ry"],
};

const GENERIC = /^(path|rect|polygon|polyline|circle|ellipse|g|group|layer|capa|svg|shape|forma|trazado|grupo|objeto|object|_x|layer_?\d+|capa_?\d+)[\s_-]*\d*$/i;
const BACKGROUND = /^(perimetro|contorno|limite|borde|campo completo|predio|fondo|casco|camino|calle|ruta)\b/i;
const SAFE_NUMBER_LIST = /^[\d\s.,eE+\-MmLlHhVvCcSsQqTtAaZz]*$/;
const SAFE_TRANSFORM = /^[\d\s.,eE+\-()a-zA-Z]*$/;

function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // Illustrator codifica espacios y acentos: "Potrero_x5F_1" o "_x31_"
  let decoded = raw
    .replace(/_x([0-9A-F]{2,4})_/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/_+/g, " ")
    .trim();
  // Los id no admiten espacios y muchos programas los cambian por guiones: "Pista-Vieja-1" → "Pista Vieja 1".
  if (!/\s/.test(decoded) && /[\p{L}\d]-[\p{L}\d]/u.test(decoded)) decoded = decoded.replace(/-+/g, " ");
  if (!decoded || decoded.length > 60 || GENERIC.test(decoded.replace(/\s+/g, "_"))) return null;
  return decoded;
}

function textOf(node: unknown): string | null {
  if (typeof node === "string") return node;
  if (node && typeof node === "object" && "#text" in node) return String((node as Record<string, unknown>)["#text"]);
  return null;
}

function nameOf(el: Record<string, unknown>) {
  return (
    cleanName(el["@_inkscape:label"]) ??
    cleanName(el["@_data-name"]) ??
    cleanName(textOf(Array.isArray(el.title) ? el.title[0] : el.title)) ??
    cleanName(el["@_id"])
  );
}

export function parseSvgMap(text: string): { ok: true; map: FarmMap; names: string[]; fromText: number } | { ok: false; error: string } {
  if (text.length > 2_000_000) return { ok: false, error: "El mapa pesa más de 2 MB. Simplificalo o exportalo más liviano." };
  if (!/<svg[\s>]/i.test(text)) return { ok: false, error: "El archivo no parece un SVG." };
  let doc: Record<string, unknown>;
  try {
    doc = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      processEntities: false,
      allowBooleanAttributes: true,
      isArray: (name) => (TAGS as readonly string[]).includes(name) || ["g", "title", "text", "tspan"].includes(name),
    }).parse(text) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "No pudimos leer el SVG. Probá exportarlo de nuevo." };
  }
  const svg = doc.svg as Record<string, unknown> | undefined;
  if (!svg) return { ok: false, error: "El archivo no tiene un <svg>." };

  let viewBox = typeof svg["@_viewBox"] === "string" ? (svg["@_viewBox"] as string) : "";
  if (!/^[\d\s.,eE+\-]+$/.test(viewBox) || viewBox.trim().split(/[\s,]+/).length !== 4) {
    const w = parseFloat(String(svg["@_width"] ?? ""));
    const h = parseFloat(String(svg["@_height"] ?? ""));
    viewBox = w > 0 && h > 0 ? `0 0 ${w} ${h}` : "";
  }
  if (!viewBox) return { ok: false, error: "Al SVG le falta el tamaño (viewBox). Exportalo con tamaño de mesa de trabajo." };

  const shapes: MapShape[] = [];
  const texts: { chain: string; x: number; y: number; text: string }[] = [];
  const walk = (node: Record<string, unknown>, transform: string, inherited: string | null) => {
    const own = typeof node["@_transform"] === "string" && SAFE_TRANSFORM.test(node["@_transform"] as string) ? (node["@_transform"] as string) : "";
    const chain = [transform, own].filter(Boolean).join(" ");
    for (const t of (node.text as Record<string, unknown>[] | undefined) ?? []) {
      const content = collectText(t).replace(/\s+/g, " ").trim();
      if (!content || content.length > 60) continue;
      const [tx, ty] = translationOf(String(t["@_transform"] ?? ""));
      const x = parseFloat(String(t["@_x"] ?? "0").split(/[\s,]+/)[0]) || 0;
      const y = parseFloat(String(t["@_y"] ?? "0").split(/[\s,]+/)[0]) || 0;
      texts.push({ chain, x: x + tx, y: y + ty, text: content });
    }
    for (const tag of TAGS) {
      const list = node[tag] as Record<string, unknown>[] | undefined;
      for (const el of list ?? []) {
        const attrs: Record<string, string> = {};
        for (const key of GEOMETRY[tag]) {
          const value = el[`@_${key}`];
          if (typeof value === "string" && SAFE_NUMBER_LIST.test(value) && value.length < 400_000) attrs[key] = value;
        }
        if (!Object.keys(attrs).length) continue;
        const elTransform = typeof el["@_transform"] === "string" && SAFE_TRANSFORM.test(el["@_transform"] as string) ? (el["@_transform"] as string) : "";
        shapes.push({ tag, attrs, transform: [chain, elTransform].filter(Boolean).join(" "), name: nameOf(el) ?? inherited });
      }
    }
    for (const g of (node.g as Record<string, unknown>[] | undefined) ?? []) {
      // Un grupo con nombre (ej. "Potrero 3" con varias formas) le pasa el nombre a sus formas.
      const groupName = nameOf(g);
      walk(g, chain, groupName ?? inherited);
    }
  };
  walk(svg, "", null);
  if (!shapes.length) return { ok: false, error: "El SVG no tiene formas dibujadas." };
  if (shapes.length > 3000) return { ok: false, error: "El mapa tiene demasiadas formas. Simplificalo." };

  // El contorno del campo no es un potrero: queda de fondo.
  for (const shape of shapes) {
    if (shape.name && BACKGROUND.test(shape.name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) {
      shape.name = null;
      shape.background = true;
    }
  }

  // Formas sin nombre: si adentro hay un único texto (ej. "Potrero 3" escrito en el mapa), ese es su nombre.
  let fromText = 0;
  for (const shape of shapes) {
    if (shape.name || shape.background) continue;
    const poly = outline(shape);
    if (!poly) continue;
    const inside = texts.filter((t) => t.chain === shape.transform && pointInPolygon(t.x, t.y, poly));
    const label = inside.length === 1 ? cleanName(inside[0].text) : null;
    if (label) {
      shape.name = label;
      fromText++;
    }
  }

  const names = [...new Set(shapes.map((s) => s.name).filter(Boolean) as string[])];
  return { ok: true, map: { viewBox, shapes }, names, fromText };
}

function collectText(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object") return "";
  const o = node as Record<string, unknown>;
  const own = "#text" in o ? String(o["#text"]) : "";
  const spans = ((o.tspan as unknown[]) ?? []).map(collectText).join(" ");
  return `${own} ${spans}`;
}

/** Traslación de un transform simple: translate(x y) o matrix(1 0 0 1 x y) (así exporta Illustrator). */
function translationOf(transform: string): [number, number] {
  const m = transform.match(/matrix\(([^)]+)\)/);
  if (m) {
    const v = m[1].split(/[\s,]+/).map(Number);
    if (v.length === 6) return [v[4] || 0, v[5] || 0];
  }
  const t = transform.match(/translate\(([^)]+)\)/);
  if (t) {
    const v = t[1].split(/[\s,]+/).map(Number);
    return [v[0] || 0, v[1] || 0];
  }
  return [0, 0];
}

