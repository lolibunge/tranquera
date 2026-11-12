import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFarmAccess } from "@/lib/farms";
import { getMap, listPaddocks } from "@/lib/paddocks";
import { can } from "@/lib/roles";
import { BackLink, PageTitle } from "@/components/ui";
import { FarmMapView } from "@/components/farm-map";
import { MapUpload } from "./upload";
import { deleteMapAction } from "../actions";

export const metadata: Metadata = { title: "Mapa del campo" };

export default async function MapPage({ params }: PageProps<"/c/[slug]/potreros/mapa">) {
  const { slug } = await params;
  const { farm, role } = await getFarmAccess(slug);
  if (!can(role, "configurar")) notFound();
  const [map, paddocks] = await Promise.all([getMap(farm.id), listPaddocks(farm.id)]);
  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/c/${slug}/potreros`} label="Volver" />
      <PageTitle sub="Subí el mapa en SVG (de Illustrator, Inkscape, Figma o Google Earth convertido). Cada forma con nombre se vuelve un potrero.">
        Mapa del campo
      </PageTitle>
      <div className="flex flex-col gap-2 rounded-2xl bg-info-bg px-4 py-3 text-sm leading-relaxed text-info-fg">
        <p className="font-semibold">Cómo preparar el SVG</p>
        <p>Dibujá cada potrero como una forma cerrada y ponele de nombre el del potrero (en Illustrator, el nombre de la capa o del objeto; en Inkscape, la etiqueta). Las formas sin nombre quedan como fondo.</p>
        <p>Si ya hay potreros con ese nombre, se enlazan; los nuevos se crean solos.</p>
      </div>
      <MapUpload slug={slug} />
      {map ? (
        <>
          <FarmMapView map={map} paddocks={paddocks} slug={slug} />
          <form action={deleteMapAction}>
            <input type="hidden" name="slug" value={slug} />
            <button type="submit" className="h-11 w-full rounded-xl text-[15px] font-semibold text-bad-fg hover:bg-bad-bg">
              Quitar el mapa (los potreros quedan)
            </button>
          </form>
        </>
      ) : null}
    </div>
  );
}
