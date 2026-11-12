import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getFarmAccess } from "@/lib/farms";
import { getMap, paddockOptions } from "@/lib/paddocks";
import { can } from "@/lib/roles";
import { BackLink, PageTitle } from "@/components/ui";
import { MapNamer } from "./namer";

export const metadata: Metadata = { title: "Nombrar potreros en el mapa" };

export default async function NameMapPage({ params }: PageProps<"/c/[slug]/potreros/mapa/nombrar">) {
  const { slug } = await params;
  const { farm, role } = await getFarmAccess(slug);
  if (!can(role, "configurar")) notFound();
  const map = await getMap(farm.id);
  if (!map) redirect(`/c/${slug}/potreros/mapa`);
  const paddocks = await paddockOptions(farm.id);
  return (
    <div className="flex flex-col gap-4">
      <BackLink href={`/c/${slug}/potreros`} label="Volver" />
      <PageTitle sub="Tocá cada división del mapa y ponele el nombre del potrero. Si no es un potrero (camino, casco, monte), marcala como fondo.">
        Nombrar potreros
      </PageTitle>
      <MapNamer slug={slug} map={map} paddocks={paddocks.map((p) => p.name)} />
    </div>
  );
}
