import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFarmAccess } from "@/lib/farms";
import { categoryLabel, formatQty, getSupply, unitFor, SUPPLY_CATEGORIES, SUPPLY_UNITS, supplyMoves } from "@/lib/stock";
import { formatDate, todayISO } from "@/lib/dates";
import { can } from "@/lib/roles";
import { BackLink, Card, PageTitle, SectionTitle, StatusPill } from "@/components/ui";
import { MoveForm, SupplyForm } from "../forms";
import { archiveSupplyAction, deleteMoveAction } from "../actions";

export const metadata: Metadata = { title: "Insumo" };

export default async function SupplyPage({ params }: PageProps<"/c/[slug]/stock/[id]">) {
  const { slug, id } = await params;
  const { farm, role } = await getFarmAccess(slug);
  const supply = await getSupply(farm.id, id);
  if (!supply || !supply.active) notFound();
  const moves = await supplyMoves(farm.id, supply.id);
  const load = can(role, "cargar");
  const low = supply.minimum !== null && supply.stock <= supply.minimum;

  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/c/${slug}/stock`} label="Stock" />
      <PageTitle sub={categoryLabel(supply.category)}>{supply.name}</PageTitle>

      <Card className="flex items-center justify-between gap-3">
        <span className="flex flex-col">
          <span className="text-xs text-muted">Hay ahora</span>
          <span className="text-2xl font-semibold tabular-nums">
            {formatQty(supply.stock)} <span className="text-base font-medium text-ink-2">{unitFor(supply.stock, supply.unit)}</span>
          </span>
          {supply.minimum !== null ? <span className="text-[13px] text-muted">Avisa debajo de {formatQty(supply.minimum)}</span> : null}
        </span>
        {supply.stock <= 0 ? <StatusPill tone="bad">Sin stock</StatusPill> : low ? <StatusPill tone="warn">Reponer</StatusPill> : <StatusPill tone="ok">Alcanza</StatusPill>}
      </Card>

      {load ? (
        <Card className="flex flex-col gap-4">
          <SectionTitle>Registrar movimiento</SectionTitle>
          <MoveForm slug={slug} supplyId={supply.id} unit={supply.unit} today={todayISO()} />
        </Card>
      ) : null}

      <section className="flex flex-col gap-2">
        <SectionTitle>Movimientos</SectionTitle>
        {moves.length ? (
          <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
            {moves.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 border-b border-chip px-4 py-2.5 last:border-b-0">
                <span className="flex min-w-0 flex-col">
                  <span className="text-[15px] font-semibold">{formatDate(m.date)}</span>
                  <span className="text-[13px] text-muted">
                    {m.sessionId ? (
                      <Link href={`/c/${slug}/sanidad/manga/${m.sessionId}`} className="font-semibold text-brand">
                        Jornada: {m.sessionLabel}
                      </Link>
                    ) : (
                      (m.note ?? (m.quantity > 0 ? "Entrada" : "Consumo"))
                    )}
                    {m.unitCost ? ` · ${m.currency === "UYU" ? "$" : "US$"} ${Number(m.unitCost).toLocaleString("es-UY")} c/u` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={`text-[15px] font-semibold tabular-nums ${m.quantity > 0 ? "text-ok-fg" : "text-ink"}`}>
                    {m.quantity > 0 ? "+" : "−"}
                    {formatQty(Math.abs(m.quantity))}
                  </span>
                  {load ? (
                    <form action={deleteMoveAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="moveId" value={m.id} />
                      <button type="submit" aria-label="Borrar movimiento" className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-chip">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </form>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Card className="text-sm text-ink-2">Sin movimientos todavía.</Card>
        )}
      </section>

      {load ? (
        <details className="rounded-2xl border border-line bg-surface p-4">
          <summary className="cursor-pointer text-[15px] font-semibold">Editar insumo</summary>
          <div className="mt-4 flex flex-col gap-4">
            <SupplyForm slug={slug} categories={SUPPLY_CATEGORIES} units={SUPPLY_UNITS} supply={supply} />
            <form action={archiveSupplyAction}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="id" value={supply.id} />
              <button type="submit" className="h-12 w-full rounded-xl border border-line-strong text-[15px] font-semibold text-bad-fg hover:bg-bad-bg">
                Ya no se usa: sacarlo de la lista
              </button>
            </form>
          </div>
        </details>
      ) : null}
    </div>
  );
}
