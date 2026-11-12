import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { isISODate, todayISO } from "./dates";
import { parseAmount } from "./number";
import { formatTag } from "./catalogo";

export const SLOTS = [
  { key: "manana", label: "Mañana" },
  { key: "tarde", label: "Tarde" },
  { key: "noche", label: "Noche" },
] as const;
export type Slot = (typeof SLOTS)[number]["key"];
export const slotLabel = (k: string) => SLOTS.find((s) => s.key === k)?.label ?? k;
const isSlot = (v: string): v is Slot => SLOTS.some((s) => s.key === v);

export const planInput = z.object({
  animalIds: z.array(z.string().uuid()).min(1, "Elegí al menos un animal."),
  supplyId: z.string().uuid("Elegí qué come."),
  slots: z.array(z.string()).min(1, "Elegí al menos un turno."),
  quantity: z
    .string()
    .trim()
    .refine((v) => (parseAmount(v) ?? 0) > 0 && (parseAmount(v) ?? 0) < 1e5, "Revisá la cantidad.")
    .transform((v) => parseAmount(v) as number),
  notes: z.string().trim().max(200).optional(),
});

/** Agrega (o reemplaza) un insumo en la ración de uno o varios animales. En lotes, la cantidad es por cabeza. */
export async function addPlanItems(farmId: string, raw: z.input<typeof planInput>) {
  const parsed = planInput.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const slots = d.slots.filter(isSlot);
  if (!slots.length) return { ok: false as const, error: "Elegí al menos un turno." };
  const animals = await db
    .select({ id: schema.animals.id })
    .from(schema.animals)
    .where(and(inArray(schema.animals.id, d.animalIds), eq(schema.animals.farmId, farmId), eq(schema.animals.status, "activo")));
  const [s] = await db
    .select({ id: schema.supplies.id })
    .from(schema.supplies)
    .where(and(eq(schema.supplies.id, d.supplyId), eq(schema.supplies.farmId, farmId), eq(schema.supplies.active, true)))
    .limit(1);
  if (!animals.length || !s) return { ok: false as const, error: "Revisá los animales y el insumo." };
  const ids = animals.map((a) => a.id);
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.feedPlans)
      .where(and(inArray(schema.feedPlans.animalId, ids), eq(schema.feedPlans.supplyId, d.supplyId), inArray(schema.feedPlans.slot, slots)));
    await tx
      .insert(schema.feedPlans)
      .values(ids.flatMap((animalId) => slots.map((slot) => ({ farmId, animalId, supplyId: d.supplyId, slot, quantity: d.quantity, notes: d.notes || null }))));
  });
  return { ok: true as const, value: { animals: ids.length } };
}

/** Saca de la ración a varios animales (todo lo que comían). */
export async function clearPlans(farmId: string, animalIds: string[]) {
  const ids = animalIds.filter((id) => z.string().uuid().safeParse(id).success);
  if (!ids.length) return;
  await db.delete(schema.feedPlans).where(and(eq(schema.feedPlans.farmId, farmId), inArray(schema.feedPlans.animalId, ids)));
}

export async function removePlanItem(farmId: string, id: string) {
  if (!z.string().uuid().safeParse(id).success) return;
  await db.delete(schema.feedPlans).where(and(eq(schema.feedPlans.id, id), eq(schema.feedPlans.farmId, farmId)));
}

export async function animalPlan(farmId: string, animalId: string) {
  return db
    .select({ id: schema.feedPlans.id, slot: schema.feedPlans.slot, quantity: schema.feedPlans.quantity, supply: schema.supplies.name, unit: schema.supplies.unit })
    .from(schema.feedPlans)
    .innerJoin(schema.supplies, eq(schema.supplies.id, schema.feedPlans.supplyId))
    .where(and(eq(schema.feedPlans.farmId, farmId), eq(schema.feedPlans.animalId, animalId)))
    .orderBy(asc(schema.feedPlans.slot), asc(schema.supplies.name));
}

/** Todo el plan de un turno, por animal (solo animales activos). */
export async function slotPlan(farmId: string, slot: Slot, species: string) {
  const rows = await db
    .select({
      id: schema.feedPlans.id,
      animalId: schema.animals.id,
      name: schema.animals.name,
      tag: schema.animals.tagVisual,
      rfid: schema.animals.tagRfid,
      supplyId: schema.supplies.id,
      supply: schema.supplies.name,
      unit: schema.supplies.unit,
      quantity: schema.feedPlans.quantity,
      paddock: schema.paddocks.name,
      heads: schema.animals.headCount,
      isLot: schema.animals.isLot,
    })
    .from(schema.feedPlans)
    .innerJoin(schema.animals, and(eq(schema.animals.id, schema.feedPlans.animalId), eq(schema.animals.status, "activo")))
    .innerJoin(schema.supplies, and(eq(schema.supplies.id, schema.feedPlans.supplyId), eq(schema.supplies.active, true)))
    .leftJoin(schema.paddocks, eq(schema.paddocks.id, schema.animals.paddockId))
    .where(and(eq(schema.feedPlans.farmId, farmId), eq(schema.feedPlans.slot, slot), eq(schema.animals.species, species)))
    .orderBy(asc(schema.animals.name));
  const animals = new Map<string, { id: string; title: string; paddock: string | null; heads: number; items: { supplyId: string; supply: string; unit: string; quantity: number }[] }>();
  for (const r of rows) {
    const a = animals.get(r.animalId) ?? {
      id: r.animalId,
      title: (r.name ?? (r.tag ? formatTag(r.tag) : formatTag(r.rfid))) + (r.isLot ? ` · ${r.heads} cab.` : ""),
      paddock: r.paddock,
      heads: r.isLot ? r.heads : 1,
      items: [],
    };
    a.items.push({ supplyId: r.supplyId, supply: r.supply, unit: r.unit, quantity: r.quantity });
    animals.set(r.animalId, a);
  }
  return [...animals.values()];
}

