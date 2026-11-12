import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { daysBetween, isISODate, todayISO } from "./dates";
import { parseSvgMap, type FarmMap } from "./svg-map";

export const PADDOCK_KINDS = [
  { value: "natural", label: "Campo natural" },
  { value: "pradera", label: "Pradera" },
  { value: "verdeo", label: "Verdeo" },
  { value: "rastrojo", label: "Rastrojo" },
  { value: "monte", label: "Monte" },
  { value: "otro", label: "Otro" },
] as const;

export type PaddockSummary = {
  id: string;
  name: string;
  hectares: number | null;
  kind: string | null;
  svgId: string | null;
  notes: string | null;
  heads: number;
  bySpecies: Record<string, number>;
  /** Cabezas por hectárea (si tiene hectáreas). */
  load: number | null;
  /** Días que lleva vacío (desde la última salida), o null si tiene animales o nunca tuvo. */
  restDays: number | null;
  /** Días desde que entraron los animales que están. */
  occupiedDays: number | null;
};

export async function listPaddocks(farmId: string): Promise<PaddockSummary[]> {
  const today = todayISO();
  const [rows, occupancy, lastOut, lastIn] = await Promise.all([
    db
      .select()
      .from(schema.paddocks)
      .where(and(eq(schema.paddocks.farmId, farmId), eq(schema.paddocks.active, true)))
      .orderBy(asc(schema.paddocks.name)),
    db
      .select({
        paddockId: schema.animals.paddockId,
        species: schema.animals.species,
        heads: sql<number>`sum(${schema.animals.headCount})::int`,
      })
      .from(schema.animals)
      .where(and(eq(schema.animals.farmId, farmId), eq(schema.animals.status, "activo"), sql`${schema.animals.paddockId} is not null`))
      .groupBy(schema.animals.paddockId, schema.animals.species),
    db
      .select({ paddockId: schema.movements.fromPaddockId, date: sql<string>`max(${schema.movements.date})::text` })
      .from(schema.movements)
      .where(eq(schema.movements.farmId, farmId))
      .groupBy(schema.movements.fromPaddockId),
    db
      .select({ paddockId: schema.movements.toPaddockId, date: sql<string>`max(${schema.movements.date})::text` })
      .from(schema.movements)
      .where(eq(schema.movements.farmId, farmId))
      .groupBy(schema.movements.toPaddockId),
  ]);

  return rows.map((p) => {
    const occ = occupancy.filter((o) => o.paddockId === p.id);
    const heads = occ.reduce((n, o) => n + o.heads, 0);
    const out = lastOut.find((l) => l.paddockId === p.id)?.date ?? null;
    const into = lastIn.find((l) => l.paddockId === p.id)?.date ?? null;
    return {
      id: p.id,
      name: p.name,
      hectares: p.hectares,
      kind: p.kind,
      svgId: p.svgId,
      notes: p.notes,
      heads,
      bySpecies: Object.fromEntries(occ.map((o) => [o.species, o.heads])),
      load: p.hectares && heads ? Math.round((heads / p.hectares) * 100) / 100 : null,
      restDays: heads === 0 && out ? Math.max(0, daysBetween(out, today)) : null,
      occupiedDays: heads > 0 && into ? Math.max(0, daysBetween(into, today)) : null,
    };
  });
}

export async function paddockOptions(farmId: string) {
  return db
    .select({ id: schema.paddocks.id, name: schema.paddocks.name })
    .from(schema.paddocks)
    .where(and(eq(schema.paddocks.farmId, farmId), eq(schema.paddocks.active, true)))
    .orderBy(asc(schema.paddocks.name));
}

export const paddockInput = z.object({
  name: z.string().trim().min(1, "Escribí el nombre del potrero.").max(60),
  hectares: z
    .string()
    .trim()
    .transform((v) => v.replace(",", "."))
    .refine((v) => v === "" || (Number(v) > 0 && Number(v) < 100000), "Revisá las hectáreas.")
    .transform((v) => (v === "" ? null : Number(v))),
  kind: z.string().trim().max(20).transform((v) => v || null),
  notes: z.string().trim().max(500).transform((v) => v || null),
});

