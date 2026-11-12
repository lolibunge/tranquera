import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFarmAccess } from "@/lib/farms";
import { can } from "@/lib/roles";
import { BackLink, PageTitle } from "@/components/ui";
import { FarmInfoForm } from "./form";

export const metadata: Metadata = { title: "Datos del campo" };

export default async function FarmInfoPage({ params, searchParams }: PageProps<"/c/[slug]/configuracion">) {
  const { slug } = await params;
  const { farm, role } = await getFarmAccess(slug);
  if (!can(role, "configurar")) notFound();
  return (
    <div className="flex flex-col gap-6">
      <BackLink href={(await searchParams).desde === "inicio" ? `/c/${slug}` : `/c/${slug}/mas`} />
      <PageTitle>Datos del campo</PageTitle>
      <FarmInfoForm
        slug={slug}
        initial={{
          name: farm.name,
          location: farm.locationText ?? "",
          latitude: farm.latitude?.toString() ?? "",
          longitude: farm.longitude?.toString() ?? "",
          hectares: farm.hectares?.toString() ?? "",
          dicose: farm.dicose ?? "",
        }}
      />
    </div>
  );
}
