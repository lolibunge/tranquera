import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFarmAccess } from "@/lib/farms";
import { can } from "@/lib/roles";
import { formatMoney, listOwners, OWNER_KINDS, ownerKindLabel, yearSummary } from "@/lib/owners";
import { todayISO } from "@/lib/dates";
import { BackLink, Card, PageTitle, SectionTitle } from "@/components/ui";
import { OwnerForm } from "./forms";

export const metadata: Metadata = { title: "Propietarios y resultados" };

export default async function OwnersPage({ params, searchParams }: PageProps<"/c/[slug]/propietarios">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { farm, role } = await getFarmAccess(slug);
  if (!can(role, "cuentas")) notFound();
  const thisYear = Number(todayISO().slice(0, 4));
  const year = typeof sp.anio === "string" && /^\d{4}$/.test(sp.anio) ? Number(sp.anio) : thisYear;
  const [owners, summary] = await Promise.all([listOwners(farm.id), yearSummary(farm.id, year)]);
  const base = `/c/${slug}/propietarios`;

  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/c/${slug}/mas`} label="Volver" />
      <PageTitle sub="De quién es cada animal, gastos y cómo le fue a cada uno">Propietarios y resultados</PageTitle>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Link href={`${base}?anio=${year - 1}`} aria-label="Año anterior" className="flex size-10 items-center justify-center rounded-xl hover:bg-chip">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </Link>
          <span className="text-base font-semibold">Resultado {year}</span>
          {year < thisYear ? (
            <Link href={`${base}?anio=${year + 1}`} aria-label="Año siguiente" className="flex size-10 items-center justify-center rounded-xl hover:bg-chip">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </Link>
          ) : (
            <span className="size-10" />
          )}
        </div>
        <ul className="flex flex-col divide-y divide-chip">
          {summary.rows.map((r) => (
            <li key={r.id ?? "none"} className="flex flex-col gap-0.5 py-2.5">
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-semibold">{r.name}</span>
                <span className="text-[15px] font-semibold tabular-nums">{formatMoney(r.net)}</span>
              </span>
              <span className="text-[13px] text-muted">
                {r.heads} cab. hoy · ventas {formatMoney(r.sales)} · gastos {formatMoney(r.expenses)}
                {Object.keys(r.pension).length ? ` · pensión estimada ${formatMoney(r.pension)}` : ""}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs leading-relaxed text-muted">
          Ventas netas de gastos de la tropa, repartidas por cabeza cuando una tropa mezcla dueños. Lo que no tiene dueño cuenta para el campo.
          {Object.keys(summary.pensionTotal).length ? ` La pensión es la cuota por ${summary.months} meses, como referencia.` : ""}
        </p>
      </Card>

      {summary.pools.map((p) => (
        <Card key={p.id} className="flex flex-col gap-2">
          <SectionTitle>Reparto de {p.name}</SectionTitle>
          {p.shares.length ? (
            <ul className="flex flex-col divide-y divide-chip">
              {p.shares.map((s) => (
                <li key={s.name} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="text-[15px]">
                    {s.name} <span className="text-muted">· {s.percent.toLocaleString("es-UY")}%</span>
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums">{formatMoney(s.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">
              Falta poner los porcentajes de cada socio.{" "}
              <Link href={`${base}/${p.id}`} className="font-semibold text-brand">Ponerlos</Link>
            </p>
          )}
        </Card>
      ))}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <SectionTitle>Propietarios</SectionTitle>
          <Link href={`/c/${slug}/gastos`} className="py-1 text-[15px] font-semibold text-brand">Gastos</Link>
        </div>
        {owners.length ? (
          <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
            {owners.map((o) => (
              <li key={o.id} className="border-b border-chip last:border-b-0">
                <Link href={`${base}/${o.id}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 hover:bg-ground">
                  <span className="flex flex-col">
                    <span className="text-[15px] font-semibold">{o.name}</span>
                    <span className="text-[13px] text-muted">{ownerKindLabel(o.kind)}</span>
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums">{o.heads} cab.</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Card className="text-sm leading-relaxed text-ink-2">
            Si todos los animales son del campo, no hace falta cargar nada. Agregá propietarios cuando haya socios, animales de terceros en pensión o un pozo común.
          </Card>
        )}
      </section>

      <Card className="flex flex-col gap-4">
        <SectionTitle>Agregar propietario</SectionTitle>
        <OwnerForm slug={slug} kinds={OWNER_KINDS} hasFarmOwner={owners.some((o) => o.kind === "campo")} />
      </Card>
    </div>
  );
}
