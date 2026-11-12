import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { isISODate, todayISO } from "./dates";
import { parseAmount } from "./number";

export const SUPPLY_CATEGORIES = [
  { key: "medicamentos", label: "Vacunas y remedios" },
  { key: "alimento", label: "Ración y fardos" },
  { key: "sales", label: "Sales y minerales" },
  { key: "semillas", label: "Semillas" },
  { key: "fertilizantes", label: "Fertilizantes y agroquímicos" },
  { key: "combustible", label: "Combustible" },
  { key: "otros", label: "Otros" },
] as const;
export const SUPPLY_UNITS = ["dosis", "ml", "l", "kg", "bolsa", "fardo", "unidad"] as const;

export function categoryLabel(key: string) {
  return SUPPLY_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

/** Muestra cantidades sin decimales de más: 12, 12,5, 0,25. */
export function formatQty(n: number) {
  return n.toLocaleString("es-UY", { maximumFractionDigits: 2 });
}

const qty = (msg: string) =>
  z
    .string()
    .trim()
    .refine((v) => (parseAmount(v) ?? 0) > 0 && (parseAmount(v) ?? 0) < 1e8, msg)
    .transform((v) => parseAmount(v) as number);

export const supplyInput = z.object({
  name: z.string().trim().min(2, "Escribí el nombre.").max(80),
  category: z.enum(SUPPLY_CATEGORIES.map((c) => c.key) as [string, ...string[]], { message: "Elegí la categoría." }),
  unit: z.string().trim().min(1, "Elegí la unidad.").max(20),
  minimum: z
    .string()
    .trim()
    .refine((v) => v === "" || (parseAmount(v) ?? -1) >= 0, "Revisá el mínimo.")
    .transform((v) => (v === "" ? null : parseAmount(v))),
  initial: z
    .string()
    .trim()
    .refine((v) => v === "" || (parseAmount(v) ?? -1) >= 0, "Revisá la cantidad inicial.")
    .transform((v) => (v === "" ? null : parseAmount(v))),
  notes: z.string().trim().max(500).optional(),
});

export async function createSupply(farmId: string, userId: string, raw: z.input<typeof supplyInput>) {
  const parsed = supplyInput.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const [dup] = await db
    .select({ id: schema.supplies.id })
    .from(schema.supplies)
    .where(and(eq(schema.supplies.farmId, farmId), sql`lower(${schema.supplies.name}) = lower(${d.name})`))
    .limit(1);
  if (dup) return { ok: false as const, error: "Ya hay un insumo con ese nombre." };
  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(schema.supplies)
      .values({ farmId, name: d.name, category: d.category, unit: d.unit, minimum: d.minimum, notes: d.notes || null })
      .returning({ id: schema.supplies.id });
    if (d.initial) {
      await tx.insert(schema.supplyMoves).values({ farmId, supplyId: row.id, date: todayISO(), quantity: d.initial, note: "Stock inicial", createdBy: userId });
    }
    return row.id;
  });
  return { ok: true as const, value: { id } };
}

export async function updateSupply(farmId: string, id: string, raw: Omit<z.input<typeof supplyInput>, "initial">) {
  const parsed = supplyInput.safeParse({ ...raw, initial: "" });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const [dup] = await db
    .select({ id: schema.supplies.id })
    .from(schema.supplies)
    .where(and(eq(schema.supplies.farmId, farmId), sql`lower(${schema.supplies.name}) = lower(${d.name})`, sql`${schema.supplies.id} <> ${id}`))
    .limit(1);
  if (dup) return { ok: false as const, error: "Ya hay un insumo con ese nombre." };
  await db
    .update(schema.supplies)
    .set({ name: d.name, category: d.category, unit: d.unit, minimum: d.minimum, notes: d.notes || null, updatedAt: new Date() })
    .where(and(eq(schema.supplies.id, id), eq(schema.supplies.farmId, farmId)));
  return { ok: true as const, value: { id } };
}

export async function archiveSupply(farmId: string, id: string) {
  await db
    .update(schema.supplies)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(schema.supplies.id, id), eq(schema.supplies.farmId, farmId)));
}

const balance = sql<number>`coalesce((select sum(m.cantidad) from insumos_movimientos m where m.insumo_id = ${schema.supplies.id}), 0)`.mapWith(Number);

export type SupplyRow = Awaited<ReturnType<typeof listSupplies>>[number];

export async function listSupplies(farmId: string) {
  const rows = await db
    .select({
      id: schema.supplies.id,
      name: schema.supplies.name,
      category: schema.supplies.category,
      unit: schema.supplies.unit,
      minimum: schema.supplies.minimum,
      stock: balance,
    })
    .from(schema.supplies)
    .where(and(eq(schema.supplies.farmId, farmId), eq(schema.supplies.active, true)))
    .orderBy(asc(schema.supplies.name));
  return rows.map((r) => ({ ...r, low: r.minimum !== null && r.stock <= r.minimum, empty: r.stock <= 0 }));
}

