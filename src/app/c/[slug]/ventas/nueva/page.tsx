import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getFarmAccess } from "@/lib/farms";
import { getActiveSpecies } from "@/lib/farm-species";
import { paddockOptions } from "@/lib/paddocks";
import { CATALOG, categoryOf, formatTag, isSpeciesKey } from "@/lib/catalogo";
import { can } from "@/lib/roles";
import { todayISO } from "@/lib/dates";
import { BackLink, PageTitle } from "@/components/ui";
import { SaleForm } from "./form";

export const metadata: Metadata = { title: "Nueva venta" };

export default async function NewSalePage({ params, searchParams }: PageProps<"/c/[slug]/ventas/nueva">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { farm, role } = await getFarmAccess(slug);
  if (!can(role, "cargar")) notFound();
  const species = (await getActiveSpecies(farm.id)).map((s) => s.key);
  const [paddocks, rows] = await Promise.all([
    paddockOptions(farm.id),
    db
      .select()
      .from(schema.animals)
      .where(and(eq(schema.animals.farmId, farm.id), eq(schema.animals.status, "activo")))
      .orderBy(asc(sql`coalesce(${schema.animals.tagVisual}, ${schema.animals.name})`))
      .limit(5000),
  ]);
  const animals = rows
    .filter((a) => isSpeciesKey(a.species) && species.includes(a.species))
    .map((a) => ({
      id: a.id,
      species: a.species,
      tagVisual: a.tagVisual,
      tagRfid: a.tagRfid,
      paddockId: a.paddockId,
      heads: a.headCount,
      title: a.isLot ? a.name ?? "Lote" : a.tagVisual ? formatTag(a.tagVisual) : a.name ?? formatTag(a.tagRfid),
      sub: isSpeciesKey(a.species) ? (a.isLot ? `Lote · ${a.headCount} cab.` : categoryOf(a.species, a.category)?.label ?? CATALOG[a.species].label) : "",
    }));
  const pre = typeof sp.animal === "string" && animals.some((a) => a.id === sp.animal) ? [sp.animal] : [];
  return (
    <div className="flex flex-col gap-5">
      <BackLink href={pre.length ? `/c/${slug}/animales/${pre[0]}` : `/c/${slug}/ventas`} label="Volver" />
      <PageTitle sub="Elegí los animales de la tropa y los datos de la venta. Quedan como vendidos, con su historial.">Nueva venta</PageTitle>
      <SaleForm
        slug={slug}
        today={todayISO()}
        animals={animals}
        species={species.map((k) => ({ key: k, label: CATALOG[k].plural }))}
        paddocks={paddocks}
        preselected={pre}
      />
    </div>
  );
}
