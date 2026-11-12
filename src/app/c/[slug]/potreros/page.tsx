import type { Metadata } from "next";
import Link from "next/link";
import { getFarmAccess } from "@/lib/farms";
import { getMap, listPaddocks, PADDOCK_KINDS } from "@/lib/paddocks";
import { CATALOG, isSpeciesKey } from "@/lib/catalogo";
import { can } from "@/lib/roles";
import { ButtonLink, Card, PageTitle, StatusPill } from "@/components/ui";
import { FarmMapView } from "@/components/farm-map";

export const metadata: Metadata = { title: "Potreros" };

export default async function PaddocksPage({ params }: PageProps<"/c/[slug]/potreros">) {
  const { slug } = await params;
  const { farm, role } = await getFarmAccess(slug);
  const [paddocks, map] = await Promise.all([listPaddocks(farm.id), getMap(farm.id)]);
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

      {map ? <FarmMapView map={map} paddocks={paddocks} slug={slug} /> : null}
      {configure ? (
        <Link href={`/c/${slug}/potreros/mapa`} className="self-start text-[15px] font-semibold text-brand">
          {map ? "Cambiar el mapa" : "Subir el mapa del campo (SVG)"}
        </Link>
      ) : null}

      {paddocks.length ? (
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {paddocks.map((p) => (
            <li key={p.id}>
              <Link href={`/c/${slug}/potreros/${p.id}`} className="flex h-full flex-col gap-1.5 rounded-2xl border border-line bg-surface p-4 hover:border-line-strong">
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
                {p.heads > 0 ? (
                  <span className="text-[13px] text-ink-2">
                    {Object.entries(p.bySpecies)
                      .map(([k, n]) => `${n} ${isSpeciesKey(k) ? CATALOG[k].plural.toLowerCase() : k}`)
                      .join(", ")}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
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
