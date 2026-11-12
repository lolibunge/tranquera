import type { Metadata } from "next";
import Link from "next/link";
import { getFarmAccess } from "@/lib/farms";
import { getActiveSpecies } from "@/lib/farm-species";
import { calendarMonth, type CalendarItem } from "@/lib/calendar";
import { addDays, formatDayMonth } from "@/lib/dates";
import { can } from "@/lib/roles";
import { BackLink, Card, PageTitle, SectionTitle } from "@/components/ui";
import { TaskForm } from "./task-form";
import { deleteTaskAction, toggleTaskAction } from "./actions";

export const metadata: Metadata = { title: "Calendario" };

const MONTH = new Intl.DateTimeFormat("es-UY", { month: "long", year: "numeric", timeZone: "UTC" });
const WEEKDAY = new Intl.DateTimeFormat("es-UY", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const DOT: Record<CalendarItem["tone"], string> = { bad: "bg-bad-dot", warn: "bg-warn-dot", info: "bg-info-dot", ok: "bg-ok-dot" };
const KIND: Record<CalendarItem["kind"], string> = { sanidad: "Sanidad", campana: "Campaña oficial", tarea: "Tarea" };

function ItemRow({ item, slug, canEdit, showDate }: { item: CalendarItem; slug: string; canEdit: boolean; showDate?: boolean }) {
  const body = (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <span className={`size-2 rounded-full ${DOT[item.tone]}`} aria-hidden="true" />
        {KIND[item.kind]}
        {showDate ? ` · ${formatDayMonth(item.date)}` : ""}
      </span>
      <span className={`text-[15px] font-semibold ${item.done ? "text-muted line-through" : ""}`}>{item.title}</span>
      {item.detail ? <span className="text-[13px] text-ink-2">{item.detail}</span> : null}
    </span>
  );
  return (
    <li className="flex items-center gap-2 border-b border-chip px-4 py-2.5 last:border-b-0">
      {item.href ? (
        <Link href={item.href} className="flex min-w-0 flex-1 items-center gap-2">
          {body}
          <span aria-hidden="true" className="text-muted">›</span>
        </Link>
      ) : (
        body
      )}
      {item.taskId && canEdit ? (
        <span className="flex items-center gap-1">
          <form action={toggleTaskAction}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={item.taskId} />
            <input type="hidden" name="done" value={item.done ? "0" : "1"} />
            <button
              type="submit"
              aria-label={item.done ? "Marcar como pendiente" : "Marcar como hecha"}
              className={`flex size-10 items-center justify-center rounded-xl border ${item.done ? "border-ok-dot bg-ok-bg text-ok-fg" : "border-line-strong text-muted"}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M5 12l5 5L19 7" />
              </svg>
            </button>
          </form>
          <form action={deleteTaskAction}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={item.taskId} />
            <button type="submit" aria-label="Borrar tarea" className="flex size-10 items-center justify-center rounded-xl text-muted hover:bg-chip">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </form>
        </span>
      ) : null}
    </li>
  );
}

export default async function CalendarPage({ params, searchParams }: PageProps<"/c/[slug]/calendario">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { farm, role } = await getFarmAccess(slug);
  const species = (await getActiveSpecies(farm.id)).map((s) => s.key);
  const cal = await calendarMonth(farm.id, species, slug, typeof sp.mes === "string" ? sp.mes : undefined);
  const canEdit = can(role, "cargar");
  const base = `/c/${slug}/calendario`;
  const fromHome = sp.desde === "inicio";
  const keep = fromHome ? "&desde=inicio" : "";

  // Grilla del mes empezando en lunes.
  const startDow = (new Date(`${cal.first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const daysInMonth = Number(cal.last.slice(8));
  const cells: (string | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => addDays(cal.first, i))];
  const byDay = new Map<string, CalendarItem[]>();
  for (const it of cal.items) byDay.set(it.date, [...(byDay.get(it.date) ?? []), it]);
  const inCampaign = (d: string) => cal.campaigns.some((c) => c.startsOn <= d && c.endsOn >= d);
  const days = [...byDay.keys()].sort();

  return (
    <div className="flex flex-col gap-5">
      <BackLink href={fromHome ? `/c/${slug}` : `/c/${slug}/mas`} label="Volver" />
      <PageTitle sub="Vencimientos de sanidad, campañas oficiales y tareas">Calendario</PageTitle>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Link href={`${base}?mes=${cal.prev}${keep}`} aria-label="Mes anterior" className="flex size-10 items-center justify-center rounded-xl hover:bg-chip">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </Link>
          <span className="text-base font-semibold first-letter:uppercase">{MONTH.format(new Date(`${cal.first}T12:00:00Z`))}</span>
          <Link href={`${base}?mes=${cal.next}${keep}`} aria-label="Mes siguiente" className="flex size-10 items-center justify-center rounded-xl hover:bg-chip">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted" aria-hidden="true">
          {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} />;
            const list = byDay.get(d) ?? [];
            const tones = [...new Set(list.map((x) => x.tone))].slice(0, 3);
            const isToday = d === cal.today;
            const content = (
              <>
                <span className={`text-sm tabular-nums ${isToday ? "flex size-7 items-center justify-center rounded-full bg-brand font-semibold text-white" : ""}`}>{Number(d.slice(8))}</span>
                <span className="flex h-1.5 gap-0.5">
                  {tones.map((t) => (
                    <span key={t} className={`size-1.5 rounded-full ${DOT[t]}`} />
                  ))}
                </span>
              </>
            );
            const cls = `flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg ${inCampaign(d) ? "bg-info-bg/60" : ""}`;
            return list.length ? (
              <a key={d} href={`#d-${d}`} className={`${cls} hover:bg-chip`} aria-label={`${formatDayMonth(d)}: ${list.length} ${list.length === 1 ? "cosa" : "cosas"}`}>
                {content}
              </a>
            ) : (
              <span key={d} className={cls}>
                {content}
              </span>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className={`size-2 rounded-full ${DOT.bad}`} /> Atrasado</span>
          <span className="flex items-center gap-1.5"><span className={`size-2 rounded-full ${DOT.warn}`} /> Próximos 14 días</span>
          <span className="flex items-center gap-1.5"><span className={`size-2 rounded-full ${DOT.info}`} /> Más adelante</span>
          {cal.campaigns.length ? <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-info-bg" /> Campaña</span> : null}
        </div>
      </Card>

      {cal.overdue.length ? (
        <section className="flex flex-col gap-2">
          <SectionTitle>Atrasado</SectionTitle>
          <ul className="flex flex-col overflow-hidden rounded-2xl border border-bad-dot/30 bg-surface">
            {cal.overdue.map((it, i) => (
              <ItemRow key={`o${i}`} item={it} slug={slug} canEdit={canEdit} showDate />
            ))}
          </ul>
        </section>
      ) : null}

      {days.length ? (
        days.map((d) => (
          <section key={d} id={`d-${d}`} className="flex scroll-mt-4 flex-col gap-2">
            <SectionTitle>
              <span className="first-letter:uppercase">{d === cal.today ? `Hoy, ${formatDayMonth(d)}` : WEEKDAY.format(new Date(`${d}T12:00:00Z`))}</span>
            </SectionTitle>
            <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
              {byDay.get(d)!.map((it, i) => (
                <ItemRow key={i} item={it} slug={slug} canEdit={canEdit} />
              ))}
            </ul>
          </section>
        ))
      ) : (
        <Card className="text-sm text-ink-2">No hay nada agendado este mes.</Card>
      )}

      {canEdit ? (
        <Card className="flex flex-col gap-4">
          <SectionTitle>Agregar tarea</SectionTitle>
          <TaskForm slug={slug} defaultDate={cal.month === cal.today.slice(0, 7) ? cal.today : cal.first} />
        </Card>
      ) : null}
    </div>
  );
}
