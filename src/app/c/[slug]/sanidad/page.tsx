import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFarmAccess } from "@/lib/farms";
import { getActiveSpecies } from "@/lib/farm-species";
import { CATALOG, isSpeciesKey } from "@/lib/catalogo";
import { formatDate } from "@/lib/dates";
import { recentSessions } from "@/lib/sessions";
import { can } from "@/lib/roles";
import { ButtonLink, PageTitle, SectionTitle } from "@/components/ui";
import { AttendList } from "@/components/attend-list";
import { SyncStatus } from "@/components/sync-status";

export const metadata: Metadata = { title: "Sanidad" };

export default async function HealthPage({ params }: PageProps<"/c/[slug]/sanidad">) {
  const { slug } = await params;
  const { farm, role } = await getFarmAccess(slug);
  const species = await getActiveSpecies(farm.id);
  if (!species.length) redirect(`/c/${slug}/especies?desde=inicio`);
  const sessions = await recentSessions(farm.id);
  const canManga = can(role, "sanidad") && species.some((s) => CATALOG[s.key].mode !== "lote");

  return (
    <div className="flex flex-col gap-6">
      <PageTitle sub="Vencimientos, campañas oficiales y jornadas de manga.">Sanidad</PageTitle>
      <SyncStatus slug={slug} />
      {canManga ? <ButtonLink href={`/c/${slug}/sanidad/manga`}>Nueva jornada de manga</ButtonLink> : null}

      <section className="flex flex-col gap-3">
        <SectionTitle>Para atender</SectionTitle>
        <AttendList slug={slug} farmId={farm.id} activeSpecies={species.map((s) => s.key)} />
      </section>

      {sessions.length ? (
        <section className="flex flex-col gap-3">
          <SectionTitle>Últimas jornadas</SectionTitle>
          <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
            {sessions.map((s) => (
              <li key={s.id} className="border-b border-chip last:border-b-0">
                <Link href={`/c/${slug}/sanidad/manga/${s.id}`} className="flex flex-col px-4 py-3 hover:bg-ground">
                  <span className="text-[15px] font-semibold">{s.label}</span>
                  <span className="text-[13px] text-muted">
                    {formatDate(s.date)} · {isSpeciesKey(s.species) ? CATALOG[s.species].plural : s.species} · {s.count}{" "}
                    {s.count === 1 ? "animal" : "animales"}
                    {s.closedAt ? "" : " · abierta"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
