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
import { ChargeMonthForm, EntryForm, OwnerForm, RateForm, SharesForm } from "../forms";
import { archiveOwnerAction, deleteEntryAction, endRateAction } from "../actions";
import { monthName, ownerLedger, ownerRates } from "@/lib/ledger";
import { formatMoney } from "@/lib/owners";
import { formatDate, todayISO } from "@/lib/dates";

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
  const today = todayISO();
  const [account, rates, mine] = await Promise.all([
    ownerLedger(farm.id, owner.id),
    ownerRates(farm.id, owner.id),
    db
      .select({ id: schema.animals.id, name: schema.animals.name, tag: schema.animals.tagVisual })
      .from(schema.animals)
      .where(and(eq(schema.animals.farmId, farm.id), eq(schema.animals.ownerId, owner.id), eq(schema.animals.status, "activo"))),
  ]);
  const months = [0, 1, 2].map((i) => {
    const d = new Date(`${today.slice(0, 7)}-15T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - i);
    const v = d.toISOString().slice(0, 7);
    return { value: v, label: monthName(v) };
  });
  const owes = Object.values(account.balance).some((v) => (v ?? 0) > 0.5);
  const showAccount = owner.kind !== "campo" && owner.kind !== "pozo";

  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/c/${slug}/propietarios`} label="Propietarios" />
      <PageTitle sub={ownerKindLabel(owner.kind)}>{owner.name}</PageTitle>

      <Card className="flex flex-col gap-3">
        <SectionTitle>Animales</SectionTitle>
        {bySpecies.length ? (
          <p className="text-[15px]">
            {bySpecies.map((r) => `${r.heads} ${isSpeciesKey(r.species) ? (r.heads === 1 ? CATALOG[r.species].label : CATALOG[r.species].plural).toLowerCase() : r.species}`).join(", ")}
          </p>
        ) : (
          <p className="text-sm text-ink-2">Todavía no tiene animales asignados.</p>
        )}
        <ButtonLink href={`/c/${slug}/propietarios/${owner.id}/animales`} kind="secondary">
          Elegir sus animales
        </ButtonLink>
      </Card>

      {showAccount ? (
        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle>Cuenta</SectionTitle>
            <span className={`text-lg font-semibold tabular-nums ${owes ? "text-warn-fg" : "text-ok-fg"}`}>
              {Object.keys(account.balance).some((k) => Math.abs(account.balance[k as "USD" | "UYU"] ?? 0) > 0.5) ? formatMoney(account.balance) : "Al día"}
            </span>
          </div>
          <p className="-mt-2 text-[13px] text-muted">{owes ? "Lo que debe al campo." : "No debe nada."}</p>
          <EntryForm slug={slug} ownerId={owner.id} today={today} defaultCurrency={owner.currency} />
          {account.entries.length ? (
            <ul className="flex flex-col divide-y divide-chip">
              {account.entries.slice(0, 40).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[15px] font-semibold">{e.concept}</span>
                    <span className="text-[13px] text-muted">
                      {[formatDate(e.date), e.notes].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className={`text-[15px] font-semibold whitespace-nowrap tabular-nums ${e.kind === "pago" ? "text-ok-fg" : ""}`}>
                      {e.kind === "pago" ? "−" : "+"}
                      {formatMoney(Number(e.amount), e.currency)}
                    </span>
                    <form action={deleteEntryAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="entryId" value={e.id} />
                      <button type="submit" aria-label="Borrar movimiento" className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-chip">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                      </button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {showAccount ? (
        <Card className="flex flex-col gap-4">
          <SectionTitle>Pensión</SectionTitle>
          {rates.length ? (
            <ul className="flex flex-col divide-y divide-chip">
              {rates.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[15px] font-semibold">{r.animalName ?? r.animalTag ?? "General"}</span>
                    <span className="text-[13px] text-muted">
                      Desde {formatDate(r.from)}
                      {r.to ? ` hasta ${formatDate(r.to)}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={`text-[15px] font-semibold whitespace-nowrap tabular-nums ${r.to ? "text-muted line-through" : ""}`}>{formatMoney(Number(r.monthly), r.currency)}/mes</span>
                    {!r.to ? (
                      <form action={endRateAction}>
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="rateId" value={r.id} />
                        <input type="hidden" name="date" value={today} />
                        <button type="submit" className="h-9 rounded-lg px-2 text-[13px] font-semibold text-muted hover:bg-chip">
                          Terminar
                        </button>
                      </form>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">Poné cuánto paga por mes cada animal (o en total) y después cobrás el mes con un toque.</p>
          )}
          {rates.some((r) => !r.to) ? <ChargeMonthForm slug={slug} ownerId={owner.id} months={months} /> : null}
          <details className="rounded-xl border border-line p-3">
            <summary className="cursor-pointer text-[15px] font-semibold">Nueva tarifa</summary>
            <div className="mt-3">
              <RateForm slug={slug} ownerId={owner.id} today={today} animals={mine.map((a) => ({ id: a.id, name: a.name ?? a.tag ?? "Animal" }))} defaultCurrency={owner.currency} />
            </div>
          </details>
        </Card>
      ) : null}

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
