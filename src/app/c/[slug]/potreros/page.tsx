import type { Metadata } from "next";
import Link from "next/link";
import { getFarmAccess } from "@/lib/farms";
import { getMap, listPaddocks, PADDOCK_KINDS } from "@/lib/paddocks";
import { CATALOG, isSpeciesKey } from "@/lib/catalogo";
import { can } from "@/lib/roles";
import { ButtonLink, Card, PageTitle, StatusPill } from "@/components/ui";
import { FarmMapView } from "@/components/farm-map";

export const metadata: Metadata = { title: "Potreros" };

function speciesSummary(bySpecies: Record<string, number>) {
  return Object.entries(bySpecies)
    .map(([k, n]) => `${n} ${isSpeciesKey(k) ? CATALOG[k].plural.toLowerCase() : k}`)
    .join(", ");
}

export default async function PaddocksPage({ params, searchParams }: PageProps<"/c/[slug]/potreros">) {
  const { slug } = await params;
  const compact = (await searchParams).vista === "lista";
  const { farm, role } = await getFarmAccess(slug);
  const [all, map] = await Promise.all([listPaddocks(farm.id), getMap(farm.id)]);
  // Primero los que tienen animales, después los que descansan, después el resto.
  const rank = (p: (typeof all)[number]) => (p.heads > 0 ? 0 : p.restDays !== null ? 1 : 2);
  const paddocks = [...all].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "es", { numeric: true }));
  const occupied = paddocks.filter((p) => p.heads > 0).length;
  const totalHa = paddocks.reduce((n, p) => n + (p.hectares ?? 0), 0);
  const configure = can(role, "configurar");
  const load = can(role, "cargar");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <PageTitle sub={paddocks.length ? `${paddocks.length} potreros${totalHa ? ` · ${Math.round(totalHa)} ha` : ""}` : undefined}>Potreros</PageTitle>
        {configure ? (
          <Link href={`/c/${slug}/potreros/nuevo`} aria-label="Agregar potrero" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
        ) : null}
      </div>

      {load && paddocks.length ? <ButtonLink href={`/c/${slug}/mover`}>Mover animales</ButtonLink> : null}
      <Link href={`/c/${slug}/grupos`} className="flex min-h-13 items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
        <span className="flex flex-col">
          <span className="text-[15px] font-semibold">Tropillas y grupos</span>
          <span className="text-[13px] text-muted">Animales que se mueven juntos</span>
        </span>
        <span aria-hidden="true" className="text-muted">›</span>
      </Link>

      {map ? <FarmMapView map={map} paddocks={paddocks} slug={slug} /> : null}
      {configure && map?.shapes.some((sh) => !sh.name && !sh.background) ? (
        <Link href={`/c/${slug}/potreros/mapa/nombrar`} className="inline-flex h-13 items-center justify-center rounded-xl border border-line-strong bg-surface text-base font-semibold">
          Nombrar divisiones del mapa ({map.shapes.filter((sh) => !sh.name && !sh.background).length} sin nombre)
        </Link>
      ) : null}
      {configure ? (
        <Link href={`/c/${slug}/potreros/mapa`} className="self-start text-[15px] font-semibold text-brand">
          {map ? "Cambiar el mapa" : "Subir el mapa del campo (SVG)"}
        </Link>
      ) : null}

      {paddocks.length ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-semibold text-muted">
              {occupied ? `${occupied} con animales · ${paddocks.length - occupied} sin animales` : "Ninguno con animales"}
            </p>
            <div role="group" aria-label="Cómo ver los potreros" className="flex rounded-xl border border-line bg-surface p-0.5 text-[13px] font-semibold">
              <Link href={`/c/${slug}/potreros`} aria-current={!compact ? "true" : undefined} className={`rounded-lg px-3 py-1.5 ${!compact ? "bg-chip text-ink" : "text-muted"}`}>
                Tarjetas
              </Link>
              <Link href={`/c/${slug}/potreros?vista=lista`} aria-current={compact ? "true" : undefined} className={`rounded-lg px-3 py-1.5 ${compact ? "bg-chip text-ink" : "text-muted"}`}>
                Lista
              </Link>
            </div>
          </div>
          {compact ? (
            <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
              {paddocks.map((p) => (
                <li key={p.id} className="border-b border-chip last:border-b-0">
                  <Link href={`/c/${slug}/potreros/${p.id}`} className="flex min-h-13 items-center justify-between gap-3 px-4 py-2.5 hover:bg-ground">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[15px] font-semibold">{p.name}</span>
                      {p.heads > 0 ? <span className="truncate text-[13px] text-ink-2">{speciesSummary(p.bySpecies)}</span> : null}
                    </span>
                    {p.heads > 0 ? (
                      <StatusPill tone="info">{p.heads} cab.</StatusPill>
                    ) : p.restDays !== null ? (
                      <StatusPill tone="ok">Descansa {p.restDays} d</StatusPill>
                    ) : (
                      <span className="shrink-0 text-xs text-muted">Vacío</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {paddocks.map((p) => (
                <li key={p.id}>
                  <Link href={`/c/${slug}/potreros/${p.id}`} className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-4 hover:border-line-strong">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-base font-semibold">{p.name}</span>
                      {p.heads > 0 ? (
                        <StatusPill tone="info">{p.heads} cab.</StatusPill>
                      ) : p.restDays !== null ? (
                        <StatusPill tone="ok">Descansa {p.restDays} d</StatusPill>
                      ) : (
                        <span className="text-xs text-muted">Vacío</span>
                      )}
                    </span>
                    {[p.hectares, p.kind, p.load, p.occupiedDays].some((v) => v !== null && v !== undefined && v !== 0) ? (
                      <span className="text-[13px] text-muted">
                        {[
                          p.hectares ? `${p.hectares} ha` : null,
                          PADDOCK_KINDS.find((k) => k.value === p.kind)?.label,
                          p.load ? `${p.load} cab/ha` : null,
                          p.occupiedDays !== null ? `hace ${p.occupiedDays} días` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : null}
                    {p.heads > 0 ? <span className="text-[13px] text-ink-2">{speciesSummary(p.bySpecies)}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <Card className="flex flex-col gap-2">
          <p className="text-base font-semibold">Todavía no hay potreros</p>
          <p className="text-sm text-ink-2">
            Agregalos uno por uno o subí el mapa del campo en SVG: cada forma con nombre se convierte en un potrero.
          </p>
        </Card>
      )}
    </div>
  );
}
