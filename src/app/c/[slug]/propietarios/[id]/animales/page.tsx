import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFarmAccess } from "@/lib/farms";
import { getActiveSpecies } from "@/lib/farm-species";
import { paddockOptions } from "@/lib/paddocks";
import { pickerAnimals } from "@/lib/picker";
import { getOwner } from "@/lib/owners";
import { CATALOG } from "@/lib/catalogo";
import { can } from "@/lib/roles";
import { BackLink, PageTitle } from "@/components/ui";
import { AssignForm } from "../../forms";

export const metadata: Metadata = { title: "Animales del propietario" };

export default async function AssignPage({ params }: PageProps<"/c/[slug]/propietarios/[id]/animales">) {
  const { slug, id } = await params;
  const { farm, role } = await getFarmAccess(slug);
  if (!can(role, "cuentas")) notFound();
  const owner = await getOwner(farm.id, id);
  if (!owner) notFound();
  const species = (await getActiveSpecies(farm.id)).map((s) => s.key);
  const [animals, paddocks] = await Promise.all([pickerAnimals(farm.id, species), paddockOptions(farm.id)]);
  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/c/${slug}/propietarios/${owner.id}`} label={owner.name} />
      <PageTitle sub="Marcá los animales que son de este propietario. Los que desmarques quedan sin asignar.">Animales de {owner.name}</PageTitle>
      <AssignForm
        slug={slug}
        ownerId={owner.id}
        animals={animals}
        species={species.map((k) => ({ key: k, label: CATALOG[k].plural }))}
        paddocks={paddocks}
        preselected={animals.filter((a) => a.ownerId === owner.id).map((a) => a.id)}
        others={animals.filter((a) => a.ownerId && a.ownerId !== owner.id).length}
      />
    </div>
  );
}
