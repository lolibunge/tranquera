import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { backHref, getFarmAccess } from "@/lib/farms";
import { getMap, listPaddocks } from "@/lib/paddocks";
import { can } from "@/lib/roles";
import { BackLink, PageTitle } from "@/components/ui";
import { FarmMapView } from "@/components/farm-map";
import { MapUpload, UnmappedList } from "./upload";
import Link from "next/link";
import { deleteMapAction } from "../actions";

export const metadata: Metadata = { title: "Mapa del campo" };

export default async function MapPage({ params, searchParams }: PageProps<"/c/[slug]/potreros/mapa">) {
  const { slug } = await params;
  const back = backHref(slug, (await searchParams).desde, `/c/${slug}/potreros`);
  const { farm, role } = await getFarmAccess(slug);
  if (!can(role, "configurar")) notFound();
  const [map, paddocks] = await Promise.all([getMap(farm.id), listPaddocks(farm.id)]);
  const unmapped = paddocks.filter((p) => !p.svgId);
  return (
    <div className="flex flex-col gap-5">
      <BackLink href={back} label="Volver" />
      <PageTitle sub="Subí el mapa en SVG (de Illustrator, Inkscape, Figma o Google Earth convertido). Cada forma con nombre se vuelve un potrero.">
        Mapa del campo
      </PageTitle>
      <div className="flex flex-col gap-2 rounded-2xl bg-info-bg px-4 py-3 text-sm leading-relaxed text-info-fg">
        <p className="font-semibold">Cómo preparar el SVG</p>
        <p>Cada potrero tiene que ser una forma cerrada. Los nombres se toman del nombre de la forma (capa u objeto en Illustrator, etiqueta en Inkscape) o de un texto escrito adentro de la división.</p>
        <p>Si el mapa no trae nombres, después de subirlo tocás cada división y le ponés el nombre.</p>
        <p>Si ya hay potreros con ese nombre, se enlazan; los nuevos se crean solos.</p>
      </div>
      <MapUpload slug={slug} />
      {map ? (
        <>
          {map.shapes.some((sh) => !sh.name && !sh.background) ? (
            <Link href={`/c/${slug}/potreros/mapa/nombrar`} className="inline-flex h-13 items-center justify-center rounded-xl bg-brand text-base font-semibold text-white">
              Nombrar las divisiones ({map.shapes.filter((sh) => !sh.name && !sh.background).length} sin nombre)
            </Link>
          ) : (
            <Link href={`/c/${slug}/potreros/mapa/nombrar`} className="self-start text-[15px] font-semibold text-brand">
              Cambiar nombres en el mapa
            </Link>
          )}
          <FarmMapView map={map} paddocks={paddocks} slug={slug} />
          {unmapped.length ? <UnmappedList slug={slug} items={unmapped.map((p) => ({ name: p.name, heads: p.heads }))} /> : null}
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
