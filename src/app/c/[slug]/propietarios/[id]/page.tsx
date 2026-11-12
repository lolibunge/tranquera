import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getFarmAccess } from "@/lib/farms";
import { can } from "@/lib/roles";
import { CATALOG, isSpeciesKey } from "@/lib/catalogo";
import { getOwner, listOwners, OWNER_KINDS, ownerKindLabel, poolShares } from "@/lib/owners";
import { BackLink, ButtonLink, Card, PageTitle, SectionTitle } from "@/components/ui";
import { OwnerForm, SharesForm } from "../forms";
import { archiveOwnerAction } from "../actions";

export const metadata: Metadata = { title: "Propietario" };

export default async function OwnerPage({ params }: PageProps<"/c/[slug]/propietarios/[id]">) {
  const { slug, id } = await params;
  const { farm, role } = await getFarmAccess(slug);
  if (!can(role, "cuentas")) notFound();
  const owner = await getOwner(farm.id, id);
  if (!owner) notFound();
  const [all, shares, bySpecies] = await Promise.all([
    listOwners(farm.id),
    owner.kind === "pozo" ? poolShares(owner.id) : Promise.resolve([]),
    db
      .select({ species: schema.animals.species, heads: sql<number>`sum(${schema.animals.headCount})::int` })
      .from(schema.animals)
      .where(and(eq(schema.animals.farmId, farm.id), eq(schema.animals.ownerId, owner.id), eq(schema.animals.status, "activo")))
      .groupBy(schema.animals.species),
  ]);
  const partners = all.filter((o) => o.kind === "campo" || o.kind === "socio");

  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/c/${slug}/propietarios`} label="Propietarios" />
      <PageTitle sub={ownerKindLabel(owner.kind)}>{owner.name}</PageTitle>

      <Card className="flex flex-col gap-3">
        <SectionTitle>Animales</SectionTitle>
        {bySpecies.length ? (
          <p className="text-[15px]">
            {bySpecies.map((r) => `${r.heads} ${isSpeciesKey(r.species) ? CATALOG[r.species].plural.toLowerCase() : r.species}`).join(", ")}
          </p>
        ) : (
          <p className="text-sm text-ink-2">Todavía no tiene animales asignados.</p>
        )}
        <ButtonLink href={`/c/${slug}/propietarios/${owner.id}/animales`} kind="secondary">
          Elegir sus animales
        </ButtonLink>
      </Card>

      {owner.kind === "pozo" ? (
        <Card className="flex flex-col gap-3">
          <SectionTitle>Parte de cada socio</SectionTitle>
          {partners.length ? (
            <SharesForm slug={slug} poolId={owner.id} partners={partners.map((p) => ({ id: p.id, name: p.name }))} shares={Object.fromEntries(shares.map((s) => [s.partnerId, s.percent]))} />
          ) : (
            <p className="text-sm text-ink-2">
              Primero agregá a los socios (y al campo, si participa) en{" "}
              <Link href={`/c/${slug}/propietarios`} className="font-semibold text-brand">Propietarios</Link>.
            </p>
          )}
        </Card>
      ) : null}

      <details className="rounded-2xl border border-line bg-surface p-4">
        <summary className="cursor-pointer text-[15px] font-semibold">Editar datos</summary>
        <div className="mt-4 flex flex-col gap-4">
          <OwnerForm slug={slug} kinds={OWNER_KINDS} owner={owner} hasFarmOwner={all.some((o) => o.kind === "campo")} />
          <form action={archiveOwnerAction}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={owner.id} />
            <button type="submit" className="h-12 w-full rounded-xl border border-line-strong text-[15px] font-semibold text-bad-fg hover:bg-bad-bg">
              Sacar propietario (sus animales quedan sin asignar)
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}
