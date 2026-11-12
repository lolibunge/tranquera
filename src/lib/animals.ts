import "server-only";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { CATALOG, categoryOf, isSpeciesKey, normalizeTag, type SpeciesKey } from "./catalogo";
import { isSpeciesActive } from "./farm-species";
import { isISODate, todayISO } from "./dates";

/**
 * Altas y cambios del padrón. Las usan las acciones de pantalla y la sincronización
 * sin señal, así que las reglas viven en un solo lugar.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

const optionalDate = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || isISODate(v), `Revisá la fecha de ${label}.`)
    .refine((v) => v === null || v <= todayISO(), `La fecha de ${label} no puede ser futura.`);

export const animalInput = z.object({
  species: z.string(),
  isLot: z.boolean().default(false),
  headCount: z.coerce.number().int().min(1, "Un lote tiene que tener al menos 1 cabeza.").max(100000).default(1),
  category: optionalText(40),
  name: optionalText(80),
  tagVisual: optionalText(40),
  tagRfid: optionalText(40),
  birthDate: optionalDate("nacimiento"),
  breed: optionalText(60),
  /** undefined: no se toca. */
  color: z.string().trim().max(40).optional().transform((v) => (v === undefined ? undefined : v || null)),
  training: z.enum(["", "sin_domar", "en_doma", "domado", "retirado"]).optional().transform((v) => (v === undefined ? undefined : v || null)),
  origin: z.enum(["nacido", "comprado"]).nullable().optional().transform((v) => v ?? null),
  originDetail: optionalText(120),
  arrivedOn: optionalDate("ingreso"),
  notes: optionalText(1000),
  clientId: z.string().uuid().nullable().optional().transform((v) => v ?? null),
  paddockId: z.string().uuid().nullable().optional().transform((v) => v ?? null),
  /** undefined: no se toca; null: sin asignar. */
  ownerId: z.string().uuid().nullable().optional(),
});
export type AnimalInput = z.input<typeof animalInput>;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Valida y normaliza. No escribe. */
export async function prepareAnimal(farmId: string, raw: AnimalInput, editingId?: string): Promise<Result<typeof schema.animals.$inferInsert>> {
  const parsed = animalInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!isSpeciesKey(d.species)) return { ok: false, error: "Elegí una especie." };
  const species: SpeciesKey = d.species;
  if (!editingId && !(await isSpeciesActive(farmId, species))) {
    return { ok: false, error: `${CATALOG[species].plural} no está prendida en Especies del campo.` };
  }
  const info = CATALOG[species];
  const isLot = info.mode === "lote" ? true : info.mode === "individual" ? false : d.isLot;
  if (info.mode === "individual" && d.isLot) {
    return { ok: false, error: `${info.plural} se registran uno por uno: la sanidad y la trazabilidad son por animal.` };
  }

  const category = d.category ? categoryOf(species, d.category) : null;
  if (d.category && !category) return { ok: false, error: "Elegí una categoría de la lista." };
  if (!isLot && !category) return { ok: false, error: "Elegí la categoría." };

  const tagVisual = d.tagVisual ? normalizeTag(d.tagVisual) : null;
  const tagRfid = d.tagRfid ? normalizeTag(d.tagRfid) : null;
  if (tagRfid && !/^\d{8,20}$/.test(tagRfid)) return { ok: false, error: "El botón RFID tiene que ser solo números." };
  if (!isLot && !tagVisual && !tagRfid && !d.name) return { ok: false, error: "Poné la caravana o un nombre para reconocerlo." };
  if (isLot && !d.name) return { ok: false, error: "Poné un nombre al lote (por ejemplo, Ponedoras galpón 1)." };

  if (tagVisual || tagRfid) {
    const conditions = [];
    if (tagVisual) conditions.push(eq(schema.animals.tagVisual, tagVisual));
    if (tagRfid) conditions.push(eq(schema.animals.tagRfid, tagRfid));
    const [dup] = await db
      .select({ id: schema.animals.id })
      .from(schema.animals)
      .where(
        and(
          eq(schema.animals.farmId, farmId),
          eq(schema.animals.status, "activo"),
          or(...conditions),
          editingId ? ne(schema.animals.id, editingId) : undefined,
        ),
      )
      .limit(1);
    if (dup) return { ok: false, error: "Ya hay un animal activo con esa caravana en el campo." };
  }

  if (d.paddockId) {
    const [p] = await db
      .select({ id: schema.paddocks.id })
      .from(schema.paddocks)
      .where(and(eq(schema.paddocks.id, d.paddockId), eq(schema.paddocks.farmId, farmId)))
      .limit(1);
    if (!p) return { ok: false, error: "Elegí un potrero del campo." };
  }
  if (d.ownerId) {
    const [o] = await db
      .select({ id: schema.owners.id })
      .from(schema.owners)
      .where(and(eq(schema.owners.id, d.ownerId), eq(schema.owners.farmId, farmId), eq(schema.owners.active, true)))
      .limit(1);
    if (!o) return { ok: false, error: "Elegí un propietario de la lista." };
  }

  return {
    ok: true,
    value: {
      farmId,
      species,
      paddockId: editingId ? undefined : d.paddockId,
      ownerId: d.ownerId,
      isLot,
      headCount: isLot ? d.headCount : 1,
      category: category?.value ?? null,
      sex: category?.sex ?? null,
      name: d.name,
      tagVisual,
      tagRfid,
      birthDate: d.birthDate,
      breed: d.breed,
      color: d.species === "caballo" ? d.color : undefined,
      training: d.species === "caballo" ? d.training : undefined,
      origin: d.origin,
      originDetail: d.origin === "comprado" ? d.originDetail : null,
      arrivedOn: d.origin === "comprado" ? d.arrivedOn : null,
      notes: d.notes,
      clientId: d.clientId,
    },
  };
}

