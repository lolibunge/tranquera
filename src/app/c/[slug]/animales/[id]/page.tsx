import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFarmAccess } from "@/lib/farms";
import { getAnimal } from "@/lib/animals";
import { CATALOG, SEX_LABEL, categoryOf, formatTag, isSpeciesKey, type Sex } from "@/lib/catalogo";
import { controlsForAnimal, healthHistory } from "@/lib/health";
import { animalMovements } from "@/lib/paddocks";
import { DEATH_CAUSES } from "@/lib/sales";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ageLabel, formatDate, relativeDays, todayISO } from "@/lib/dates";
import { can } from "@/lib/roles";
import { BackLink, Card, SectionTitle, StatusPill } from "@/components/ui";
import { HealthForm } from "./health-form";
import { StatusForm } from "./status-form";

export async function generateMetadata({ params }: PageProps<"/c/[slug]/animales/[id]">): Promise<Metadata> {
  const { slug, id } = await params;
  const { farm } = await getFarmAccess(slug);
  const a = await getAnimal(farm.id, id);
  return { title: a ? a.name ?? formatTag(a.tagVisual ?? a.tagRfid) : "Animal" };
}

const TONE_LABEL = { ok: "Al día", warn: "Vence pronto", bad: "Vencido" } as const;

export default async function AnimalPage({ params }: PageProps<"/c/[slug]/animales/[id]">) {
  const { slug, id } = await params;
  const { farm, role } = await getFarmAccess(slug);
  const a = await getAnimal(farm.id, id);
  if (!a || !isSpeciesKey(a.species)) notFound();
  const info = CATALOG[a.species];
  const today = todayISO();
  const [controls, history, moves, paddock, owner] = await Promise.all([
    controlsForAnimal(farm.id, a.id, a.species),
    healthHistory(farm.id, a.id),
    animalMovements(farm.id, a.id),
    a.paddockId ? db.select({ id: schema.paddocks.id, name: schema.paddocks.name }).from(schema.paddocks).where(eq(schema.paddocks.id, a.paddockId)).limit(1) : Promise.resolve([]),
    a.ownerId ? db.select({ id: schema.owners.id, name: schema.owners.name }).from(schema.owners).where(eq(schema.owners.id, a.ownerId)).limit(1) : Promise.resolve([]),
  ]);
  const title = a.isLot ? a.name : a.tagVisual ? formatTag(a.tagVisual) : a.name ?? formatTag(a.tagRfid);
  const sub = [
    a.isLot ? `Lote · ${a.headCount} cabezas` : categoryOf(a.species, a.category)?.label,
    a.breed,
    ageLabel(a.birthDate, today),
  ]
    .filter(Boolean)
    .join(" · ");
  const canLoad = can(role, "cargar");
  const canHealth = can(role, "sanidad");
  const statusLabel = { vendido: "Vendido", muerto: "Muerto", baja: "Dado de baja", activo: "" } as const;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <BackLink href={`/c/${slug}/animales?e=${a.species}`} />
        {canLoad ? (
          <Link href={`/c/${slug}/animales/${a.id}/editar`} className="flex h-11 items-center rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold">
            Editar
          </Link>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[28px] leading-tight font-bold tabular-nums">{title}</h1>
        {sub ? <p className="text-[15px] text-ink-2">{sub}</p> : null}
        <div className="mt-1 flex flex-wrap gap-2">
          {a.tagVisual && a.name && !a.isLot ? <span className="rounded-full bg-chip px-2.5 py-1 text-[13px] font-semibold">{a.name}</span> : null}
          {paddock[0] ? (
            <Link href={`/c/${slug}/potreros/${paddock[0].id}`} className="rounded-full bg-brand-soft px-2.5 py-1 text-[13px] font-semibold text-brand">
              {paddock[0].name}
            </Link>
          ) : null}
          {owner[0] ? (
            can(role, "cuentas") ? (
              <Link href={`/c/${slug}/propietarios/${owner[0].id}`} className="rounded-full bg-info-bg px-2.5 py-1 text-[13px] font-semibold text-info-fg">
                De {owner[0].name}
              </Link>
            ) : (
              <span className="rounded-full bg-info-bg px-2.5 py-1 text-[13px] font-semibold text-info-fg">De {owner[0].name}</span>
            )
          ) : null}
          {a.origin ? <span className="rounded-full bg-chip px-2.5 py-1 text-[13px] font-semibold">{a.origin === "nacido" ? "Nació en el campo" : "Comprado"}</span> : null}
          {a.status !== "activo" ? (
            <StatusPill tone="info">
              {statusLabel[a.status]}
              {a.statusDate ? ` el ${formatDate(a.statusDate)}` : ""}
              {a.statusCause ? ` · ${DEATH_CAUSES.find((c) => c.value === a.statusCause)?.label ?? a.statusCause}` : ""}
            </StatusPill>
          ) : null}
          {a.saleId ? (
            <Link href={`/c/${slug}/ventas/${a.saleId}`} className="rounded-full bg-chip px-2.5 py-1 text-[13px] font-semibold text-brand">
              Ver la venta
            </Link>
          ) : null}
        </div>
      </div>

      {info.traceability && !a.isLot ? (
        <Card className="flex flex-col gap-3">
          <SectionTitle>Identificación</SectionTitle>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Item label="Caravana visual" value={formatTag(a.tagVisual) || "—"} />
            <Item label="Botón RFID" value={formatTag(a.tagRfid) || "—"} />
            <Item label="Nacimiento" value={formatDate(a.birthDate) || "—"} />
            <Item label="Sexo" value={a.sex ? SEX_LABEL[a.sex as Sex] : "—"} />
            {a.origin === "comprado" ? (
              <>
                <Item label="Comprado a" value={a.originDetail || "—"} />
                <Item label="Llegó" value={formatDate(a.arrivedOn) || "—"} />
              </>
            ) : null}
          </dl>
        </Card>
      ) : null}

      <section className="flex flex-col gap-3">
        <SectionTitle>Sanidad</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5">
          {controls.map((c) => (
            <div key={c.control} className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-3">
              <p className="text-sm leading-tight font-semibold">{c.label}</p>
              {c.tone ? (
                <StatusPill tone={c.tone}>{TONE_LABEL[c.tone]}</StatusPill>
              ) : (
                <span className="text-xs text-muted">Sin registro</span>
              )}
              <p className="text-xs text-muted">
                {c.nextDue
                  ? `Próxima: ${formatDate(c.nextDue)} (${relativeDays(c.nextDue, today)})`
                  : c.lastDate
                    ? `Última: ${formatDate(c.lastDate)}`
                    : c.official
                      ? "Según campaña oficial"
                      : ""}
              </p>
            </div>
          ))}
        </div>
        {canHealth && a.status === "activo" ? <HealthForm slug={slug} animalId={a.id} species={a.species} today={today} /> : null}
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>Historial</SectionTitle>
        {history.length ? (
          <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
            {history.map((h) => (
              <li key={h.id} className="flex flex-col gap-0.5 border-b border-chip px-4 py-3 last:border-b-0">
                <span className="text-[15px] font-semibold">
                  {h.label}
                  {h.result ? <span className="font-normal text-ink-2"> · {/^\d/.test(h.result) ? `${h.result} kg` : h.result}</span> : null}
                </span>
                <span className="text-[13px] text-muted">
                  {[formatDate(h.date), h.product, h.batch ? (info.controls.find((c) => c.key === h.control)?.batchLabel ? h.batch : `serie ${h.batch}`) : null, h.dose, h.vet, h.sessionId ? "jornada de manga" : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {h.nextDueDate ? <span className="text-[13px] text-muted">Próxima: {formatDate(h.nextDueDate)}</span> : null}
                {h.notes ? <span className="text-[13px] text-ink-2">{h.notes}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Todavía no hay registros.</p>
        )}
        {moves.length ? (
          <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
            {moves.map((m) => (
              <li key={m.id} className="border-b border-chip px-4 py-2.5 text-[15px] last:border-b-0">
                <span className="font-semibold">{m.to ? `Entró a ${m.to}` : `Salió de ${m.from ?? "potrero"}`}</span>
                <span className="text-muted">
                  {" "}
                  · {formatDate(m.date)}
                  {m.to && m.from ? ` · desde ${m.from}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {a.notes ? (
          <Card>
            <p className="text-[13px] font-semibold text-muted">Notas</p>
            <p className="mt-1 text-[15px] whitespace-pre-line">{a.notes}</p>
          </Card>
        ) : null}
      </section>

      {canLoad ? <StatusForm slug={slug} animalId={a.id} status={a.status} today={today} /> : null}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-[15px] font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
