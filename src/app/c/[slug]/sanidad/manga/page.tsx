import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFarmAccess } from "@/lib/farms";
import { getActiveSpecies } from "@/lib/farm-species";
import { CATALOG, isSpeciesKey } from "@/lib/catalogo";
import { can } from "@/lib/roles";
import { todayISO } from "@/lib/dates";
import { BackLink, PageTitle } from "@/components/ui";
import { NewSessionForm } from "./new-session-form";

export const metadata: Metadata = { title: "Nueva jornada de manga" };

export default async function NewSessionPage({ params, searchParams }: PageProps<"/c/[slug]/sanidad/manga">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { farm, role } = await getFarmAccess(slug);
  if (!can(role, "sanidad")) notFound();
  const options = (await getActiveSpecies(farm.id)).map((s) => s.key).filter((k) => CATALOG[k].mode !== "lote");
  if (!options.length) notFound();
  const species = typeof sp.e === "string" && isSpeciesKey(sp.e) && options.includes(sp.e) ? sp.e : options[0];
  const control = typeof sp.control === "string" ? sp.control : "";
  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/c/${slug}/sanidad`} label="Volver" />
      <PageTitle sub="Vacunas, tacto, inseminación, pesada, esquila… Elegí qué se hace y después pasás el bastón por cada animal.">Jornada de manga</PageTitle>
      <NewSessionForm slug={slug} options={options} species={species} control={control} today={todayISO()} />
    </div>
  );
}
