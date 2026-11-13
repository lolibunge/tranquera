import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFarmAccess } from "@/lib/farms";
import { can } from "@/lib/roles";
import { EXPENSE_CATEGORIES, expenseColor, expenseTotals, formatMoney, listExpenses, pendingReimbursements } from "@/lib/owners";
import { monthRange } from "@/lib/calendar";
import { todayISO } from "@/lib/dates";
import { BackLink, Card, PageTitle } from "@/components/ui";
import { deleteExpenseAction, markReimbursedAction } from "../propietarios/actions";

export const metadata: Metadata = { title: "Gastos" };
const MONTH = new Intl.DateTimeFormat("es-UY", { month: "long", year: "numeric", timeZone: "UTC" });
const MONTH_ONLY = new Intl.DateTimeFormat("es-UY", { month: "long", timeZone: "UTC" });
const DAY = new Intl.DateTimeFormat("es-UY", { weekday: "long", day: "numeric", timeZone: "UTC" });
type Cur = "USD" | "UYU";

export default async function ExpensesPage({ params, searchParams }: PageProps<"/c/[slug]/gastos">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { farm, role } = await getFarmAccess(slug);
  if (!can(role, "cuentas")) notFound();
  const today = todayISO();
  const range = monthRange(typeof sp.mes === "string" ? sp.mes : undefined, today);
  const prev = monthRange(range.prev, today);
  const [all, prevTotals, reimb] = await Promise.all([listExpenses(farm.id, range.first, range.last), expenseTotals(farm.id, prev.first, prev.last), pendingReimbursements(farm.id)]);

  // Moneda: la pedida, o la que más se usó este mes.
  const sums = { USD: 0, UYU: 0 } as Record<Cur, number>;
  for (const r of all) sums[r.currency === "USD" ? "USD" : "UYU"] += Number(r.amount);
  const cur: Cur = sp.moneda === "USD" || sp.moneda === "UYU" ? sp.moneda : sums.USD > 0 && sums.UYU === 0 ? "USD" : "UYU";
  const rows = all.filter((r) => (r.currency === "USD" ? "USD" : "UYU") === cur);
  const cat = typeof sp.cat === "string" && EXPENSE_CATEGORIES.some((c) => c.key === sp.cat) ? sp.cat : "";
  const total = sums[cur];
  const before = prevTotals[cur] ?? 0;
  const change = before > 0 ? Math.round(((total - before) / before) * 100) : null;
  const byCat = EXPENSE_CATEGORIES.map((c) => ({ ...c, amount: rows.filter((r) => r.category === c.key).reduce((n, r) => n + Number(r.amount), 0) }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const visible = cat ? rows.filter((r) => r.category === cat) : rows;
  const days = [...new Set(visible.map((r) => r.date))];
  const fmt = (n: number) => formatMoney(n, cur);
  const base = `/c/${slug}/gastos`;
  const q = (k: Record<string, string>) => `${base}?${new URLSearchParams({ mes: range.month, moneda: cur, ...(cat ? { cat } : {}), ...k })}`;
  const other: Cur = cur === "USD" ? "UYU" : "USD";

  return (
    <div className="flex flex-col gap-4">
      <BackLink href={`/c/${slug}/mas`} label="Volver" />
      <PageTitle>Gastos</PageTitle>

      <div role="tablist" aria-label="Moneda" className="grid grid-cols-2 gap-1 rounded-xl bg-chip p-1">
        {(["USD", "UYU"] as const).map((c) => (
          <Link key={c} role="tab" aria-selected={cur === c} href={q({ moneda: c, cat: "" })} className={`flex h-10 items-center justify-center rounded-lg text-[15px] font-semibold ${cur === c ? "bg-surface shadow-sm" : "text-muted"}`}>
            {c === "USD" ? "Dólares" : "Pesos"}
            {sums[c] > 0 && cur !== c ? <span className="ml-1.5 size-1.5 rounded-full bg-brand" aria-label="tiene gastos" /> : null}
          </Link>
        ))}
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Link href={q({ mes: range.prev })} aria-label="Mes anterior" className="flex size-11 items-center justify-center rounded-xl border border-line">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </Link>
          <span className="text-base font-semibold first-letter:uppercase">{MONTH.format(new Date(`${range.first}T12:00:00Z`))}</span>
          {range.month < today.slice(0, 7) ? (
            <Link href={q({ mes: range.next })} aria-label="Mes siguiente" className="flex size-11 items-center justify-center rounded-xl border border-line">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </Link>
          ) : (
            <span className="size-11" />
          )}
        </div>
        <div className="text-center">
          <p className="text-[13px] text-muted">Gastado en {MONTH_ONLY.format(new Date(`${range.first}T12:00:00Z`))}</p>
          <p className="font-display text-[34px] leading-tight font-bold tabular-nums">{fmt(total)}</p>
          <p className="text-[13px] text-muted first-letter:uppercase">
            {MONTH_ONLY.format(new Date(`${prev.first}T12:00:00Z`))}: {before ? fmt(before) : "sin gastos"}
            {change !== null ? <span className={`font-semibold ${change > 0 ? "text-warn-fg" : "text-ok-fg"}`}> · {change > 0 ? "+" : ""}{change}%</span> : null}
          </p>
          {sums[other] > 0 ? (
            <Link href={q({ moneda: other, cat: "" })} className="text-[13px] font-semibold text-brand">
              Además: {formatMoney(sums[other], other)}
            </Link>
          ) : null}
        </div>
        {byCat.length ? (
          <>
            <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
              {byCat.map((c) => (
                <span key={c.key} style={{ width: `${(c.amount / total) * 100}%`, background: c.color }} />
              ))}
            </div>
            <ul className="flex flex-col gap-1.5">
              {byCat.map((c) => (
                <li key={c.key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-[3px]" style={{ background: c.color }} aria-hidden="true" />
                    {c.label}
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span className="text-xs text-muted">{Math.round((c.amount / total) * 100)}%</span>
                    <span className="font-semibold whitespace-nowrap tabular-nums">{fmt(c.amount)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Card>

      {reimb.length ? (
        <Card className="flex flex-col gap-3 border-[#e8c98a] bg-[#fffaf0]">
          <p className="text-[15px] font-semibold">Reintegros pendientes</p>
          {reimb.map((r) => (
            <form key={r.person} action={markReimbursedAction} className="flex items-center justify-between gap-3">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="person" value={r.person} />
              <span className="flex flex-col">
                <span className="text-[15px]">
                  {r.person} puso <span className="font-semibold whitespace-nowrap tabular-nums">{formatMoney(r.total)}</span>
                </span>
                <span className="text-[13px] text-muted">
                  {r.count} gasto{r.count === 1 ? "" : "s"}
                </span>
              </span>
              <button type="submit" className="h-11 shrink-0 rounded-xl border border-line-strong bg-surface px-4 text-[15px] font-semibold">
                Devuelto
              </button>
            </form>
          ))}
        </Card>
      ) : null}

      {byCat.length > 1 ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Link href={q({ cat: "" })} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${!cat ? "bg-brand text-white" : "bg-chip"}`}>
            Todos
          </Link>
          {byCat.map((c) => (
            <Link key={c.key} href={q({ cat: c.key })} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${cat === c.key ? "bg-brand text-white" : "bg-chip"}`}>
              {c.short}
            </Link>
          ))}
        </div>
      ) : null}

      {days.length ? (
        days.map((d) => (
          <section key={d} className="flex flex-col gap-1.5">
            <p className="text-[13px] font-semibold text-muted first-letter:uppercase">{DAY.format(new Date(`${d}T12:00:00Z`))}</p>
            <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
              {visible
                .filter((r) => r.date === d)
                .map((r) => (
                  <li key={r.id} className="flex items-center gap-3 border-b border-chip py-2.5 pr-1 pl-3 last:border-b-0">
                    <span className="h-9 w-2 shrink-0 rounded-full" style={{ background: expenseColor(r.category) }} aria-hidden="true" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-semibold">{r.concept}</span>
                      <span className="text-[13px] leading-snug text-muted">
                        {[
                          EXPENSE_CATEGORIES.find((c) => c.key === r.category)?.short,
                          r.ownerName ? `${r.ownerName}${r.billed ? " · se le cobra" : ""}` : null,
                          r.paidBy ? `pagó ${r.paidBy}${r.reimbursedAt ? " (devuelto)" : ""}` : null,
                          r.supplier,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="text-[15px] font-semibold whitespace-nowrap tabular-nums">{fmt(Number(r.amount))}</span>
                    <form action={deleteExpenseAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" aria-label={`Borrar ${r.concept}${r.splitId ? " (todo el reparto)" : ""}`} className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-chip">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                      </button>
                    </form>
                  </li>
                ))}
            </ul>
          </section>
        ))
      ) : (
        <Card className="text-sm text-ink-2">No hay gastos en {cur === "USD" ? "dólares" : "pesos"} este mes.</Card>
      )}

      <div className="sticky bottom-24 z-10 mt-2 flex justify-end">
        <Link href={`${base}/nuevo`} className="inline-flex h-13 items-center gap-2 rounded-full bg-brand px-5 text-[15px] font-semibold text-white shadow-[0_6px_16px_rgba(35,26,20,.18)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Gasto
        </Link>
      </div>
    </div>
  );
}
