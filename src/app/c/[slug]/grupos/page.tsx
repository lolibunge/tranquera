import type { Metadata } from "next";
import Link from "next/link";
import { getFarmAccess } from "@/lib/farms";
import { listHerds } from "@/lib/herds";
import { can } from "@/lib/roles";
import { BackLink, Card, PageTitle, SectionTitle } from "@/components/ui";
import { HerdForm } from "./forms";

export const metadata: Metadata = { title: "Tropillas y grupos" };

export default async function HerdsPage({ params }: PageProps<"/c/[slug]/grupos">) {
  const { slug } = await params;
  const { farm, role } = await getFarmAccess(slug);
  const herds = await listHerds(farm.id);
  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/c/${slug}/potreros`} label="Potreros" />
      <PageTitle sub="Animales que se manejan y se mueven juntos">Tropillas y grupos</PageTitle>
      {herds.length ? (
        <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
          {herds.map((h) => (
            <li key={h.id} className="border-b border-chip last:border-b-0">
              <Link href={`/c/${slug}/grupos/${h.id}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 hover:bg-ground">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[15px] font-semibold">{h.name}</span>
                  <span className="truncate text-[13px] text-muted">{h.memberIds.length ? h.paddocks.join(", ") : "Sin animales"}</span>
                </span>
                <span className="shrink-0 text-[15px] font-semibold tabular-nums">{h.heads} cab.</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="text-sm leading-relaxed text-ink-2">
          Armá grupos con los animales que andan juntos (una tropilla, las yeguas de cría, los de pensión de un dueño). Después los movés de potrero de una sola vez.
        </Card>
      )}
      {can(role, "cargar") ? (
        <Card className="flex flex-col gap-4">
          <SectionTitle>Nuevo grupo</SectionTitle>
          <HerdForm slug={slug} />
        </Card>
      ) : null}
    </div>
  );
}
