import "server-only";
import { and, asc, desc, eq, isNull, lte, or, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { addDays, isISODate, todayISO } from "./dates";
import { parseAmount } from "./number";
import { addMoney, type Money } from "./owners";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const monthName = (period: string) => `${MONTHS[Number(period.slice(5, 7)) - 1]} ${period.slice(0, 4)}`;

const amount = z
  .string()
  .trim()
  .refine((v) => (parseAmount(v) ?? 0) > 0 && (parseAmount(v) ?? 0) < 1e10, "Revisá el monto.")
  .transform((v) => parseAmount(v) as number);

export const entryInput = z.object({
  ownerId: z.string().uuid(),
  kind: z.enum(["cargo", "pago"]),
  date: z.string().refine(isISODate, "Revisá la fecha."),
  amount,
  currency: z.enum(["USD", "UYU"]),
  concept: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
  animalId: z.string().uuid().optional().nullable(),
});

async function ownerOf(farmId: string, ownerId: string) {
  const [o] = await db
    .select({ id: schema.owners.id, kind: schema.owners.kind, name: schema.owners.name })
    .from(schema.owners)
    .where(and(eq(schema.owners.id, ownerId), eq(schema.owners.farmId, farmId), eq(schema.owners.active, true)))
    .limit(1);
  return o ?? null;
}

export async function addEntry(farmId: string, userId: string, raw: z.input<typeof entryInput>) {
  const parsed = entryInput.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.date > todayISO()) return { ok: false as const, error: "La fecha no puede ser futura." };
  if (!(await ownerOf(farmId, d.ownerId))) return { ok: false as const, error: "Ese propietario no existe." };
  await db.insert(schema.ledger).values({
    farmId,
    ownerId: d.ownerId,
    kind: d.kind,
    date: d.date,
    amount: d.amount.toFixed(2),
    currency: d.currency,
    concept: d.concept || (d.kind === "pago" ? "Pago" : "Cargo"),
    notes: d.notes || null,
    animalId: d.animalId ?? null,
    createdBy: userId,
  });
  return { ok: true as const };
}

export async function deleteEntry(farmId: string, id: string) {
  if (!z.string().uuid().safeParse(id).success) return;
  await db.delete(schema.ledger).where(and(eq(schema.ledger.id, id), eq(schema.ledger.farmId, farmId)));
}

/** Movimientos con saldo acumulado por moneda (lo más nuevo primero). */
export async function ownerLedger(farmId: string, ownerId: string) {
  const rows = await db
    .select({
      id: schema.ledger.id,
      kind: schema.ledger.kind,
      date: schema.ledger.date,
      amount: schema.ledger.amount,
      currency: schema.ledger.currency,
      concept: schema.ledger.concept,
      notes: schema.ledger.notes,
      period: schema.ledger.period,
      animalName: schema.animals.name,
    })
    .from(schema.ledger)
    .leftJoin(schema.animals, eq(schema.animals.id, schema.ledger.animalId))
    .where(and(eq(schema.ledger.farmId, farmId), eq(schema.ledger.ownerId, ownerId)))
    .orderBy(asc(schema.ledger.date), asc(schema.ledger.createdAt));
  const running: Money = {};
  const withBalance = rows.map((r) => {
    addMoney(running, r.currency, r.kind === "pago" ? -Number(r.amount) : Number(r.amount));
    return { ...r, balance: running[r.currency === "USD" ? "USD" : "UYU"] ?? 0 };
  });
  return { entries: withBalance.reverse(), balance: running };
}

/** Saldo de todos los propietarios (positivo: le deben al campo). */
export async function balances(farmId: string) {
  const rows = await db
    .select({
      ownerId: schema.ledger.ownerId,
      currency: schema.ledger.currency,
      total: sql<number>`sum(case when ${schema.ledger.kind} = 'pago' then -${schema.ledger.amount} else ${schema.ledger.amount} end)::float`,
    })
    .from(schema.ledger)
    .where(eq(schema.ledger.farmId, farmId))
    .groupBy(schema.ledger.ownerId, schema.ledger.currency);
  const map = new Map<string, Money>();
  for (const r of rows) {
    if (Math.abs(r.total) < 0.005) continue;
    map.set(r.ownerId, addMoney(map.get(r.ownerId) ?? {}, r.currency, r.total));
  }
  return map;
}

// ---------- tarifas de pensión ----------

export const rateInput = z.object({
  ownerId: z.string().uuid(),
  animalId: z.string().uuid().optional().nullable(),
  monthly: amount,
  currency: z.enum(["USD", "UYU"]),
  from: z.string().refine(isISODate, "Revisá desde cuándo."),
  notes: z.string().trim().max(200).optional(),
});

