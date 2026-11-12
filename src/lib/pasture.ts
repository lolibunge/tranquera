import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { addDays, isISODate, todayISO } from "./dates";
import { parseAmount } from "./number";

export const WORK_KINDS = [
  { value: "siembra", label: "Siembra", days: 60 },
  { value: "resiembra", label: "Resiembra o intersiembra", days: 45 },
  { value: "fertilizacion", label: "Fertilización", days: 15 },
  { value: "herbicida", label: "Herbicida", days: 21 },
  { value: "corte", label: "Rotativa o corte", days: 20 },
  { value: "enfardado", label: "Enfardado", days: 30 },
  { value: "laboreo", label: "Laboreo de suelo", days: 0 },
  { value: "otro", label: "Otro", days: 0 },
] as const;
export const workLabel = (k: string) => WORK_KINDS.find((w) => w.value === k)?.label ?? k;

export const workInput = z.object({
  paddockId: z.string().uuid(),
  kind: z.string().trim().min(1, "Elegí qué se hizo.").max(40),
  date: z.string().refine(isISODate, "Revisá la fecha."),
  readyOn: z.string().optional(),
  doneBy: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function recordWork(farmId: string, userId: string, raw: z.input<typeof workInput>) {
  const parsed = workInput.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.date > todayISO()) return { ok: false as const, error: "La fecha no puede ser futura." };
  if (d.readyOn && (!isISODate(d.readyOn) || d.readyOn < d.date)) return { ok: false as const, error: "Pronto para pastorear tiene que ser después del laboreo." };
  const [p] = await db
    .select({ id: schema.paddocks.id })
    .from(schema.paddocks)
    .where(and(eq(schema.paddocks.id, d.paddockId), eq(schema.paddocks.farmId, farmId)))
    .limit(1);
  if (!p) return { ok: false as const, error: "Ese potrero no existe." };
  await db.insert(schema.fieldWorks).values({
    farmId,
    paddockId: d.paddockId,
    kind: d.kind,
    date: d.date,
    readyOn: d.readyOn || null,
    doneBy: d.doneBy || null,
    notes: d.notes || null,
    createdBy: userId,
  });
  return { ok: true as const };
}

export function suggestedReady(kind: string, date: string) {
  const days = WORK_KINDS.find((w) => w.value === kind)?.days ?? 0;
  return days ? addDays(date, days) : "";
}

export async function paddockWorks(farmId: string, paddockId: string) {
  return db
    .select()
    .from(schema.fieldWorks)
    .where(and(eq(schema.fieldWorks.farmId, farmId), eq(schema.fieldWorks.paddockId, paddockId)))
    .orderBy(desc(schema.fieldWorks.date), desc(schema.fieldWorks.createdAt))
    .limit(50);
}

export async function deleteWork(farmId: string, id: string) {
  if (!z.string().uuid().safeParse(id).success) return;
  await db.delete(schema.fieldWorks).where(and(eq(schema.fieldWorks.id, id), eq(schema.fieldWorks.farmId, farmId)));
}

/**
 * Medición con el cuadro: muestras en gramos (verde o seco), área del cuadro y % de materia seca.
 * kg MS/ha = gramos promedio × (10.000 / área m²) / 1000 × (MS% / 100 si se pesó verde).
 */
export function kgDmPerHa(samples: number[], areaM2: number, mode: "verde" | "seco", dmPct: number | null) {
  if (!samples.length || !(areaM2 > 0)) return null;
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const kgHa = (avg * (10_000 / areaM2)) / 1000;
  if (mode === "seco") return Math.round(kgHa);
  if (!dmPct || !(dmPct > 0 && dmPct <= 100)) return null;
  return Math.round(kgHa * (dmPct / 100));
}

export const readingInput = z.object({
  paddockId: z.string().uuid(),
  date: z.string().refine(isISODate, "Revisá la fecha."),
  direct: z.string().trim().optional(),
  samples: z.string().trim().optional(),
  areaM2: z.string().trim().optional(),
  mode: z.enum(["verde", "seco"]).optional(),
  dmPct: z.string().trim().optional(),
  height: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function recordReading(farmId: string, userId: string, raw: z.input<typeof readingInput>) {
  const parsed = readingInput.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.date > todayISO()) return { ok: false as const, error: "La fecha no puede ser futura." };
  const samples = (d.samples ?? "")
    .split(/[\s;]+|,(?=\s)/)
    .map((x) => parseAmount(x))
    .filter((x): x is number => x !== null && x > 0);
  let kg = d.direct ? parseAmount(d.direct) : null;
  let detail: Record<string, unknown> | null = null;
  if (kg === null && samples.length) {
    const area = parseAmount(d.areaM2 ?? "") ?? 1;
    const mode = d.mode ?? "verde";
    const dm = parseAmount(d.dmPct ?? "");
    kg = kgDmPerHa(samples, area, mode, dm);
    if (kg === null) return { ok: false as const, error: "Si pesaste en verde, poné el % de materia seca." };
    detail = { muestras: samples, area_m2: area, modo: mode, ms_pct: dm, altura: d.height || null };
  }
  if (kg === null || !(kg >= 0 && kg < 30_000)) return { ok: false as const, error: "Poné los kg de MS/ha o los gramos de las muestras." };
  const [p] = await db
    .select({ id: schema.paddocks.id })
    .from(schema.paddocks)
    .where(and(eq(schema.paddocks.id, d.paddockId), eq(schema.paddocks.farmId, farmId)))
    .limit(1);
  if (!p) return { ok: false as const, error: "Ese potrero no existe." };
  await db.insert(schema.pastureReadings).values({
    farmId,
    paddockId: d.paddockId,
    date: d.date,
    kgDmHa: kg,
    detail: detail ? JSON.stringify(detail) : d.height ? JSON.stringify({ altura: d.height }) : null,
    notes: d.notes || null,
    createdBy: userId,
  });
  return { ok: true as const, value: { kg } };
}

export async function paddockReadings(farmId: string, paddockId: string) {
  return db
    .select()
    .from(schema.pastureReadings)
    .where(and(eq(schema.pastureReadings.farmId, farmId), eq(schema.pastureReadings.paddockId, paddockId)))
    .orderBy(desc(schema.pastureReadings.date), desc(schema.pastureReadings.createdAt))
    .limit(50);
}

export async function deleteReading(farmId: string, id: string) {
  if (!z.string().uuid().safeParse(id).success) return;
  await db.delete(schema.pastureReadings).where(and(eq(schema.pastureReadings.id, id), eq(schema.pastureReadings.farmId, farmId)));
}
