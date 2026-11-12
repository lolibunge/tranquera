import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFarmAccess } from "@/lib/farms";
import { can } from "@/lib/roles";
import { addMoney, EXPENSE_CATEGORIES, expenseCategoryLabel, formatMoney, listExpenses, ownerOptions, type Money } from "@/lib/owners";
import { monthRange } from "@/lib/calendar";
import { formatDate, todayISO } from "@/lib/dates";
import { BackLink, Card, PageTitle, SectionTitle } from "@/components/ui";
import { ExpenseForm } from "../propietarios/forms";
import { deleteExpenseAction } from "../propietarios/actions";

export const metadata: Metadata = { title: "Gastos" };
const MONTH = new Intl.DateTimeFormat("es-UY", { month: "long", year: "numeric", timeZone: "UTC" });

export default async function ExpensesPage({ params, searchParams }: PageProps<"/c/[slug]/gastos">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { farm, role } = await getFarmAccess(slug);
  if (!can(role, "cuentas")) notFound();
  const today = todayISO();
  const range = monthRange(typeof sp.mes === "string" ? sp.mes : undefined, today);
  const [rows, owners] = await Promise.all([listExpenses(farm.id, range.first, range.last), ownerOptions(farm.id)]);
  const total: Money = {};
  const byCat = new Map<string, Money>();
  for (const r of rows) {
    addMoney(total, r.currency, Number(r.amount));
    byCat.set(r.category, addMoney(byCat.get(r.category) ?? {}, r.currency, Number(r.amount)));
  }
  const base = `/c/${slug}/gastos`;

  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/c/${slug}/mas`} label="Volver" />
      <PageTitle sub="Lo que se gasta en el campo, por mes">Gastos</PageTitle>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Link href={`${base}?mes=${range.prev}`} aria-label="Mes anterior" className="flex size-10 items-center justify-center rounded-xl hover:bg-chip">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </Link>
          <span className="text-base font-semibold first-letter:uppercase">{MONTH.format(new Date(`${range.first}T12:00:00Z`))}</span>
          {range.month < today.slice(0, 7) ? (
            <Link href={`${base}?mes=${range.next}`} aria-label="Mes siguiente" className="flex size-10 items-center justify-center rounded-xl hover:bg-chip">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </Link>
          ) : (
            <span className="size-10" />
          )}
        </div>
        <p className="text-center text-2xl font-semibold tabular-nums">{formatMoney(total)}</p>
        {byCat.size ? (
          <ul className="flex flex-col gap-1 text-[13px]">
            {[...byCat.entries()].map(([c, m]) => (
              <li key={c} className="flex justify-between gap-3">
                <span className="text-ink-2">{expenseCategoryLabel(c)}</span>
                <span className="font-semibold tabular-nums">{formatMoney(m)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {rows.length ? (
        <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 border-b border-chip px-4 py-2.5 last:border-b-0">
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[15px] font-semibold">{r.concept}</span>
                <span className="text-[13px] text-muted">
                  {formatDate(r.date)} · {expenseCategoryLabel(r.category)}
                  {r.ownerName ? ` · ${r.ownerName}` : ""}
                  {r.supplier ? ` · ${r.supplier}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-[15px] font-semibold whitespace-nowrap tabular-nums">{formatMoney(Number(r.amount), r.currency)}</span>
                <form action={deleteExpenseAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" aria-label="Borrar gasto" className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-chip">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="text-sm text-ink-2">No hay gastos cargados este mes.</Card>
      )}

      <Card className="flex flex-col gap-4">
        <SectionTitle>Registrar gasto</SectionTitle>
        <ExpenseForm slug={slug} today={today} categories={EXPENSE_CATEGORIES} owners={owners} />
      </Card>
    </div>
  );
}