/** Nueva tarifa. Si el animal (o el propietario, para la general) ya tenía una vigente, se cierra el día anterior. */
export async function addRate(farmId: string, raw: z.input<typeof rateInput>) {
  const parsed = rateInput.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!(await ownerOf(farmId, d.ownerId))) return { ok: false as const, error: "Ese propietario no existe." };
  if (d.animalId) {
    const [a] = await db
      .select({ id: schema.animals.id })
      .from(schema.animals)
      .where(and(eq(schema.animals.id, d.animalId), eq(schema.animals.farmId, farmId)))
      .limit(1);
    if (!a) return { ok: false as const, error: "Elegí un animal de la lista." };
  }
  await db.transaction(async (tx) => {
    await tx
      .update(schema.boardRates)
      .set({ to: addDays(d.from, -1) })
      .where(
        and(
          eq(schema.boardRates.ownerId, d.ownerId),
          d.animalId ? eq(schema.boardRates.animalId, d.animalId) : isNull(schema.boardRates.animalId),
          isNull(schema.boardRates.to),
          sql`${schema.boardRates.from} < ${d.from}`,
        ),
      );
    await tx.insert(schema.boardRates).values({
      farmId,
      ownerId: d.ownerId,
      animalId: d.animalId ?? null,
      monthly: d.monthly.toFixed(2),
      currency: d.currency,
      from: d.from,
      notes: d.notes || null,
    });
  });
  return { ok: true as const };
}

export async function endRate(farmId: string, id: string, date: string) {
  if (!z.string().uuid().safeParse(id).success || !isISODate(date)) return;
  await db.update(schema.boardRates).set({ to: date }).where(and(eq(schema.boardRates.id, id), eq(schema.boardRates.farmId, farmId)));
}

export async function ownerRates(farmId: string, ownerId: string) {
  return db
    .select({
      id: schema.boardRates.id,
      monthly: schema.boardRates.monthly,
      currency: schema.boardRates.currency,
      from: schema.boardRates.from,
      to: schema.boardRates.to,
      notes: schema.boardRates.notes,
      animalId: schema.boardRates.animalId,
      animalName: schema.animals.name,
      animalTag: schema.animals.tagVisual,
    })
    .from(schema.boardRates)
    .leftJoin(schema.animals, eq(schema.animals.id, schema.boardRates.animalId))
    .where(and(eq(schema.boardRates.farmId, farmId), eq(schema.boardRates.ownerId, ownerId)))
    .orderBy(sql`${schema.boardRates.to} is null desc`, desc(schema.boardRates.from));
}

/**
 * Genera los cargos de pensión de un mes (AAAA-MM) para las tarifas vigentes ese mes.
 * Si la tarifa empieza o termina dentro del mes, se cobra proporcional a los días.
 * No duplica: una tarifa se cobra una sola vez por mes.
 */
export async function chargeMonth(farmId: string, userId: string, period: string, ownerId?: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return { ok: false as const, error: "Revisá el mes." };
  const first = `${period}-01`;
  const [y, m] = period.split("-").map(Number);
  const last = addDays(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`, -1);
  if (first > todayISO()) return { ok: false as const, error: "No se puede cobrar un mes que todavía no empezó." };
  const rates = await db
    .select({
      id: schema.boardRates.id,
      ownerId: schema.boardRates.ownerId,
      animalId: schema.boardRates.animalId,
      monthly: schema.boardRates.monthly,
      currency: schema.boardRates.currency,
      from: schema.boardRates.from,
      to: schema.boardRates.to,
      animalName: schema.animals.name,
      animalTag: schema.animals.tagVisual,
    })
    .from(schema.boardRates)
    .innerJoin(schema.owners, and(eq(schema.owners.id, schema.boardRates.ownerId), eq(schema.owners.active, true)))
    .leftJoin(schema.animals, eq(schema.animals.id, schema.boardRates.animalId))
    .where(
      and(
        eq(schema.boardRates.farmId, farmId),
        lte(schema.boardRates.from, last),
        or(isNull(schema.boardRates.to), gte(schema.boardRates.to, first)),
        ownerId ? eq(schema.boardRates.ownerId, ownerId) : sql`true`,
      ),
    );
  const days = Number(last.slice(8));
  const values = rates.map((r) => {
    const start = r.from > first ? r.from : first;
    const end = r.to && r.to < last ? r.to : last;
    const covered = Number(end.slice(8)) - Number(start.slice(8)) + 1;
    const total = (Number(r.monthly) * covered) / days;
    const who = r.animalName ?? r.animalTag;
    return {
      farmId,
      ownerId: r.ownerId,
      kind: "cargo",
      date: last > todayISO() ? todayISO() : last,
      amount: total.toFixed(2),
      currency: r.currency,
      concept: `Pensión ${monthName(period)}${who ? ` · ${who}` : ""}`,
      notes: covered < days ? `${covered} de ${days} días` : null,
      animalId: r.animalId,
      period,
      rateId: r.id,
      createdBy: userId,
    };
  });
  if (!values.length) return { ok: true as const, value: { created: 0, skipped: 0 } };
  const inserted = await db.insert(schema.ledger).values(values).onConflictDoNothing().returning({ id: schema.ledger.id });
  return { ok: true as const, value: { created: inserted.length, skipped: values.length - inserted.length } };
}
