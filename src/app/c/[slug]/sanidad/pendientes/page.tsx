import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFarmAccess } from "@/lib/farms";
import { CATALOG, categoryOf, formatTag, isSpeciesKey } from "@/lib/catalogo";
import { healthByAnimal } from "@/lib/health";
import { rosterFor } from "@/lib/sessions";
import { formatDate, relativeDays, todayISO } from "@/lib/dates";
import { can } from "@/lib/roles";
import { BackLink, ButtonLink, PageTitle, StatusPill } from "@/components/ui";

export const metadata: Metadata = { title: "Pendientes" };

export default async function PendingPage({ params, searchParams }: PageProps<"/c/[slug]/sanidad/pendientes">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { farm, role } = await getFarmAccess(slug);
  const species = typeof sp.e === "string" && isSpeciesKey(sp.e) ? sp.e : null;
  const control = typeof sp.control === "string" ? sp.control : null;
  if (!species || !control) notFound();
  const today = todayISO();
  const [roster, health] = await Promise.all([rosterFor(farm.id, species), healthByAnimal(farm.id)]);
  const items = roster
    .map((a) => ({ a, state: health.get(a.id)?.states.find((s) => s.control === control) }))
    .filter((x) => x.state && x.state.tone !== "ok")
    .sort((x, y) => (x.state!.nextDue ?? "").localeCompare(y.state!.nextDue ?? ""));
  const label = items[0]?.state?.label ?? CATALOG[species].controls.find((c) => c.key === control)?.label ?? "Control";

  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/c/${slug}/sanidad`} label="Volver" />
      <PageTitle sub={`${CATALOG[species].plural} con este control vencido o por vencer.`}>{label}</PageTitle>
      {can(role, "sanidad") && CATALOG[species].mode !== "lote" && !control.startsWith("otro:") ? (
        <ButtonLink href={`/c/${slug}/sanidad/manga?e=${species}&control=${encodeURIComponent(control)}`}>Hacer jornada de manga</ButtonLink>
      ) : null}
      <ul className="flex flex-col gap-2">
        {items.map(({ a, state }) => (
          <li key={a.id}>
            <Link href={`/c/${slug}/animales/${a.id}`} className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-2.5">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-base font-semibold tabular-nums">{a.tagVisual ? formatTag(a.tagVisual) : a.name ?? formatTag(a.tagRfid)}</span>
                <span className="truncate text-[13px] text-muted">
                  {a.isLot ? `Lote · ${a.headCount} cabezas` : categoryOf(species, a.category)?.label} · {formatDate(state!.nextDue)}
                </span>
              </span>
              <StatusPill tone={state!.tone}>{state!.tone === "bad" ? `Vencido ${relativeDays(state!.nextDue!, today)}` : relativeDays(state!.nextDue!, today)}</StatusPill>
            </Link>
          </li>
        ))}
      </ul>
      {!items.length ? <p className="text-sm text-muted">No hay pendientes.</p> : null}
    </div>
  );
}
