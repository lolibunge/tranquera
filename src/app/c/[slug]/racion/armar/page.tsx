import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFarmAccess } from "@/lib/farms";
import { getActiveSpecies } from "@/lib/farm-species";
import { paddockOptions } from "@/lib/paddocks";
import { pickerAnimals } from "@/lib/picker";
import { SLOTS, speciesPlans } from "@/lib/feeding";
import { listSupplies } from "@/lib/stock";
import { CATALOG, isSpeciesKey } from "@/lib/catalogo";
import { can } from "@/lib/roles";
import { BackLink, Card, PageTitle, SectionTitle } from "@/components/ui";
import { PlanForm } from "../forms";
import { clearPlansAction } from "../actions";
import { SpeciesTabs } from "../species-tabs";

export const metadata: Metadata = { title: "Armar la ración" };

export default async function BuildFeedPage({ params, searchParams }: PageProps<"/c/[slug]/racion/armar">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { farm, role } = await getFarmAccess(slug);
  if (!can(role, "cargar")) notFound();
  const active = (await getActiveSpecies(farm.id)).map((s) => s.key);
  const species = typeof sp.e === "string" && isSpeciesKey(sp.e) && active.includes(sp.e) ? sp.e : active[0];
  if (!species) notFound();
  const info = CATALOG[species];
  const [animals, paddocks, plans, supplies] = await Promise.all([pickerAnimals(farm.id, [species]), paddockOptions(farm.id), speciesPlans(farm.id, species), listSupplies(farm.id)]);
  const feedSupplies = [...supplies].sort((x, y) => Number(y.category === "alimento") - Number(x.category === "alimento") || x.name.localeCompare(y.name, "es"));
  const fed = animals.filter((a) => plans.has(a.id));

  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/c/${slug}/racion?e=${species}`} label="Ración" />
      <PageTitle sub="Elegí los animales, qué comen y en qué turnos. Se puede repetir con otro insumo.">Armar la ración</PageTitle>
      <SpeciesTabs species={active} current={species} href={(k) => `/c/${slug}/racion/armar?e=${k}`} />

      {feedSupplies.length ? (
        <Card className="flex flex-col gap-4">
          <SectionTitle>Agregar {info.plural.toLowerCase()} a la ración</SectionTitle>
          <PlanForm
            slug={slug}
            supplies={feedSupplies.map((s) => ({ id: s.id, name: s.name, unit: s.unit }))}
            slots={SLOTS}
            picker={{ animals, paddocks, species: [{ key: species, label: info.plural }] }}
          />
        </Card>
      ) : (
        <Card className="text-sm leading-relaxed text-ink-2">
          Primero cargá lo que comen (ración, fardos, sales…) en{" "}
          <Link href={`/c/${slug}/stock`} className="font-semibold text-brand">
            Stock de insumos
          </Link>
          .
        </Card>
      )}

      <section className="flex flex-col gap-2">
        <SectionTitle>
          {info.plural} con ración ({fed.length})
        </SectionTitle>
        {fed.length ? (
          <form action={clearPlansAction} className="flex flex-col gap-3">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="species" value={species} />
            <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
              {fed.map((a) => (
                <li key={a.id} className="flex items-center gap-3 border-b border-chip px-4 py-2.5 last:border-b-0">
                  <input type="checkbox" name="animal" value={a.id} aria-label={`Elegir ${a.title}`} className="size-5 shrink-0 accent-brand" />
                  <Link href={`/c/${slug}/animales/${a.id}`} className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[15px] font-semibold">{a.title}</span>
                    <span className="text-[13px] text-muted">{plans.get(a.id)!.join(" · ")}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <button type="submit" className="h-12 rounded-xl border border-line-strong text-[15px] font-semibold text-bad-fg hover:bg-bad-bg">
              Sacar de la ración a los marcados
            </button>
          </form>
        ) : (
          <p className="text-sm text-muted">Todavía ninguno.</p>
        )}
      </section>
    </div>
  );
}
