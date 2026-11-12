import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { BackLink, PageTitle } from "@/components/ui";
import { CreateFarmForm } from "./form";

export const metadata: Metadata = { title: "Crear campo" };

export default async function NewFarmPage() {
  await requireUser("/campos/nuevo");
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-6">
      <BackLink href="/campos?todos" />
      <PageTitle sub="Después podés sumar el logo, los colores, las especies y a tu equipo.">Crear un campo</PageTitle>
      <CreateFarmForm />
    </main>
  );
}
