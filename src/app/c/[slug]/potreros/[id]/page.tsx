import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getFarmAccess } from "@/lib/farms";
import { listPaddocks, PADDOCK_KINDS } from "@/lib/paddocks";
import { CATALOG, categoryOf, formatTag, isSpeciesKey } from "@/lib/catalogo";
import { formatDate, todayISO } from "@/lib/dates";
import { can } from "@/lib/roles";
import { BackLink, ButtonLink, Card, SectionTitle } from "@/components/ui";
import { PaddockForm } from "../paddock-form";
import { archivePaddockAction, deleteReadingAction, deleteWorkAction } from "../actions";
import { ReadingForm, WorkForm } from "../pasture-forms";
import { paddockReadings, paddockWorks, WORK_KINDS, workLabel } from "@/lib/pasture";

export const metadata: Metadata = { title: "Potrero" };

export default async function PaddockPage({ params }: PageProps<"/c/[slug]/potreros/[id]">) {
  const { slug, id } = await params;
  const { farm, role } = await getFarmAccess(slug);
  const all = await listPaddocks(farm.id);
  const p = all.find((x) => x.id === id);
  const today = todayISO();
  if (!p) notFound();

  const [works, readings, animals, history] = await Promise.all([
    paddockWorks(farm.id, id),
    paddockReadings(farm.id, id),
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
        {p.parentName || p.zone ? (
          <p className="text-[13px] text-muted">
            {[p.parentName ? `Dentro de ${p.parentName}` : null, p.zone ? `Zona ${p.zone}` : null].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        {p.readyOn ? (
          <p className="text-[15px] font-semibold text-warn-fg">
            {workLabel(p.readyWork ?? "")}: pronto para pastorear el {formatDate(p.readyOn)}
          </p>
        ) : null}
        {p.lastReading ? (
          <p className="text-[15px]">
            Pasto: <span className="font-semibold tabular-nums">{p.lastReading.kgDmHa.toLocaleString("es-UY")} kg MS/ha</span>
            <span className="text-muted"> · {formatDate(p.lastReading.date)}</span>
          </p>
        ) : null}
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

      <section className="flex flex-col gap-3">
        <SectionTitle>Laboreos</SectionTitle>
        {works.length ? (
          <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
            {works.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 border-b border-chip px-4 py-2.5 last:border-b-0">
                <span className="flex min-w-0 flex-col">
                  <span className="text-[15px] font-semibold">{workLabel(w.kind)}</span>
                  <span className="text-[13px] text-muted">
                    {[formatDate(w.date), w.readyOn ? `pronto ${formatDate(w.readyOn)}` : null, w.doneBy, w.notes].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {can(role, "cargar") ? (
                  <form action={deleteWorkAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={w.id} />
                    <button type="submit" aria-label="Borrar laboreo" className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-chip">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Sin laboreos registrados.</p>
        )}
        {can(role, "cargar") ? (
          <details className="rounded-2xl border border-line bg-surface p-4">
            <summary className="cursor-pointer text-[15px] font-semibold">Registrar laboreo</summary>
            <div className="mt-4">
              <WorkForm slug={slug} paddockId={p.id} today={today} kinds={WORK_KINDS} />
            </div>
          </details>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>Mediciones de pasto</SectionTitle>
        {readings.length ? (
          <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
            {readings.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 border-b border-chip px-4 py-2.5 last:border-b-0">
                <span className="flex min-w-0 flex-col">
                  <span className="text-[15px] font-semibold tabular-nums">{r.kgDmHa.toLocaleString("es-UY")} kg MS/ha</span>
                  <span className="text-[13px] text-muted">{[formatDate(r.date), r.notes].filter(Boolean).join(" · ")}</span>
                </span>
                {can(role, "cargar") ? (
                  <form action={deleteReadingAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" aria-label="Borrar medición" className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-chip">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Sin mediciones.</p>
        )}
        {can(role, "cargar") ? (
          <details className="rounded-2xl border border-line bg-surface p-4">
            <summary className="cursor-pointer text-[15px] font-semibold">Medir el pasto</summary>
            <div className="mt-4">
              <ReadingForm slug={slug} paddockId={p.id} today={today} />
            </div>
          </details>
        ) : null}
      </section>

      {can(role, "configurar") ? (
        <Card className="flex flex-col gap-4">
          <SectionTitle>Datos del potrero</SectionTitle>
          <PaddockForm
            slug={slug}
            initial={{
              id: p.id,
              name: p.name,
              hectares: p.hectares?.toString() ?? "",
              kind: p.kind ?? "",
              notes: p.notes ?? "",
              parentId: p.parentId ?? "",
              zone: p.zone ?? "",
              restSince: p.restSince ?? "",
            }}
            parents={all.map((x) => ({ id: x.id, name: x.name }))}
            today={today}
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
