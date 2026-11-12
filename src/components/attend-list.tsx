import Link from "next/link";
import { CATALOG, isSpeciesKey } from "@/lib/catalogo";
import { formatDayMonth, relativeDays, todayISO } from "@/lib/dates";
import { officialReminders, pendingAlerts } from "@/lib/health";
import { Card, StatusPill } from "./ui";

/** "Para atender": campañas oficiales + controles vencidos o por vencer. */
export async function AttendList({ slug, farmId, activeSpecies }: { slug: string; farmId: string; activeSpecies: string[] }) {
  const [official, alerts] = await Promise.all([officialReminders(activeSpecies), pendingAlerts(farmId)]);
  const today = todayISO();
  const visible = alerts.filter((a) => activeSpecies.includes(a.species));

  if (!official.length && !visible.length) {
    return (
      <Card className="flex flex-col gap-2">
        <p className="text-base font-semibold">Todo al día</p>
        <p className="text-sm leading-relaxed text-ink-2">
          {activeSpecies.length
            ? "No hay vacunas ni controles vencidos o por vencer en las próximas dos semanas."
            : "Acá van a aparecer los vencimientos de sanidad y las campañas oficiales, a medida que se carguen los animales."}
        </p>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {official.map((c) => (
        <li key={c.id}>
          <Card className="flex flex-col gap-2">
            <StatusPill tone={c.started ? "warn" : "info"}>
              {c.started ? `Termina el ${formatDayMonth(c.endsOn)}` : `Empieza el ${formatDayMonth(c.startsOn)}`}
            </StatusPill>
            <p className="text-base font-semibold">{c.title}</p>
            {c.detail ? <p className="text-sm leading-snug text-ink-2">{c.detail}</p> : null}
            {c.control !== "dicose" && isSpeciesKey(c.species) ? (
              <Link href={`/c/${slug}/sanidad/manga?e=${c.species}&control=${c.control}`} className="self-start py-1 text-[15px] font-semibold text-brand">
                Abrir jornada de manga
              </Link>
            ) : null}
          </Card>
        </li>
      ))}
      {visible.map((a) => {
        const plural = isSpeciesKey(a.species) ? CATALOG[a.species].plural.toLowerCase() : "animales";
        const href =
          a.animals === 1 ? `/c/${slug}/animales/${a.oneAnimalId}` : `/c/${slug}/sanidad/pendientes?e=${a.species}&control=${encodeURIComponent(a.control)}`;
        return (
          <li key={`${a.species}-${a.control}-${a.tone}`}>
            <Link href={href} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 hover:border-line-strong">
              <StatusPill tone={a.tone === "bad" ? "bad" : "warn"}>
                {a.tone === "bad" ? `Vencido ${relativeDays(a.nextDue, today)}` : `Vence ${relativeDays(a.nextDue, today)}`}
              </StatusPill>
              <span className="text-base font-semibold">{a.label}</span>
              <span className="text-sm text-ink-2">
                {a.animals === 1 ? "1 animal" : `${a.heads} ${plural}`}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