export async function lowSupplies(farmId: string) {
  return (await listSupplies(farmId)).filter((s) => s.low);
}

export async function getSupply(farmId: string, id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const [row] = await db
    .select({
      id: schema.supplies.id,
      name: schema.supplies.name,
      category: schema.supplies.category,
      unit: schema.supplies.unit,
      minimum: schema.supplies.minimum,
      notes: schema.supplies.notes,
      active: schema.supplies.active,
      stock: balance,
    })
    .from(schema.supplies)
    .where(and(eq(schema.supplies.id, id), eq(schema.supplies.farmId, farmId)))
    .limit(1);
  return row ?? null;
}

export async function supplyMoves(farmId: string, supplyId: string) {
  return db
    .select({
      id: schema.supplyMoves.id,
      date: schema.supplyMoves.date,
      quantity: schema.supplyMoves.quantity,
      unitCost: schema.supplyMoves.unitCost,
      currency: schema.supplyMoves.currency,
      note: schema.supplyMoves.note,
      sessionId: schema.supplyMoves.sessionId,
      sessionLabel: schema.healthSessions.label,
    })
    .from(schema.supplyMoves)
    .leftJoin(schema.healthSessions, eq(schema.healthSessions.id, schema.supplyMoves.sessionId))
    .where(and(eq(schema.supplyMoves.farmId, farmId), eq(schema.supplyMoves.supplyId, supplyId)))
    .orderBy(desc(schema.supplyMoves.date), desc(schema.supplyMoves.createdAt))
    .limit(200);
}

export const moveInput = z.object({
  supplyId: z.string().uuid("Elegí el insumo."),
  kind: z.enum(["entrada", "consumo", "ajuste"]),
  quantity: qty("Revisá la cantidad."),
  date: z.string().refine(isISODate, "Revisá la fecha."),
  unitCost: z
    .string()
    .trim()
    .refine((v) => v === "" || (parseAmount(v) ?? -1) >= 0, "Revisá el costo.")
    .transform((v) => (v === "" ? null : parseAmount(v))),
  currency: z.enum(["USD", "UYU"]),
  note: z.string().trim().max(200).optional(),
  sessionId: z.string().uuid().optional().nullable(),
});

/**
 * Registra una entrada (compra), un consumo o un ajuste por recuento.
 * El ajuste recibe la cantidad que hay contada y guarda la diferencia.
 */
export async function recordSupplyMove(farmId: string, userId: string, raw: z.input<typeof moveInput>) {
  const parsed = moveInput.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.date > todayISO()) return { ok: false as const, error: "La fecha no puede ser futura." };
  const supply = await getSupply(farmId, d.supplyId);
  if (!supply || !supply.active) return { ok: false as const, error: "Ese insumo no existe." };
  let quantity = d.kind === "consumo" ? -d.quantity : d.quantity;
  if (d.kind === "ajuste") {
    quantity = d.quantity - supply.stock;
    if (quantity === 0) return { ok: true as const, value: { id: supply.id } };
  }
  await db.insert(schema.supplyMoves).values({
    farmId,
    supplyId: supply.id,
    date: d.date,
    quantity,
    unitCost: d.kind === "entrada" && d.unitCost !== null ? String(d.unitCost) : null,
    currency: d.kind === "entrada" && d.unitCost !== null ? d.currency : null,
    note: d.note || (d.kind === "ajuste" ? "Ajuste por recuento" : null),
    sessionId: d.sessionId ?? null,
    createdBy: userId,
  });
  return { ok: true as const, value: { id: supply.id } };
}

export async function deleteSupplyMove(farmId: string, moveId: string) {
  if (!z.string().uuid().safeParse(moveId).success) return;
  await db.delete(schema.supplyMoves).where(and(eq(schema.supplyMoves.id, moveId), eq(schema.supplyMoves.farmId, farmId)));
}

/** Insumos para elegir en un formulario (por ejemplo, al abrir una jornada de manga). */
export async function supplyOptions(farmId: string, category?: string) {
  const rows = await listSupplies(farmId);
  return rows
    .filter((r) => !category || r.category === category)
    .map((r) => ({ id: r.id, name: r.name, unit: r.unit, stock: r.stock }));
}

/** Consumos ya descontados para una jornada. */
export async function sessionSupplyUse(farmId: string, sessionId: string) {
  return db
    .select({ id: schema.supplyMoves.id, quantity: schema.supplyMoves.quantity, name: schema.supplies.name, unit: schema.supplies.unit })
    .from(schema.supplyMoves)
    .innerJoin(schema.supplies, eq(schema.supplies.id, schema.supplyMoves.supplyId))
    .where(and(eq(schema.supplyMoves.farmId, farmId), eq(schema.supplyMoves.sessionId, sessionId)));
}
