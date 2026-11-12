import type { Metadata } from "next";
import Link from "next/link";
import { getFarmAccess } from "@/lib/farms";
import { roundsOn, SLOTS, slotLabel, slotPlan, totals, type Slot } from "@/lib/feeding";
import { listSupplies, formatQty, unitFor } from "@/lib/stock";
import { todayISO } from "@/lib/dates";
import { can } from "@/lib/roles";
import { BackLink, Card, Notice, PageTitle, SectionTitle } from "@/components/ui";
import { RoundForm } from "./forms";
import { undoRoundAction } from "./actions";

export const metadata: Metadata = { title: "Ración" };

function currentSlot(): Slot {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "America/Montevideo" }).format(new Date()));
  return h < 12 ? "manana" : h < 18 ? "tarde" : "noche";
}

export default async function FeedPage({ params, searchParams }: PageProps<"/c/[slug]/racion">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { farm, role } = await getFarmAccess(slug);
  const slot = (SLOTS.some((s) => s.key === sp.turno) ? sp.turno : currentSlot()) as Slot;
  const today = todayISO();
  const [animals, rounds, stock] = await Promise.all([slotPlan(farm.id, slot), roundsOn(farm.id, today), listSupplies(farm.id)]);
  const done = rounds.find((r) => r.slot === slot);
  const need = totals(animals);
  const short = need.filter((n) => (stock.find((s) => s.id === n.id)?.stock ?? 0) < n.quantity);
  const base = `/c/${slug}/racion`;

  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/c/${slug}`} label="Volver" />
      <PageTitle sub="Lo que come cada animal en cada turno. Al darla, se descuenta del stock.">Ración de hoy</PageTitle>

      <div role="tablist" aria-label="Turno" className="grid grid-cols-3 gap-1 rounded-xl bg-chip p-1">
        {SLOTS.map((s) => {
          const given = rounds.some((r) => r.slot === s.key);
          return (
            <Link
              key={s.key}
              role="tab"
              aria-selected={s.key === slot}
              href={`${base}?turno=${s.key}`}
              className={`flex h-11 items-center justify-center gap-1.5 rounded-lg text-[15px] font-semibold ${s.key === slot ? "bg-surface shadow-sm" : "text-muted"}`}
            >
              {given ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-label="dada" className="text-ok-fg">
                  <path d="M5 12l5 5L19 7" />
                </svg>
              ) : null}
              {s.label}
            </Link>
          );
        })}
      </div>

      {!animals.length ? (
        <Card className="text-sm leading-relaxed text-ink-2">
          Nadie tiene ración de la {slotLabel(slot).toLowerCase()}. Se arma desde la ficha de cada animal, en la sección Ración. Primero cargá la ración y los fardos en{" "}
          <Link href={`/c/${slug}/stock`} className="font-semibold text-brand">Stock</Link>.
        </Card>
      ) : done ? (
        <Card className="flex flex-col gap-3">
          <p className="text-base font-semibold text-ok-fg">
            Ración de la {slotLabel(slot).toLowerCase()} dada a {done.animals} animal{done.animals === 1 ? "" : "es"}
          </p>
          {done.skipped ? <p className="text-sm text-ink-2">No comieron: {done.skipped}</p> : null}
          {can(role, "cargar") ? (
            <form action={undoRoundAction}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="id" value={done.id} />
              <button type="submit" className="h-11 rounded-xl border border-line-strong px-4 text-[15px] font-semibold">
                Deshacer (devuelve al stock)
              </button>
            </form>
          ) : null}
        </Card>
      ) : (
        <>
          <Card className="flex flex-col gap-2">
            <SectionTitle>Preparar</SectionTitle>
            <ul className="flex flex-col gap-1">
              {need.map((n) => (
                <li key={n.id} className="flex justify-between gap-3 text-[15px]">
                  <span>{n.supply}</span>
                  <span className="font-semibold tabular-nums">
                    {formatQty(n.quantity)} {unitFor(n.quantity, n.unit)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          {short.length ? <Notice tone="warn">No alcanza el stock de {short.map((s) => s.supply).join(", ")}. Igual se puede registrar; el stock queda en negativo hasta que cargues la entrada.</Notice> : null}
          {can(role, "cargar") ? <RoundForm slug={slug} slot={slot} date={today} animals={animals} slotName={slotLabel(slot)} /> : null}
        </>
      )}
    </div>
  );
}
