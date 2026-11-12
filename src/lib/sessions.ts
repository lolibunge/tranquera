import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { CATALOG, controlOf, isSpeciesKey } from "./catalogo";
import { isSpeciesActive } from "./farm-species";
import { isISODate, todayISO } from "./dates";

export const sessionInput = z.object({
  species: z.string(),
  control: z.string().trim().min(1, "Elegí qué se va a hacer."),
  label: z.string().trim().max(80).optional(),
  product: z.string().trim().max(120).optional(),
  batch: z.string().trim().max(60).optional(),
  dose: z.string().trim().max(40).optional(),
  date: z.string().refine(isISODate, "Revisá la fecha."),
  nextDueDate: z.string().optional().nullable(),
  vet: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function createSession(farmId: string, userId: string, raw: z.input<typeof sessionInput>) {
  const parsed = sessionInput.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!isSpeciesKey(d.species) || !(await isSpeciesActive(farmId, d.species))) return { ok: false as const, error: "Elegí una especie del campo." };
  if (d.date > todayISO()) return { ok: false as const, error: "La fecha no puede ser futura." };
  if (d.nextDueDate && (!isISODate(d.nextDueDate) || d.nextDueDate <= d.date)) return { ok: false as const, error: "La próxima fecha tiene que ser después." };
  const known = controlOf(d.species, d.control);
  const label = known?.label ?? d.label?.trim();
  if (!label) return { ok: false as const, error: "Escribí qué se va a hacer." };
  const [row] = await db
    .insert(schema.healthSessions)
    .values({
      farmId,
      species: d.species,
      control: known ? d.control : `otro:${label.toLowerCase().slice(0, 50)}`,
      label,
      product: d.product || null,
      batch: d.batch || null,
      dose: d.dose || null,
      date: d.date,
      nextDueDate: d.nextDueDate || null,
      vet: d.vet || null,
      notes: d.notes || null,
      createdBy: userId,
    })
    .returning({ id: schema.healthSessions.id });
  return { ok: true as const, value: row };
}

export async function getSession(farmId: string, id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const [row] = await db
    .select()
    .from(schema.healthSessions)
    .where(and(eq(schema.healthSessions.id, id), eq(schema.healthSessions.farmId, farmId)))
    .limit(1);
  return row ?? null;
}

/** Padrón activo de la especie, liviano, para buscar caravanas en el celular (también sin señal). */
export async function rosterFor(farmId: string, species: string) {
  return db
    .select({
      id: schema.animals.id,
      tagVisual: schema.animals.tagVisual,
      tagRfid: schema.animals.tagRfid,
      name: schema.animals.name,
      category: schema.animals.category,
      isLot: schema.animals.isLot,
      headCount: schema.animals.headCount,
    })
    .from(schema.animals)
    .where(and(eq(schema.animals.farmId, farmId), eq(schema.animals.species, species), eq(schema.animals.status, "activo")));
}

export async function sessionRecords(sessionId: string) {
  return db
    .select({ id: schema.healthEvents.id, animalId: schema.healthEvents.animalId, clientId: schema.healthEvents.clientId })
    .from(schema.healthEvents)
    .where(eq(schema.healthEvents.sessionId, sessionId));
}

export async function recentSessions(farmId: string) {
  return db
    .select({
      id: schema.healthSessions.id,
      label: schema.healthSessions.label,
      species: schema.healthSessions.species,
      date: schema.healthSessions.date,
      closedAt: schema.healthSessions.closedAt,
      count: sql<number>`(select count(*)::int from ${schema.healthEvents} e where e.jornada_id = ${schema.healthSessions.id})`,
    })
    .from(schema.healthSessions)
    .where(eq(schema.healthSessions.farmId, farmId))
    .orderBy(desc(schema.healthSessions.date), desc(schema.healthSessions.createdAt))
    .limit(10);
}

export function speciesForManga() {
  return Object.values(CATALOG).filter((s) => s.mode !== "lote");
}