export async function createAnimal(farmId: string, userId: string, raw: AnimalInput): Promise<Result<{ id: string }>> {
  if (raw.clientId) {
    // Ya sincronizado antes (reintento desde el celular): no se duplica.
    const [existing] = await db.select({ id: schema.animals.id }).from(schema.animals).where(eq(schema.animals.clientId, raw.clientId)).limit(1);
    if (existing) return { ok: true, value: existing };
  }
  const prepared = await prepareAnimal(farmId, raw);
  if (!prepared.ok) return prepared;
  const [row] = await db
    .insert(schema.animals)
    .values({ ...prepared.value, createdBy: userId })
    .onConflictDoNothing({ target: schema.animals.clientId })
    .returning({ id: schema.animals.id });
  if (!row && raw.clientId) {
    const [existing] = await db.select({ id: schema.animals.id }).from(schema.animals).where(eq(schema.animals.clientId, raw.clientId)).limit(1);
    if (existing) return { ok: true, value: existing };
  }
  if (row && prepared.value.paddockId) {
    // Entrada al potrero: cuenta para los días de ocupación.
    await db.insert(schema.movements).values({
      farmId,
      animalId: row.id,
      toPaddockId: prepared.value.paddockId,
      date: prepared.value.arrivedOn ?? todayISO(),
      batchId: crypto.randomUUID(),
      createdBy: userId,
    });
  }
  return row ? { ok: true, value: row } : { ok: false, error: "No se pudo guardar." };
}

export async function updateAnimal(farmId: string, id: string, raw: AnimalInput): Promise<Result<{ id: string }>> {
  const animal = await getAnimal(farmId, id);
  if (!animal) return { ok: false, error: "Ese animal ya no existe." };
  const prepared = await prepareAnimal(farmId, { ...raw, species: animal.species, clientId: null }, id);
  if (!prepared.ok) return prepared;
  const { clientId: _ignored, farmId: _farm, ...changes } = prepared.value;
  void _ignored;
  void _farm;
  await db
    .update(schema.animals)
    .set({ ...changes, updatedAt: new Date() })
    .where(and(eq(schema.animals.id, id), eq(schema.animals.farmId, farmId)));
  return { ok: true, value: { id } };
}