export async function savePaddock(farmId: string, raw: z.input<typeof paddockInput>, id?: string) {
  const parsed = paddockInput.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const [dup] = await db
    .select({ id: schema.paddocks.id, active: schema.paddocks.active })
    .from(schema.paddocks)
    .where(and(eq(schema.paddocks.farmId, farmId), sql`lower(${schema.paddocks.name}) = lower(${d.name})`))
    .limit(1);
  if (dup && dup.id !== id) {
    if (!dup.active && !id) {
      await db.update(schema.paddocks).set({ ...d, active: true, updatedAt: new Date() }).where(eq(schema.paddocks.id, dup.id));
      return { ok: true as const, value: { id: dup.id } };
    }
    return { ok: false as const, error: "Ya hay un potrero con ese nombre." };
  }
  if (id) {
    await db.update(schema.paddocks).set({ ...d, updatedAt: new Date() }).where(and(eq(schema.paddocks.id, id), eq(schema.paddocks.farmId, farmId)));
    return { ok: true as const, value: { id } };
  }
  const [row] = await db.insert(schema.paddocks).values({ farmId, ...d }).returning({ id: schema.paddocks.id });
  return { ok: true as const, value: row };
}

/** Archiva el potrero (no se borra: queda en el historial de movimientos). Los animales que tenía quedan sin potrero. */
export async function archivePaddock(farmId: string, id: string) {
  await db.transaction(async (tx) => {
    await tx.update(schema.animals).set({ paddockId: null }).where(and(eq(schema.animals.farmId, farmId), eq(schema.animals.paddockId, id)));
    await tx.update(schema.paddocks).set({ active: false, svgId: null, updatedAt: new Date() }).where(and(eq(schema.paddocks.id, id), eq(schema.paddocks.farmId, farmId)));
  });
}

/** Guarda el mapa y crea los potreros que aparezcan con nombre y todavía no existan. */
export async function saveMap(farmId: string, svgText: string) {
  const parsed = parseSvgMap(svgText);
  if (!parsed.ok) return parsed;
  const existing = await db
    .select({ id: schema.paddocks.id, name: schema.paddocks.name, active: schema.paddocks.active })
    .from(schema.paddocks)
    .where(eq(schema.paddocks.farmId, farmId));
  const byName = new Map(existing.map((p) => [p.name.toLowerCase(), p]));
  let created = 0;
  await db.transaction(async (tx) => {
    await tx
      .insert(schema.farmMaps)
      .values({ farmId, svg: JSON.stringify(parsed.map) })
      .onConflictDoUpdate({ target: schema.farmMaps.farmId, set: { svg: JSON.stringify(parsed.map), updatedAt: new Date() } });
    for (const name of parsed.names) {
      const found = byName.get(name.toLowerCase());
      if (found) {
        await tx.update(schema.paddocks).set({ svgId: name, active: true, updatedAt: new Date() }).where(eq(schema.paddocks.id, found.id));
      } else {
        await tx.insert(schema.paddocks).values({ farmId, name, svgId: name });
        created++;
      }
    }
  });
  return { ok: true as const, created, names: parsed.names, fromText: parsed.fromText, unnamed: parsed.map.shapes.filter((s) => !s.name).length };
}

export async function getMap(farmId: string): Promise<FarmMap | null> {
  const [row] = await db.select({ svg: schema.farmMaps.svg }).from(schema.farmMaps).where(eq(schema.farmMaps.farmId, farmId)).limit(1);
  if (!row) return null;
  try {
    return JSON.parse(row.svg) as FarmMap;
  } catch {
    return null;
  }
}

export async function deleteMap(farmId: string) {
  await db.transaction(async (tx) => {
    await tx.delete(schema.farmMaps).where(eq(schema.farmMaps.farmId, farmId));
    await tx.update(schema.paddocks).set({ svgId: null }).where(eq(schema.paddocks.farmId, farmId));
  });
}

/**
 * Mueve animales a un potrero (o los saca: toPaddockId null). Registra un movimiento
 * por animal, todos con la misma tanda. Saltea los que ya están en ese potrero.
 */
