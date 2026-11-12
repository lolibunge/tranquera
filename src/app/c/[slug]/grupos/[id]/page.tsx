import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFarmAccess } from "@/lib/farms";
import { getActiveSpecies } from "@/lib/farm-species";
import { paddockOptions } from "@/lib/paddocks";
import { pickerAnimals } from "@/lib/picker";
import { getHerd, herdHistory } from "@/lib/herds";
import { CATALOG } from "@/lib/catalogo";
import { formatDate, todayISO } from "@/lib/dates";
import { can } from "@/lib/roles";
import { BackLink, ButtonLink, Card, PageTitle, SectionTitle } from "@/components/ui";
import { HerdForm, MembersForm } from "../forms";
import { archiveHerdAction } from "../actions";

export const metadata: Metadata = { title: "Grupo" };

export default async function HerdPage({ params, searchParams }: PageProps<"/c/[slug]/grupos/[id]">) {
  const { slug, id } = await params;
  const choose = (await searchParams).elegir === "1";
  const { farm, role } = await getFarmAccess(slug);
  const herd = await getHerd(farm.id, id);
  if (!herd) notFound();
  const species = (await getActiveSpecies(farm.id)).map((s) => s.key);
  const [animals, paddocks, history] = await Promise.all([pickerAnimals(farm.id, species), paddockOptions(farm.id), herdHistory(farm.id, herd.id)]);
  const members = animals.filter((a) => herd.memberIds.includes(a.id));
  const canEdit = can(role, "cargar");

  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/c/${slug}/grupos`} label="Grupos" />
      <PageTitle sub={`${herd.heads} cab.${herd.memberIds.length ? ` · ${herd.paddocks.join(", ")}` : ""}`}>{herd.name}</PageTitle>
      {canEdit && herd.memberIds.length ? <ButtonLink href={`/c/${slug}/mover?grupo=${herd.id}`}>Mover el grupo</ButtonLink> : null}

      {choose && canEdit ? (
        <MembersForm
          slug={slug}
          herdId={herd.id}
          today={todayISO()}
          animals={animals}
          species={species.map((k) => ({ key: k, label: CATALOG[k].plural }))}
          paddocks={paddocks}
          preselected={herd.memberIds}
        />
      ) : (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <SectionTitle>Animales</SectionTitle>
            {canEdit ? (
              <Link href={`/c/${slug}/grupos/${herd.id}?elegir=1`} className="py-1 text-[15px] font-semibold text-brand">
                Sumar o sacar
              </Link>
            ) : null}
          </div>
          {members.length ? (
            <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
              {members.map((a) => (
                <li key={a.id} className="border-b border-chip last:border-b-0">
                  <Link href={`/c/${slug}/animales/${a.id}`} className="flex min-h-13 items-center justify-between gap-3 px-4 py-2.5 hover:bg-ground">
                    <span className="flex flex-col">
                      <span className="text-[15px] font-semibold">{a.title}</span>
                      <span className="text-[13px] text-muted">{a.sub}</span>
                    </span>
                    <span className="text-[13px] text-muted">{paddocks.find((p) => p.id === a.paddockId)?.name ?? "Sin potrero"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Card className="text-sm text-ink-2">Todavía no tiene animales.</Card>
          )}
        </section>
      )}

      {history.length ? (
        <section className="flex flex-col gap-2">
          <SectionTitle>Historial</SectionTitle>
          <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
            {history.slice(0, 30).map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-3 border-b border-chip px-4 py-2 text-[14px] last:border-b-0">
                <span>
                  <span className="font-semibold">{e.title}</span> {e.kind === "entra" ? "entró" : "salió"}
                </span>
                <span className="text-muted">{formatDate(e.date)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canEdit ? (
        <details className="rounded-2xl border border-line bg-surface p-4">
          <summary className="cursor-pointer text-[15px] font-semibold">Editar grupo</summary>
          <div className="mt-4 flex flex-col gap-4">
            <HerdForm slug={slug} herd={herd} />
            <form action={archiveHerdAction}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="id" value={herd.id} />
              <button type="submit" className="h-12 w-full rounded-xl border border-line-strong text-[15px] font-semibold text-bad-fg hover:bg-bad-bg">
                Disolver el grupo (el historial queda)
              </button>
            </form>
          </div>
        </details>
      ) : null}
    </div>
  );
}
