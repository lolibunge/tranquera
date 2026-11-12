import type { Metadata } from "next";
import Link from "next/link";
import { getFarmAccess } from "@/lib/farms";
import { listSales, salesSummary } from "@/lib/sales";
import { formatDate, todayISO } from "@/lib/dates";
import { can } from "@/lib/roles";
import { BackLink, ButtonLink, Card, PageTitle, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Ventas" };

const money = (n: number | string, currency: string) =>
  `${currency === "USD" ? "US$" : "$"} ${Number(n).toLocaleString("es-UY", { maximumFractionDigits: 0 })}`;

export default async function SalesPage({ params }: PageProps<"/c/[slug]/ventas">) {
  const { slug } = await params;
  const { farm, role } = await getFarmAccess(slug);
  const year = Number(todayISO().slice(0, 4));
  const [sales, summary] = await Promise.all([listSales(farm.id), salesSummary(farm.id, year)]);
  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/c/${slug}/mas`} label="Volver" />
      <PageTitle sub="Tropas vendidas, con comprador, kilos y precio.">Ventas</PageTitle>
      {can(role, "cargar") ? <ButtonLink href={`/c/${slug}/ventas/nueva`}>Nueva venta</ButtonLink> : null}

      {summary.length ? (
        <section className="flex flex-col gap-3">
          <SectionTitle>En {year}</SectionTitle>
          {summary.map((s) => (
            <Card key={s.currency} className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-muted">Cabezas</p>
                <p className="text-lg font-semibold tabular-nums">{s.heads}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Kilos</p>
                <p className="text-lg font-semibold tabular-nums">{Math.round(s.kilos).toLocaleString("es-UY")}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Neto</p>
                <p className="text-lg font-semibold tabular-nums">{money(s.gross - s.expenses, s.currency)}</p>
              </div>
            </Card>
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <SectionTitle>Últimas ventas</SectionTitle>
        {sales.length ? (
          <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
            {sales.map((s) => (
              <li key={s.id} className="border-b border-chip last:border-b-0">
                <Link href={`/c/${slug}/ventas/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-ground">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[15px] font-semibold">{s.buyer}</span>
                    <span className="text-[13px] text-muted">
                      {formatDate(s.date)} · {s.heads} cab.{s.kilos ? ` · ${Number(s.kilos).toLocaleString("es-UY")} kg` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums">{money(Number(s.gross) - Number(s.expenses), s.currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Todavía no hay ventas registradas.</p>
        )}
      </section>
    </div>
  );
}