export async function moveAnimals(
  farmId: string,
  userId: string,
  input: { animalIds: string[]; toPaddockId: string | null; date: string; note?: string | null },
) {
  const ids = [...new Set(input.animalIds)].filter((id) => z.string().uuid().safeParse(id).success);
  if (!ids.length) return { ok: false as const, error: "Elegí al menos un animal." };
  if (!isISODate(input.date) || input.date > todayISO()) return { ok: false as const, error: "Revisá la fecha." };
  if (input.toPaddockId) {
    const [target] = await db
      .select({ id: schema.paddocks.id })
      .from(schema.paddocks)
      .where(and(eq(schema.paddocks.id, input.toPaddockId), eq(schema.paddocks.farmId, farmId), eq(schema.paddocks.active, true)))
      .limit(1);
    if (!target) return { ok: false as const, error: "Elegí un potrero del campo." };
  }
  const animals = await db
    .select({ id: schema.animals.id, paddockId: schema.animals.paddockId })
    .from(schema.animals)
    .where(and(eq(schema.animals.farmId, farmId), eq(schema.animals.status, "activo"), inArray(schema.animals.id, ids)));
  const toMove = animals.filter((a) => a.paddockId !== input.toPaddockId);
  if (!toMove.length) return { ok: true as const, moved: 0 };
  const batchId = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(schema.movements).values(
      toMove.map((a) => ({
        farmId,
        animalId: a.id,
        fromPaddockId: a.paddockId,
        toPaddockId: input.toPaddockId,
        date: input.date,
        batchId,
        note: input.note || null,
        createdBy: userId,
      })),
    );
    await tx
      .update(schema.animals)
      .set({ paddockId: input.toPaddockId, updatedAt: new Date() })
      .where(inArray(schema.animals.id, toMove.map((a) => a.id)));
  });
  return { ok: true as const, moved: toMove.length };
}

export async function animalMovements(farmId: string, animalId: string) {
  const from = sql`(select nombre from ${schema.paddocks} p where p.id = ${schema.movements.fromPaddockId})`;
  const to = sql`(select nombre from ${schema.paddocks} p where p.id = ${schema.movements.toPaddockId})`;
  return db
    .select({ id: schema.movements.id, date: schema.movements.date, from: sql<string | null>`${from}`, to: sql<string | null>`${to}`, note: schema.movements.note })
    .from(schema.movements)
    .where(and(eq(schema.movements.farmId, farmId), eq(schema.movements.animalId, animalId)))
    .orderBy(sql`${schema.movements.date} desc, ${schema.movements.createdAt} desc`)
    .limit(50);
}

/**
 * Nombra una forma del mapa (o la marca como "no es potrero").
 * Si el nombre es nuevo crea el potrero; si ya existe, lo enlaza.
 */
export async function nameShape(farmId: string, index: number, input: { name: string | null; background: boolean }) {
  const map = await getMap(farmId);
  if (!map) return { ok: false as const, error: "El campo no tiene mapa." };
  const shape = map.shapes[index];
  if (!shape) return { ok: false as const, error: "Esa división ya no está en el mapa." };
  const name = input.name?.trim().replace(/\s+/g, " ") ?? "";
  if (!input.background && (name.length < 1 || name.length > 60)) return { ok: false as const, error: "Escribí el nombre del potrero." };

  const previous = shape.name;
  shape.name = input.background ? null : name;
  shape.background = input.background || undefined;

  await db.transaction(async (tx) => {
    await tx.update(schema.farmMaps).set({ svg: JSON.stringify(map), updatedAt: new Date() }).where(eq(schema.farmMaps.farmId, farmId));
    if (!input.background) {
      const [found] = await tx
        .select({ id: schema.paddocks.id })
        .from(schema.paddocks)
        .where(and(eq(schema.paddocks.farmId, farmId), sql`lower(${schema.paddocks.name}) = lower(${name})`))
        .limit(1);
      const onlyUse = previous && !map.shapes.some((s, i) => i !== index && s.name?.toLowerCase() === previous.toLowerCase());
      if (found) await tx.update(schema.paddocks).set({ svgId: name, active: true, updatedAt: new Date() }).where(eq(schema.paddocks.id, found.id));
      else if (previous && onlyUse) {
        // Cambio de nombre: se renombra el mismo potrero (conserva animales e historial).
        const renamed = await tx
          .update(schema.paddocks)
          .set({ name, svgId: name, updatedAt: new Date() })
          .where(and(eq(schema.paddocks.farmId, farmId), sql`lower(${schema.paddocks.svgId}) = lower(${previous})`))
          .returning({ id: schema.paddocks.id });
        if (!renamed.length) await tx.insert(schema.paddocks).values({ farmId, name, svgId: name });
      } else await tx.insert(schema.paddocks).values({ farmId, name, svgId: name });
    }
    // El nombre anterior, si ya ninguna forma lo usa, deja de estar en el mapa (el potrero queda).
    if (previous && previous.toLowerCase() !== name.toLowerCase() && !map.shapes.some((s) => s.name?.toLowerCase() === previous.toLowerCase())) {
      await tx
        .update(schema.paddocks)
        .set({ svgId: null, updatedAt: new Date() })
        .where(and(eq(schema.paddocks.farmId, farmId), sql`lower(${schema.paddocks.svgId}) = lower(${previous})`));
    }
  });
  return { ok: true as const };
}
