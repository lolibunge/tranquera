import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFarmAccess } from "@/lib/farms";
import { CATALOG, categoryOf, formatTag, isSpeciesKey } from "@/lib/catalogo";
import { can } from "@/lib/roles";
import { formatDate } from "@/lib/dates";
import { getSession, rosterFor, sessionRecords } from "@/lib/sessions";
import { BackLink } from "@/components/ui";
import { MangaRunner } from "./runner";

export const metadata: Metadata = { title: "Jornada de manga" };

export default async function SessionPage({ params }: PageProps<"/c/[slug]/sanidad/manga/[id]">) {
  const { slug, id } = await params;
  const { farm, role } = await getFarmAccess(slug);
  const session = await getSession(farm.id, id);
  if (!session || !isSpeciesKey(session.species)) notFound();
  const species = session.species;
  const [roster, records] = await Promise.all([rosterFor(farm.id, species), sessionRecords(session.id)]);
  const animals = roster
    .filter((a) => !a.isLot)
    .map((a) => ({
      id: a.id,
      tagVisual: a.tagVisual,
      tagRfid: a.tagRfid,
      title: a.tagVisual ? formatTag(a.tagVisual) : a.name ?? formatTag(a.tagRfid),
      sub: [categoryOf(species, a.category)?.label, a.tagVisual ? a.name : null].filter(Boolean).join(" · "),
    }));
  const details = [session.product, session.batch ? `serie ${session.batch}` : null, session.dose, formatDate(session.date)].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <BackLink href={`/c/${slug}/sanidad`} label="Volver a Sanidad" />
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] font-bold leading-tight">{session.label}</h1>
        <p className="text-[15px] text-ink-2">
          {CATALOG[species].plural}
          {details ? ` · ${details}` : ""}
        </p>
      </div>
      <MangaRunner
        slug={slug}
        sessionId={session.id}
        closed={Boolean(session.closedAt)}
        canWrite={can(role, "sanidad")}
        animals={animals}
        recorded={records.map((r) => ({ animalId: r.animalId, clientId: r.clientId }))}
        newAnimalHref={`/c/${slug}/animales/nuevo?e=${species}`}
      />
    </div>
  );
}
