import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { CATALOG, controlOf, isSpeciesKey } from "./catalogo";
import { addDays, isISODate, todayISO } from "./dates";

/** Días antes del vencimiento en que un control pasa a "vence pronto". */
export const SOON_DAYS = 14;

export type Tone = "ok" | "warn" | "bad";
export type ControlState = {
  control: string;
  label: string;
  lastDate: string;
  nextDue: string | null;
  tone: Tone;
};

export function toneFor(nextDue: string | null, today = todayISO()): Tone {
  if (!nextDue) return "ok";
  if (nextDue < today) return "bad";
  if (nextDue <= addDays(today, SOON_DAYS)) return "warn";
  return "ok";
}

const RANK: Record<Tone, number> = { ok: 0, warn: 1, bad: 2 };

/** Último registro de cada control de cada animal activo del campo (o de un animal). */
async function latestPerControl(farmId: string, animalId?: string) {
  const rows = await db.execute<{
    animal_id: string;
    control: string;
    titulo: string;
    fecha: string;
    proxima: string | null;
  }>(sql`
    select distinct on (s.animal_id, s.control)
      s.animal_id, s.control, s.titulo, s.fecha::text as fecha, s.proxima::text as proxima
    from ${schema.healthEvents} s
    join ${schema.animals} a on a.id = s.animal_id and a.estado = 'activo'
    where s.campo_id = ${farmId} ${animalId ? sql`and s.animal_id = ${animalId}` : sql``}
    order by s.animal_id, s.control, s.fecha desc, s.created_at desc
  `);
  return [...rows];
}

/** Estado sanitario por animal: el peor de sus controles. */
export async function healthByAnimal(farmId: string) {
  const today = todayISO();
  const map = new Map<string, { tone: Tone; states: ControlState[] }>();
  for (const r of await latestPerControl(farmId)) {
    const state: ControlState = { control: r.control, label: r.titulo, lastDate: r.fecha, nextDue: r.proxima, tone: toneFor(r.proxima, today) };
    const entry = map.get(r.animal_id) ?? { tone: "ok" as Tone, states: [] };
    entry.states.push(state);
    if (RANK[state.tone] > RANK[entry.tone]) entry.tone = state.tone;
    map.set(r.animal_id, entry);
  }
  return map;
}

/** Controles de un animal: los del catálogo de su especie más cualquier otro que tenga registrado. */
export async function controlsForAnimal(farmId: string, animalId: string, species: string) {
  const today = todayISO();
  const latest = await latestPerControl(farmId, animalId);
  const catalog = isSpeciesKey(species) ? CATALOG[species].controls : [];
  const states = catalog.map((c) => {
    const r = latest.find((l) => l.control === c.key);
    return {
      control: c.key,
      label: c.label,
      official: Boolean(c.official),
      lastDate: r?.fecha ?? null,
      nextDue: r?.proxima ?? null,
      tone: r ? toneFor(r.proxima, today) : null,
    };
  });
  for (const r of latest) {
    if (!catalog.some((c) => c.key === r.control)) {
      states.push({ control: r.control, label: r.titulo, official: false, lastDate: r.fecha, nextDue: r.proxima, tone: toneFor(r.proxima, today) });
    }
  }
  return states;
}

/** "Para atender": controles vencidos o por vencer, agrupados por especie y control. */
export async function pendingAlerts(farmId: string) {
  const today = todayISO();
  const limit = addDays(today, SOON_DAYS);
  const rows = await db.execute<{ especie: string; control: string; titulo: string; proxima: string; cabezas: number; animales: number; un_id: string }>(sql`
    with ultimos as (
      select distinct on (s.animal_id, s.control)
        s.animal_id, s.control, s.titulo, s.proxima
      from ${schema.healthEvents} s
      join ${schema.animals} a on a.id = s.animal_id and a.estado = 'activo'
      where s.campo_id = ${farmId}
      order by s.animal_id, s.control, s.fecha desc, s.created_at desc
    )
    select a.especie, u.control, min(u.titulo) as titulo, min(u.proxima)::text as proxima,
           sum(a.cabezas)::int as cabezas, count(*)::int as animales, min(a.id::text) as un_id
    from ultimos u join ${schema.animals} a on a.id = u.animal_id
    where u.proxima is not null and u.proxima <= ${limit}
    group by a.especie, u.control, (u.proxima < ${today})
    order by min(u.proxima)
  `);
  return [...rows].map((r) => ({
    species: r.especie,
    control: r.control,
    label: r.titulo,
    nextDue: r.proxima,
    heads: r.cabezas,
    animals: r.animales,
    oneAnimalId: r.un_id,
    tone: toneFor(r.proxima, today),
  }));
}

