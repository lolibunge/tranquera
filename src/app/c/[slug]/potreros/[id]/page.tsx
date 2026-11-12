import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getFarmAccess } from "@/lib/farms";
import { listPaddocks, PADDOCK_KINDS } from "@/lib/paddocks";
import { CATALOG, categoryOf, formatTag, isSpeciesKey } from "@/lib/catalogo";
import { formatDate } from "@/lib/dates";
import { can } from "@/lib/roles";
import { BackLink, ButtonLink, Card, SectionTitle } from "@/components/ui";
import { PaddockForm } from "../paddock-form";
import { archivePaddockAction } from "../actions";

export const metadata: Metadata = { title: "Potrero" };

export default async function PaddockPage({ params }: PageProps<"/c/[slug]/potreros/[id]">) {
  const { slug, id } = await params;
  const { farm, role } = await getFarmAccess(slug);
  const p = (await listPaddocks(farm.id)).find((x) => x.id === id);
  if (!p) notFound();

  const [animals, history] = await Promise.all([
    db
      .select({
        id: schema.animals.id,
        species: schema.animals.species,
        tagVisual: schema.animals.tagVisual,
        tagRfid: schema.animals.tagRfid,
        name: schema.animals.name,
        category: schema.animals.category,
        isLot: schema.animals.isLot,
        headCount: schema.animals.headCount,
      })
      .from(schema.animals)
      .where(and(eq(schema.animals.farmId, farm.id), eq(schema.animals.paddockId, id), eq(schema.animals.status, "activo")))
      .orderBy(asc(schema.animals.species), asc(sql`coalesce(${schema.animals.tagVisual}, ${schema.animals.name})`)),
    db
      .select({
        batchId: schema.movements.batchId,
        date: schema.movements.date,
        count: sql<number>`count(*)::int`,
        entered: sql<boolean>`bool_or(${schema.movements.toPaddockId} = ${id})`,
        other: sql<string | null>`min((select nombre from ${schema.paddocks} p where p.id = case when ${schema.movements.toPaddockId} = ${id} then ${schema.movements.fromPaddockId} else ${schema.movements.toPaddockId} end))`,
      })
      .from(schema.movements)
      .where(and(eq(schema.movements.farmId, farm.id), or(eq(schema.movements.toPaddockId, id), eq(schema.movements.fromPaddockId, id))))
      .groupBy(schema.movements.batchId, schema.movements.date)
      .orderBy(desc(schema.movements.date))
      .limit(30),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/c/${slug}/potreros`} label="Volver" />
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] font-bold leading-tight">{p.name}</h1>
        <p className="text-[15px] text-ink-2">
          {[p.hectares ? `${p.hectares} ha` : null, PADDOCK_KINDS.find((k) => k.value === p.kind)?.label, p.load ? `${p.load} cabezas por ha` : null]
            .filter(Boolean)
            .join(" · ") || "Sin datos de superficie"}
        </p>
        <p className="text-[15px] font-semibold">
          {p.heads > 0
            ? `${p.heads} cabezas${p.occupiedDays !== null ? ` · entraron hace ${p.occupiedDays} días` : ""}`
            : p.restDays !== null
              ? `Vacío · descansa hace ${p.restDays} días`
              : "Vacío"}
        </p>
      </div>

      {can(role, "cargar") ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {animals.length ? <ButtonLink href={`/c/${slug}/mover?desde=${id}`}>Sacar o mover estos animales</ButtonLink> : null}
          <ButtonLink href={`/c/${slug}/mover?hacia=${id}`} kind="secondary">
            Traer animales acá
          </ButtonLink>
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <SectionTitle>Animales</SectionTitle>
        {animals.length ? (
          <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
            {animals.slice(0, 300).map((a) => (
              <li key={a.id} className="border-b border-chip last:border-b-0">
                <Link href={`/c/${slug}/animales/${a.id}`} className="flex justify-between gap-3 px-4 py-2.5 hover:bg-ground">
                  <span className="text-[15px] font-semibold tabular-nums">{a.isLot ? a.name : a.tagVisual ? formatTag(a.tagVisual) : a.name ?? formatTag(a.tagRfid)}</span>
                  <span className="text-[13px] text-muted">
                    {isSpeciesKey(a.species) ? (a.isLot ? `Lote · ${a.headCount}` : categoryOf(a.species, a.category)?.label ?? CATALOG[a.species].label) : a.species}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No hay animales en este potrero.</p>
        )}
      </section>

      {history.length ? (
        <section className="flex flex-col gap-3">
          <SectionTitle>Movimientos</SectionTitle>
          <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
            {history.map((h) => (
              <li key={h.batchId} className="border-b border-chip px-4 py-2.5 text-[15px] last:border-b-0">
                <span className="font-semibold">{h.entered ? `Entraron ${h.count}` : `Salieron ${h.count}`}</span>
                <span className="text-muted">
                  {" "}
                  · {formatDate(h.date)}
                  {h.other ? ` · ${h.entered ? "desde" : "a"} ${h.other}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {can(role, "configurar") ? (
        <Card className="flex flex-col gap-4">
          <SectionTitle>Datos del potrero</SectionTitle>
          <PaddockForm
            slug={slug}
            initial={{ id: p.id, name: p.name, hectares: p.hectares?.toString() ?? "", kind: p.kind ?? "", notes: p.notes ?? "" }}
          />
          <form action={archivePaddockAction} className="border-t border-chip pt-4">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={p.id} />
            <button type="submit" className="h-11 w-full rounded-xl text-[15px] font-semibold text-bad-fg hover:bg-bad-bg">
              Archivar potrero
            </button>
            <p className="mt-1 text-center text-xs text-muted">Los animales que tenga quedan sin potrero. El historial se guarda.</p>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
