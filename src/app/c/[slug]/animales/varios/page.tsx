import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getFarmAccess } from "@/lib/farms";
import { getActiveSpecies } from "@/lib/farm-species";
import { CATALOG, isSpeciesKey } from "@/lib/catalogo";
import { can } from "@/lib/roles";
import { todayISO } from "@/lib/dates";
import { BackLink, PageTitle } from "@/components/ui";
import { ManyForm } from "./form";

export const metadata: Metadata = { title: "Cargar varios" };

export default async function ManyPage({ params, searchParams }: PageProps<"/c/[slug]/animales/varios">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { farm, role } = await getFarmAccess(slug);
  if (!can(role, "cargar")) notFound();
  const active = (await getActiveSpecies(farm.id)).map((s) => s.key).filter((k) => CATALOG[k].mode !== "lote");
  if (!active.length) redirect(`/c/${slug}/animales`);
  const species = typeof sp.e === "string" && isSpeciesKey(sp.e) && active.includes(sp.e) ? sp.e : active[0];
  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/c/${slug}/animales?e=${species}`} label="Volver" />
      <PageTitle sub="Pegá la lista de caravanas o pasá el bastón una tras otra. Todos quedan con la misma categoría.">
        Cargar varios {CATALOG[species].plural.toLowerCase()}
      </PageTitle>
      <ManyForm slug={slug} species={species} today={todayISO()} />
    </div>
  );
}
