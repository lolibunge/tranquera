import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFarmAccess } from "@/lib/farms";
import { getAnimal } from "@/lib/animals";
import { isSpeciesKey } from "@/lib/catalogo";
import { can } from "@/lib/roles";
import { todayISO } from "@/lib/dates";
import { BackLink, PageTitle } from "@/components/ui";
import { ownerOptions } from "@/lib/owners";
import { AnimalForm } from "../../animal-form";

export const metadata: Metadata = { title: "Editar animal" };

export default async function EditAnimalPage({ params }: PageProps<"/c/[slug]/animales/[id]/editar">) {
  const { slug, id } = await params;
  const { farm, role } = await getFarmAccess(slug);
  if (!can(role, "cargar")) notFound();
  const a = await getAnimal(farm.id, id);
  if (!a || !isSpeciesKey(a.species)) notFound();
  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/c/${slug}/animales/${id}`} label="Cancelar" />
      <PageTitle>Editar</PageTitle>
      <AnimalForm
        slug={slug}
        today={todayISO()}
        owners={can(role, "cuentas") ? await ownerOptions(farm.id) : []}
        initial={{
          id: a.id,
          species: a.species,
          isLot: a.isLot,
          headCount: String(a.headCount),
          category: a.category ?? "",
          name: a.name ?? "",
          tagVisual: a.tagVisual ?? "",
          tagRfid: a.tagRfid ?? "",
          birthDate: a.birthDate ?? "",
          breed: a.breed ?? "",
          origin: (a.origin as "nacido" | "comprado" | null) ?? "",
          originDetail: a.originDetail ?? "",
          arrivedOn: a.arrivedOn ?? "",
          notes: a.notes ?? "",
          paddockId: a.paddockId ?? "",
          ownerId: a.ownerId ?? "",
        }}
      />
    </div>
  );
}