export async function getAnimal(farmId: string, id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const [row] = await db
    .select()
    .from(schema.animals)
    .where(and(eq(schema.animals.id, id), eq(schema.animals.farmId, farmId)))
    .limit(1);
  return row ?? null;
}

/**
 * Carga de varios a la vez por caravana (vacunos y otras especies individuales).
 * Devuelve cuántos se crearon y cuáles se saltearon por estar repetidos.
 */
export async function createManyByTag(
  farmId: string,
  userId: string,
  input: { species: string; category: string; tags: string[]; breed?: string | null; birthDate?: string | null; origin?: "nacido" | "comprado" | null },
): Promise<Result<{ created: number; skipped: string[] }>> {
  const unique = [...new Set(input.tags.map(normalizeTag).filter(Boolean))];
  if (!unique.length) return { ok: false, error: "Pegá o escaneá al menos una caravana." };
  if (unique.length > 500) return { ok: false, error: "Hasta 500 caravanas por vez." };
  const base = await prepareAnimal(farmId, {
    species: input.species,
    category: input.category,
    tagVisual: unique[0],
    breed: input.breed,
    birthDate: input.birthDate,
    origin: input.origin,
  });
  if (!base.ok && !base.error.startsWith("Ya hay")) return base;

  // Si es solo dígitos y largo (lectura del bastón), va como RFID; si no, como caravana visual.
  const asRfid = (t: string) => /^\d{12,20}$/.test(t);
  const existing = await db
    .select({ tagVisual: schema.animals.tagVisual, tagRfid: schema.animals.tagRfid })
    .from(schema.animals)
    .where(
      and(
        eq(schema.animals.farmId, farmId),
        eq(schema.animals.status, "activo"),
        or(inArray(schema.animals.tagVisual, unique), inArray(schema.animals.tagRfid, unique)),
      ),
    );
  const taken = new Set(existing.flatMap((e) => [e.tagVisual, e.tagRfid]).filter(Boolean) as string[]);
  const skipped = unique.filter((t) => taken.has(t));
  const fresh = unique.filter((t) => !taken.has(t));
  const template = base.ok ? base.value : null;
  const category = categoryOf(input.species as SpeciesKey, input.category);
  if (fresh.length) {
    await db.insert(schema.animals).values(
      fresh.map((tag) => ({
        farmId,
        species: input.species,
        isLot: false,
        headCount: 1,
        category: category?.value ?? null,
        sex: category?.sex ?? null,
        tagVisual: asRfid(tag) ? null : tag,
        tagRfid: asRfid(tag) ? tag : null,
        breed: template?.breed ?? input.breed ?? null,
        birthDate: template?.birthDate ?? null,
        origin: template?.origin ?? null,
        createdBy: userId,
      })),
    );
  }
  return { ok: true, value: { created: fresh.length, skipped } };
}

export async function setAnimalStatus(
  farmId: string,
  id: string,
  status: "activo" | "vendido" | "muerto" | "baja",
  date: string | null,
  note: string | null,
  cause: string | null = null,
): Promise<Result<{ id: string }>> {
  if (date && (!isISODate(date) || date > todayISO())) return { ok: false, error: "Revisá la fecha." };
  if (status === "muerto" && !cause) return { ok: false, error: "Elegí la causa." };
  const [row] = await db
    .update(schema.animals)
    .set({
      status,
      statusDate: status === "activo" ? null : date ?? todayISO(),
      statusNote: status === "activo" ? null : note,
      statusCause: status === "muerto" ? cause : null,
      saleId: status === "activo" ? null : undefined,
      paddockId: status === "activo" ? undefined : null,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.animals.id, id), eq(schema.animals.farmId, farmId)))
    .returning({ id: schema.animals.id });
  return row ? { ok: true, value: row } : { ok: false, error: "Ese animal ya no existe." };
}

export const headsSql = sql<number>`coalesce(sum(${schema.animals.headCount}), 0)::int`;