/** Totales por insumo de un turno (lo que hay que preparar). */
export function totals(animals: Awaited<ReturnType<typeof slotPlan>>) {
  const map = new Map<string, { supply: string; unit: string; quantity: number }>();
  for (const a of animals)
    for (const i of a.items) {
      const t = map.get(i.supplyId) ?? { supply: i.supply, unit: i.unit, quantity: 0 };
      t.quantity += i.quantity * a.heads;
      map.set(i.supplyId, t);
    }
  return [...map.entries()].map(([id, t]) => ({ id, ...t }));
}

export async function roundsOn(farmId: string, date: string, species?: string) {
  return db
    .select()
    .from(schema.feedRounds)
    .where(and(eq(schema.feedRounds.farmId, farmId), eq(schema.feedRounds.date, date), species ? eq(schema.feedRounds.species, species) : undefined));
}

/**
 * Da la ración de un turno: descuenta del stock lo de todos menos los salteados.
 * Una vez por día y turno.
 */
export async function giveRound(farmId: string, userId: string, input: { date: string; slot: string; species: string; skip: string[] }) {
  if (!isISODate(input.date) || input.date > todayISO()) return { ok: false as const, error: "Revisá la fecha." };
  if (!isSlot(input.slot)) return { ok: false as const, error: "Elegí el turno." };
  const animals = await slotPlan(farmId, input.slot, input.species);
  const skip = new Set(input.skip);
  const fed = animals.filter((a) => !skip.has(a.id));
  if (!fed.length) return { ok: false as const, error: "No queda ningún animal para darle de comer." };
  const result = await db.transaction(async (tx) => {
    const [round] = await tx
      .insert(schema.feedRounds)
      .values({
        farmId,
        date: input.date,
        slot: input.slot,
        species: input.species,
        animals: fed.length,
        skipped: animals.filter((a) => skip.has(a.id)).map((a) => a.title).join(", ") || null,
        createdBy: userId,
      })
      .onConflictDoNothing()
      .returning({ id: schema.feedRounds.id });
    if (!round) return null;
    const sums = totals(fed);
    await tx.insert(schema.supplyMoves).values(
      sums.map((s) => ({
        farmId,
        supplyId: s.id,
        date: input.date,
        quantity: -s.quantity,
        note: `Ración ${slotLabel(input.slot).toLowerCase()} · ${fed.length} ${fed.length === 1 ? "animal" : "animales"} (${input.species})`,
        feedRoundId: round.id,
        createdBy: userId,
      })),
    );
    return { fed: fed.length };
  });
  if (!result) return { ok: false as const, error: `La ración de la ${slotLabel(input.slot).toLowerCase()} ya se dio ese día.` };
  return { ok: true as const, value: result };
}

/** Deshacer un turno: borra el registro y devuelve lo descontado al stock. */
export async function undoRound(farmId: string, id: string) {
  if (!z.string().uuid().safeParse(id).success) return;
  await db.transaction(async (tx) => {
    await tx.delete(schema.supplyMoves).where(and(eq(schema.supplyMoves.farmId, farmId), eq(schema.supplyMoves.feedRoundId, id)));
    await tx.delete(schema.feedRounds).where(and(eq(schema.feedRounds.id, id), eq(schema.feedRounds.farmId, farmId)));
  });
}

/** Especies que tienen algún animal activo con ración. */
export async function speciesWithPlans(farmId: string) {
  const rows = await db
    .selectDistinct({ species: schema.animals.species })
    .from(schema.feedPlans)
    .innerJoin(schema.animals, and(eq(schema.animals.id, schema.feedPlans.animalId), eq(schema.animals.status, "activo")))
    .where(eq(schema.feedPlans.farmId, farmId));
  return rows.map((r) => r.species);
}

/** Animales activos de una especie con lo que comen por turno (para armar la ración). */
export async function speciesPlans(farmId: string, species: string) {
  const rows = await db
    .select({
      animalId: schema.feedPlans.animalId,
      slot: schema.feedPlans.slot,
      quantity: schema.feedPlans.quantity,
      supply: schema.supplies.name,
      unit: schema.supplies.unit,
    })
    .from(schema.feedPlans)
    .innerJoin(schema.animals, and(eq(schema.animals.id, schema.feedPlans.animalId), eq(schema.animals.status, "activo"), eq(schema.animals.species, species)))
    .innerJoin(schema.supplies, eq(schema.supplies.id, schema.feedPlans.supplyId))
    .where(eq(schema.feedPlans.farmId, farmId));
  const map = new Map<string, string[]>();
  for (const r of rows) map.set(r.animalId, [...(map.get(r.animalId) ?? []), `${slotLabel(r.slot)}: ${r.quantity.toLocaleString("es-UY")} ${r.unit} ${r.supply}`]);
  return map;
}

export async function recentRounds(farmId: string) {
  return db.select().from(schema.feedRounds).where(eq(schema.feedRounds.farmId, farmId)).orderBy(desc(schema.feedRounds.date), desc(schema.feedRounds.createdAt)).limit(14);
}
