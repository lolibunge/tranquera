import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFarmAccess } from "@/lib/farms";
import { getFarmSpecies } from "@/lib/farm-species";
import { can } from "@/lib/roles";
import { BackLink, PageTitle } from "@/components/ui";
import { SpeciesForm } from "./form";

export const metadata: Metadata = { title: "Especies del campo" };

export default async function SpeciesPage({ params, searchParams }: PageProps<"/c/[slug]/especies">) {
  const { slug } = await params;
  const { farm, role } = await getFarmAccess(slug);
  if (!can(role, "configurar")) notFound();
  const species = await getFarmSpecies(farm.id);
  const from = (await searchParams).desde === "inicio" ? `/c/${slug}` : `/c/${slug}/mas`;
  return (
    <div className="flex flex-col gap-6">
      <BackLink href={from} />
      <PageTitle sub="Lo que marques acá arma el resto de la app: pestañas, categorías, vacunas sugeridas y trámites.">
        Especies del campo
      </PageTitle>
      <SpeciesForm slug={slug} species={species} />
    </div>
  );
}
