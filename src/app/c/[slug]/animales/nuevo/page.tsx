import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getFarmAccess } from "@/lib/farms";
import { getActiveSpecies } from "@/lib/farm-species";
import { CATALOG, isSpeciesKey, normalizeTag } from "@/lib/catalogo";
import { can } from "@/lib/roles";
import { todayISO } from "@/lib/dates";
import { paddockOptions } from "@/lib/paddocks";
import { BackLink, PageTitle } from "@/components/ui";
import { AnimalForm } from "../animal-form";

export const metadata: Metadata = { title: "Nuevo animal" };

export default async function NewAnimalPage({ params, searchParams }: PageProps<"/c/[slug]/animales/nuevo">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { farm, role } = await getFarmAccess(slug);
  if (!can(role, "cargar")) notFound();
  const active = (await getActiveSpecies(farm.id)).map((s) => s.key);
  if (!active.length) redirect(`/c/${slug}/especies?desde=inicio`);
  const read = typeof sp.caravana === "string" ? normalizeTag(sp.caravana).slice(0, 40) : "";
  const isRfid = /^\d{12,20}$/.test(read);
  const species = typeof sp.e === "string" && isSpeciesKey(sp.e) && active.includes(sp.e) ? sp.e : active[0];
  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/c/${slug}/animales?e=${species}`} label="Cancelar" />
      <PageTitle>Nuevo {CATALOG[species].label.toLowerCase()}</PageTitle>
      <AnimalForm
        slug={slug}
        today={todayISO()}
        speciesOptions={active}
        paddocks={await paddockOptions(farm.id)}
        initial={{
          species,
          isLot: CATALOG[species].mode === "lote",
          headCount: "1",
          category: "",
          name: "",
          tagVisual: isRfid ? "" : read,
          tagRfid: isRfid ? read : "",
          birthDate: "",
          breed: "",
          origin: "",
          originDetail: "",
          arrivedOn: "",
          notes: "",
          paddockId: "",
        }}
      />
    </div>
  );
}
