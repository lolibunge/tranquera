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
import { MoveForm } from "./form";
import { listHerds } from "@/lib/herds";

export const metadata: Metadata = { title: "Mover animales" };

export default async function MovePage({ params, searchParams }: PageProps<"/c/[slug]/mover">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { farm, role } = await getFarmAccess(slug);
  if (!can(role, "cargar")) notFound();
  const species = (await getActiveSpecies(farm.id)).map((s) => s.key);
  const [paddocks, herds, rows] = await Promise.all([
    paddockOptions(farm.id),
    listHerds(farm.id),
    db
      .select({
        id: schema.animals.id,
        species: schema.animals.species,
        tagVisual: schema.animals.tagVisual,
        tagRfid: schema.animals.tagRfid,
        name: schema.animals.name,
        category: schema.animals.category,
        isLot: schema.animals.isLot,
        headCount: schema.animals.headCount,
        paddockId: schema.animals.paddockId,
      })
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
      category: a.category,
      heads: a.headCount,
      title: a.isLot ? a.name ?? "Lote" : a.tagVisual ? formatTag(a.tagVisual) : a.name ?? formatTag(a.tagRfid),
      sub: isSpeciesKey(a.species) ? (a.isLot ? `Lote · ${a.headCount} cab.` : categoryOf(a.species, a.category)?.label ?? CATALOG[a.species].label) : "",
    }));
  const from = typeof sp.desde === "string" && paddocks.some((p) => p.id === sp.desde) ? sp.desde : "";
  const herd = typeof sp.grupo === "string" ? herds.find((h) => h.id === sp.grupo) : undefined;
  const to = typeof sp.hacia === "string" && paddocks.some((p) => p.id === sp.hacia) ? sp.hacia : "";

  return (
    <div className="flex flex-col gap-5">
      <BackLink href={herd ? `/c/${slug}/grupos/${herd.id}` : from ? `/c/${slug}/potreros/${from}` : to ? `/c/${slug}/potreros/${to}` : `/c/${slug}/potreros`} label="Volver" />
      <PageTitle sub="Elegí el potrero de destino y los animales. También podés pasar el bastón para sumarlos.">Mover animales</PageTitle>
      <MoveForm
        slug={slug}
        today={todayISO()}
        paddocks={paddocks}
        species={species.map((k) => ({ key: k, label: CATALOG[k].plural }))}
        animals={animals}
        initialFrom={from}
        initialTo={to}
        herds={herds.filter((h) => h.memberIds.length).map((h) => ({ id: h.id, name: h.name, memberIds: h.memberIds }))}
        initialHerd={herd?.id}
      />
    </div>
  );
}
