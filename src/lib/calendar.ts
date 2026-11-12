import "server-only";
import { and, asc, eq, gte, isNull, lt, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { addDays, isISODate, todayISO } from "./dates";

/** "2026-11" → primer y último día del mes, y los meses vecinos. */
export function monthRange(month: string | undefined, today = todayISO()) {
  const m = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : today.slice(0, 7);
  const [y, mo] = m.split("-").map(Number);
  const first = `${m}-01`;
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  const prev = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
  const last = addDays(`${next}-01`, -1);
  return { month: m, first, last, next, prev };
}

export type CalendarItem = {
  date: string;
  kind: "sanidad" | "campana" | "tarea";
  title: string;
  detail?: string;
  href?: string;
  tone: "bad" | "warn" | "info" | "ok";
  taskId?: string;
  done?: boolean;
};

/** Vencimientos de sanidad (última aplicación de cada control en animales activos), agrupados por día. */
async function dueHealth(farmId: string, from: string | null, to: string) {
  const rows = await db.execute<{ especie: string; control: string; titulo: string; proxima: string; cabezas: number; animales: number; un_id: string }>(sql`
    with ultimos as (
      select distinct on (s.animal_id, s.control)
        s.animal_id, s.control, s.titulo, s.proxima
      from ${schema.healthEvents} s
      join ${schema.animals} a on a.id = s.animal_id and a.estado = 'activo'
      where s.campo_id = ${farmId}
      order by s.animal_id, s.control, s.fecha desc, s.created_at desc
    )
    select a.especie, u.control, min(u.titulo) as titulo, u.proxima::text as proxima,
           sum(a.cabezas)::int as cabezas, count(*)::int as animales, min(a.id::text) as un_id
    from ultimos u join ${schema.animals} a on a.id = u.animal_id
    where u.proxima is not null and u.proxima <= ${to} ${from ? sql`and u.proxima >= ${from}` : sql``}
    group by a.especie, u.control, u.proxima
    order by u.proxima
  `);
  return [...rows];
}

export async function calendarMonth(farmId: string, activeSpecies: string[], slug: string, month?: string) {
  const today = todayISO();
  const range = monthRange(month, today);
  const { first, last } = range;
  const base = `/c/${slug}`;
  const isCurrent = range.month === today.slice(0, 7);
  const plural = (n: number) => (n === 1 ? "1 animal" : `${n} animales`);

  const [health, overdueHealth, campaigns, tasks, overdueTasks] = await Promise.all([
    dueHealth(farmId, first, last),
    isCurrent ? dueHealth(farmId, null, addDays(first, -1)) : Promise.resolve([]),
    activeSpecies.length
      ? db
          .select()
          .from(schema.officialCampaigns)
          .where(
            sql`${schema.officialCampaigns.startsOn} <= ${last} and ${schema.officialCampaigns.endsOn} >= ${first}
            and (${schema.officialCampaigns.species} = 'todas' or ${schema.officialCampaigns.species} in ${activeSpecies})`,
          )
          .orderBy(asc(schema.officialCampaigns.startsOn))
      : Promise.resolve([]),
    db
      .select()
      .from(schema.tasks)
      .where(and(eq(schema.tasks.farmId, farmId), gte(schema.tasks.date, first), lte(schema.tasks.date, last)))
      .orderBy(asc(schema.tasks.date), asc(schema.tasks.createdAt)),
    isCurrent
      ? db
          .select()
          .from(schema.tasks)
          .where(and(eq(schema.tasks.farmId, farmId), lt(schema.tasks.date, first), isNull(schema.tasks.doneAt)))
          .orderBy(asc(schema.tasks.date))
      : Promise.resolve([]),
  ]);

  const healthItem = (r: (typeof health)[number]): CalendarItem => ({
    date: r.proxima,
    kind: "sanidad",
    title: r.titulo,
    detail: plural(r.animales === 1 ? 1 : r.cabezas),
    href: r.animales === 1 ? `${base}/animales/${r.un_id}` : `${base}/sanidad/pendientes?e=${r.especie}&control=${encodeURIComponent(r.control)}`,
    tone: r.proxima < today ? "bad" : r.proxima <= addDays(today, 14) ? "warn" : "info",
  });
  const taskItem = (t: (typeof tasks)[number]): CalendarItem => ({
    date: t.date,
    kind: "tarea",
    title: t.title,
    detail: t.notes ?? undefined,
    tone: t.doneAt ? "ok" : t.date < today ? "bad" : "info",
    taskId: t.id,
    done: Boolean(t.doneAt),
  });

  const items: CalendarItem[] = [...health.map(healthItem), ...tasks.map(taskItem)];
  for (const c of campaigns) {
    if (c.startsOn >= first) items.push({ date: c.startsOn, kind: "campana", title: `Empieza: ${c.title}`, detail: c.detail ?? undefined, tone: "info" });
    if (c.endsOn <= last) items.push({ date: c.endsOn, kind: "campana", title: `Termina: ${c.title}`, detail: c.detail ?? undefined, tone: c.endsOn >= today ? "warn" : "info" });
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));

  // Lo atrasado (de antes de este mes, o de días ya pasados de este mes) se junta arriba.
  const overdue: CalendarItem[] = [
    ...overdueHealth.map(healthItem),
    ...overdueTasks.map(taskItem),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return {
    ...range,
    today,
    items,
    overdue,
    campaigns: campaigns.map((c) => ({ id: c.id, title: c.title, startsOn: c.startsOn, endsOn: c.endsOn, detail: c.detail })),
  };
}

/** Próximos días (para Inicio): cuántas cosas hay en la semana. */
export async function upcomingCount(farmId: string) {
  const today = todayISO();
  const [h, t] = await Promise.all([
    dueHealth(farmId, today, addDays(today, 7)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.tasks)
      .where(and(eq(schema.tasks.farmId, farmId), gte(schema.tasks.date, today), lte(schema.tasks.date, addDays(today, 7)), isNull(schema.tasks.doneAt))),
  ]);
  return h.length + (t[0]?.n ?? 0);
}

export const taskInput = z.object({
  date: z.string().refine(isISODate, "Revisá la fecha."),
  title: z.string().trim().min(2, "Escribí qué hay que hacer.").max(120),
  notes: z.string().trim().max(500).optional(),
});

export async function createTask(farmId: string, userId: string, raw: z.input<typeof taskInput>) {
  const parsed = taskInput.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;
  await db.insert(schema.tasks).values({ farmId, date: d.date, title: d.title, notes: d.notes || null, createdBy: userId });
  return { ok: true as const };
}

export async function setTaskDone(farmId: string, id: string, done: boolean) {
  if (!z.string().uuid().safeParse(id).success) return;
  await db
    .update(schema.tasks)
    .set({ doneAt: done ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(schema.tasks.id, id), eq(schema.tasks.farmId, farmId)));
}

export async function deleteTask(farmId: string, id: string) {
  if (!z.string().uuid().safeParse(id).success) return;
  await db.delete(schema.tasks).where(and(eq(schema.tasks.id, id), eq(schema.tasks.farmId, farmId)));
}
