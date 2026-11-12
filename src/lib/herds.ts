import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { isISODate, todayISO } from "./dates";

/** Tropillas o grupos con sus miembros actuales. */
export async function listHerds(farmId: string) {
  const herds = await db
    .select({ id: schema.herds.id, name: schema.herds.name, notes: schema.herds.notes })
    .from(schema.herds)
    .where(and(eq(schema.herds.farmId, farmId), eq(schema.herds.active, true)))
    .orderBy(asc(schema.herds.name));
  if (!herds.length) return [];
  const members = await db
    .select({
      herdId: schema.herdMembers.herdId,
      animalId: schema.herdMembers.animalId,
      heads: schema.animals.headCount,
      paddock: schema.paddocks.name,
    })
    .from(schema.herdMembers)
    .innerJoin(schema.animals, and(eq(schema.animals.id, schema.herdMembers.animalId), eq(schema.animals.status, "activo")))
    .leftJoin(schema.paddocks, eq(schema.paddocks.id, schema.animals.paddockId))
    .where(and(eq(schema.herdMembers.farmId, farmId), isNull(schema.herdMembers.to)));
  return herds.map((h) => {
    const mine = members.filter((m) => m.herdId === h.id);
    const paddocks = [...new Set(mine.map((m) => m.paddock ?? "Sin potrero"))];
    return { ...h, memberIds: mine.map((m) => m.animalId), heads: mine.reduce((n, m) => n + m.heads, 0), paddocks };
  });
}

export async function getHerd(farmId: string, id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  return (await listHerds(farmId)).find((h) => h.id === id) ?? null;
}

const herdInput = z.object({
  name: z.string().trim().min(2, "Escribí el nombre.").max(60),
  notes: z.string().trim().max(500).optional(),
});

export async function saveHerd(farmId: string, id: string | null, raw: z.input<typeof herdInput>) {
  const parsed = herdInput.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const [dup] = await db
    .select({ id: schema.herds.id })
    .from(schema.herds)
    .where(and(eq(schema.herds.farmId, farmId), sql`lower(${schema.herds.name}) = lower(${d.name})`, id ? sql`${schema.herds.id} <> ${id}` : sql`true`))
    .limit(1);
  if (dup) return { ok: false as const, error: "Ya hay un grupo con ese nombre." };
  if (id) {
    await db
      .update(schema.herds)
      .set({ name: d.name, notes: d.notes || null, updatedAt: new Date() })
      .where(and(eq(schema.herds.id, id), eq(schema.herds.farmId, farmId)));
    return { ok: true as const, value: { id } };
  }
  const [row] = await db.insert(schema.herds).values({ farmId, name: d.name, notes: d.notes || null }).returning({ id: schema.herds.id });
  return { ok: true as const, value: row };
}

/** Cierra las pertenencias abiertas y archiva el grupo (el historial queda). */
export async function archiveHerd(farmId: string, id: string) {
  const today = todayISO();
  await db.transaction(async (tx) => {
    await tx
      .update(schema.herdMembers)
      .set({ to: today })
      .where(and(eq(schema.herdMembers.farmId, farmId), eq(schema.herdMembers.herdId, id), isNull(schema.herdMembers.to)));
    await tx.update(schema.herds).set({ active: false, updatedAt: new Date() }).where(and(eq(schema.herds.id, id), eq(schema.herds.farmId, farmId)));
  });
}

/**
 * Deja en el grupo exactamente a estos animales desde `date`. Un animal está en un solo grupo
 * a la vez: si estaba en otro, sale de ese el mismo día.
 */
export async function setHerdMembers(farmId: string, herdId: string, animalIds: string[], date: string) {
  if (!isISODate(date) || date > todayISO()) return { ok: false as const, error: "Revisá la fecha." };
  const herd = await getHerd(farmId, herdId);
  if (!herd) return { ok: false as const, error: "Ese grupo no existe." };
  const valid = animalIds.length
    ? (
        await db
          .select({ id: schema.animals.id })
          .from(schema.animals)
          .where(and(eq(schema.animals.farmId, farmId), eq(schema.animals.status, "activo"), inArray(schema.animals.id, animalIds)))
      ).map((r) => r.id)
    : [];
  const current = new Set(herd.memberIds);
  const next = new Set(valid);
  const leaving = [...current].filter((id) => !next.has(id));
  const joining = [...next].filter((id) => !current.has(id));
  await db.transaction(async (tx) => {
    if (leaving.length) {
      await tx
        .update(schema.herdMembers)
        .set({ to: date })
        .where(and(eq(schema.herdMembers.herdId, herdId), isNull(schema.herdMembers.to), inArray(schema.herdMembers.animalId, leaving)));
    }
    if (joining.length) {
      await tx
        .update(schema.herdMembers)
        .set({ to: date })
        .where(and(eq(schema.herdMembers.farmId, farmId), isNull(schema.herdMembers.to), inArray(schema.herdMembers.animalId, joining)));
      await tx.insert(schema.herdMembers).values(joining.map((animalId) => ({ farmId, herdId, animalId, from: date })));
    }
  });
  return { ok: true as const, value: { joined: joining.length, left: leaving.length } };
}

/** Grupo actual e historial de grupos de un animal. */
export async function animalHerds(farmId: string, animalId: string) {
  return db
    .select({ herdId: schema.herds.id, name: schema.herds.name, from: schema.herdMembers.from, to: schema.herdMembers.to })
    .from(schema.herdMembers)
    .innerJoin(schema.herds, eq(schema.herds.id, schema.herdMembers.herdId))
    .where(and(eq(schema.herdMembers.farmId, farmId), eq(schema.herdMembers.animalId, animalId)))
    .orderBy(desc(schema.herdMembers.from));
}

/** Entradas y salidas del grupo, lo más nuevo primero. */
export async function herdHistory(farmId: string, herdId: string) {
  const rows = await db
    .select({
      animalId: schema.herdMembers.animalId,
      from: schema.herdMembers.from,
      to: schema.herdMembers.to,
      name: schema.animals.name,
      tag: schema.animals.tagVisual,
    })
    .from(schema.herdMembers)
    .innerJoin(schema.animals, eq(schema.animals.id, schema.herdMembers.animalId))
    .where(and(eq(schema.herdMembers.farmId, farmId), eq(schema.herdMembers.herdId, herdId)));
  const events = rows.flatMap((r) => [
    { date: r.from, kind: "entra" as const, animalId: r.animalId, title: r.name ?? r.tag ?? "Animal" },
    ...(r.to ? [{ date: r.to, kind: "sale" as const, animalId: r.animalId, title: r.name ?? r.tag ?? "Animal" }] : []),
  ]);
  return events.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 100);
}