export const healthInput = z.object({
  animalId: z.string().uuid(),
  control: z.string().trim().min(1, "Elegí qué se hizo.").max(60),
  label: z.string().trim().max(80).optional(),
  product: z.string().trim().max(120).optional(),
  batch: z.string().trim().max(60).optional(),
  dose: z.string().trim().max(40).optional(),
  date: z.string().refine(isISODate, "Revisá la fecha."),
  nextDueDate: z.string().optional().nullable(),
  vet: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(1000).optional(),
  sessionId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
});
export type HealthInput = z.input<typeof healthInput>;

/** Próxima fecha sugerida según el intervalo del catálogo (si tiene). */
export function suggestedNextDue(species: string, control: string, date: string) {
  if (!isSpeciesKey(species)) return null;
  const c = controlOf(species, control);
  return c?.intervalDays ? addDays(date, c.intervalDays) : null;
}

export async function recordHealth(farmId: string, userId: string, raw: HealthInput) {
  const parsed = healthInput.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.date > todayISO()) return { ok: false as const, error: "La fecha no puede ser futura." };
  if (d.nextDueDate && (!isISODate(d.nextDueDate) || d.nextDueDate <= d.date)) {
    return { ok: false as const, error: "La próxima fecha tiene que ser después de la fecha del registro." };
  }
  if (d.clientId) {
    const [done] = await db.select({ id: schema.healthEvents.id }).from(schema.healthEvents).where(eq(schema.healthEvents.clientId, d.clientId)).limit(1);
    if (done) return { ok: true as const, value: done };
  }
  const [animal] = await db
    .select({ id: schema.animals.id, species: schema.animals.species })
    .from(schema.animals)
    .where(and(eq(schema.animals.id, d.animalId), eq(schema.animals.farmId, farmId)))
    .limit(1);
  if (!animal) return { ok: false as const, error: "Ese animal no está en el campo." };
  const known = isSpeciesKey(animal.species) ? controlOf(animal.species, d.control) : null;
  const label = known?.label ?? d.label?.trim();
  if (!label) return { ok: false as const, error: "Escribí qué se hizo." };
  const [row] = await db
    .insert(schema.healthEvents)
    .values({
      farmId,
      animalId: animal.id,
      sessionId: d.sessionId ?? null,
      control: known ? d.control : `otro:${label.toLowerCase().slice(0, 50)}`,
      label,
      product: d.product || null,
      batch: d.batch || null,
      dose: d.dose || null,
      date: d.date,
      nextDueDate: d.nextDueDate || null,
      vet: d.vet || null,
      notes: d.notes || null,
      clientId: d.clientId ?? null,
      createdBy: userId,
    })
    .onConflictDoNothing({ target: schema.healthEvents.clientId })
    .returning({ id: schema.healthEvents.id });
  if (!row && d.clientId) {
    const [done] = await db.select({ id: schema.healthEvents.id }).from(schema.healthEvents).where(eq(schema.healthEvents.clientId, d.clientId)).limit(1);
    if (done) return { ok: true as const, value: done };
  }
  return row ? { ok: true as const, value: row } : { ok: false as const, error: "No se pudo guardar." };
}

export async function healthHistory(farmId: string, animalId: string) {
  return db
    .select()
    .from(schema.healthEvents)
    .where(and(eq(schema.healthEvents.farmId, farmId), eq(schema.healthEvents.animalId, animalId)))
    .orderBy(sql`${schema.healthEvents.date} desc, ${schema.healthEvents.createdAt} desc`)
    .limit(100);
}

/** Campañas oficiales vigentes o que empiezan en los próximos 15 días, para las especies del campo. */
export async function officialReminders(activeSpecies: string[]) {
  if (!activeSpecies.length) return [];
  const today = todayISO();
  const rows = await db
    .select()
    .from(schema.officialCampaigns)
    .where(sql`${schema.officialCampaigns.endsOn} >= ${today} and ${schema.officialCampaigns.startsOn} <= ${addDays(today, 15)}
      and (${schema.officialCampaigns.species} = 'todas' or ${schema.officialCampaigns.species} in ${activeSpecies})`)
    .orderBy(schema.officialCampaigns.endsOn);
  return rows.map((r) => ({ ...r, started: r.startsOn <= today }));
}
