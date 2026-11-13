import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFarmAccess } from "@/lib/farms";
import { can } from "@/lib/roles";
import { EXPENSE_CATEGORIES, ownerOptions, payers } from "@/lib/owners";
import { getActiveSpecies } from "@/lib/farm-species";
import { pickerAnimals } from "@/lib/picker";
import { paddockOptions } from "@/lib/paddocks";
import { CATALOG } from "@/lib/catalogo";
import { todayISO } from "@/lib/dates";
import { BackLink, PageTitle } from "@/components/ui";
import { NewExpenseForm } from "./form";

export const metadata: Metadata = { title: "Nuevo gasto" };

export default async function NewExpensePage({ params }: PageProps<"/c/[slug]/gastos/nuevo">) {
  const { slug } = await params;
  const { farm, role } = await getFarmAccess(slug);
  if (!can(role, "cuentas")) notFound();
  const askForWhom = farm.hasBoarders || farm.hasPartners;
  const species = (await getActiveSpecies(farm.id)).map((s) => s.key);
  const [people, owners, animals, paddocks] = await Promise.all([
    payers(farm.id),
    askForWhom ? ownerOptions(farm.id) : Promise.resolve([]),
    askForWhom ? pickerAnimals(farm.id, species) : Promise.resolve([]),
    askForWhom ? paddockOptions(farm.id) : Promise.resolve([]),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/c/${slug}/gastos`} label="Gastos" />
      <PageTitle>Nuevo gasto</PageTitle>
      <NewExpenseForm
        slug={slug}
        today={todayISO()}
        categories={EXPENSE_CATEGORIES}
        payers={people}
        askForWhom={askForWhom}
        owners={owners}
        animals={animals}
        species={species.map((k) => ({ key: k, label: CATALOG[k].plural }))}
        paddocks={paddocks}
      />
    </div>
  );
}
