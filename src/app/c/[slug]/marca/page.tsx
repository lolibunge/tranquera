import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { backHref, getFarmAccess } from "@/lib/farms";
import { can } from "@/lib/roles";
import { BackLink, PageTitle } from "@/components/ui";
import { BrandForm } from "./form";

export const metadata: Metadata = { title: "Marca" };

export default async function BrandPage({ params, searchParams }: PageProps<"/c/[slug]/marca">) {
  const { slug } = await params;
  const { farm, role } = await getFarmAccess(slug);
  if (!can(role, "configurar")) notFound();
  return (
    <div className="flex flex-col gap-6">
      <BackLink href={backHref(slug, (await searchParams).desde)} />
      <PageTitle sub="Así ve tu equipo el campo: el logo arriba y los colores en botones y pestañas.">Marca</PageTitle>
      <BrandForm slug={slug} name={farm.name} logo={farm.logo} primary={farm.colorPrimary} accent={farm.colorAccent} />
    </div>
  );
}
