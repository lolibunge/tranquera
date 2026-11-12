import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { isISODate, todayISO } from "./dates";
import { parseAmount } from "./number";

const money = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || ((parseAmount(v) ?? -1) >= 0 && (parseAmount(v) ?? 0) < 1e10), `Revisá ${label}.`)
    .transform((v) => (v === "" ? null : parseAmount(v)));

export const saleInput = z.object({
  animalIds: z.array(z.string().uuid()).min(1, "Elegí los animales que se venden."),
  date: z.string().refine(isISODate, "Revisá la fecha."),
  buyer: z.string().trim().min(2, "Escribí a quién se vendió.").max(120),
  intermediary: z.string().trim().max(120).optional(),
  guide: z.string().trim().max(40).optional(),
  priceMode: z.enum(["kilo", "cabeza"]),
  kilos: z
    .string()
    .trim()
    .refine((v) => v === "" || ((parseAmount(v) ?? 0) > 0 && (parseAmount(v) ?? 0) < 1e7), "Revisá los kilos.")
    .transform((v) => (v === "" ? null : parseAmount(v))),
  unitPrice: money("el precio"),
  currency: z.enum(["USD", "UYU"]),
  expenses: money("los gastos"),
  notes: z.string().trim().max(1000).optional(),
});

export async function createSale(farmId: string, userId: string, raw: z.input<typeof saleInput>) {
  const parsed = saleInput.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.date > todayISO()) return { ok: false as const, error: "La fecha no puede ser futura." };
  if (d.unitPrice === null || d.unitPrice <= 0) return { ok: false as const, error: "Poné el precio." };
  if (d.priceMode === "kilo" && !d.kilos) return { ok: false as const, error: "Para vender por kilo, poné los kilos totales." };

  const animals = await db
    .select({ id: schema.animals.id, heads: schema.animals.headCount, paddockId: schema.animals.paddockId })
    .from(schema.animals)
    .where(and(eq(schema.animals.farmId, farmId), eq(schema.animals.status, "activo"), inArray(schema.animals.id, d.animalIds)));
  if (!animals.length) return { ok: false as const, error: "Esos animales ya no están en el padrón." };
  const heads = animals.reduce((n, a) => n + a.heads, 0);
  const gross = d.priceMode === "kilo" ? (d.kilos ?? 0) * d.unitPrice : heads * d.unitPrice;

  const saleId = await db.transaction(async (tx) => {
    const [sale] = await tx
      .insert(schema.sales)
      .values({
        farmId,
        date: d.date,
        buyer: d.buyer,
        intermediary: d.intermediary || null,
        guide: d.guide || null,
        priceMode: d.priceMode,
        heads,
        kilos: d.kilos !== null ? String(d.kilos) : null,
        unitPrice: String(d.unitPrice),
        currency: d.currency,
        gross: gross.toFixed(2),
        expenses: (d.expenses ?? 0).toFixed(2),
        notes: d.notes || null,
        createdBy: userId,
      })
      .returning({ id: schema.sales.id });
    const batchId = crypto.randomUUID();
    const leaving = animals.filter((a) => a.paddockId);
    if (leaving.length) {
      await tx.insert(schema.movements).values(
        leaving.map((a) => ({ farmId, animalId: a.id, fromPaddockId: a.paddockId, toPaddockId: null, date: d.date, batchId, note: "Venta", createdBy: userId })),
      );
    }
    await tx
      .update(schema.animals)
      .set({ status: "vendido", statusDate: d.date, statusNote: d.buyer, saleId: sale.id, paddockId: null, updatedAt: new Date() })
      .where(inArray(schema.animals.id, animals.map((a) => a.id)));
    return sale.id;
  });
  return { ok: true as const, value: { id: saleId, heads, gross } };
}

export async function listSales(farmId: string) {
  return db.select().from(schema.sales).where(eq(schema.sales.farmId, farmId)).orderBy(desc(schema.sales.date), desc(schema.sales.createdAt)).limit(100);
}

export async function getSale(farmId: string, id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const [sale] = await db.select().from(schema.sales).where(and(eq(schema.sales.id, id), eq(schema.sales.farmId, farmId))).limit(1);
  if (!sale) return null;
  const animals = await db
    .select({ id: schema.animals.id, species: schema.animals.species, tagVisual: schema.animals.tagVisual, tagRfid: schema.animals.tagRfid, name: schema.animals.name, category: schema.animals.category, isLot: schema.animals.isLot, headCount: schema.animals.headCount })
    .from(schema.animals)
    .where(eq(schema.animals.saleId, id));
  return { sale, animals };
}

/** Totales del año (por moneda) para el resumen. */
export async function salesSummary(farmId: string, year: number) {
  return db
    .select({
      currency: schema.sales.currency,
      heads: sql<number>`sum(${schema.sales.heads})::int`,
      kilos: sql<number>`coalesce(sum(${schema.sales.kilos}), 0)::float`,
      gross: sql<number>`sum(${schema.sales.gross})::float`,
      expenses: sql<number>`sum(${schema.sales.expenses})::float`,
    })
    .from(schema.sales)
    .where(and(eq(schema.sales.farmId, farmId), sql`extract(year from ${schema.sales.date}) = ${year}`))
    .groupBy(schema.sales.currency);
}

export const DEATH_CAUSES = [
  { value: "enfermedad", label: "Enfermedad" },
  { value: "parto", label: "Parto o aborto" },
  { value: "accidente", label: "Accidente" },
  { value: "predador", label: "Predador o abigeato" },
  { value: "clima", label: "Clima (frío, rayo, sequía)" },
  { value: "desconocida", label: "Desconocida" },
] as const;
