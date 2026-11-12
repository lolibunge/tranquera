import type { Metadata } from "next";
import Link from "next/link";
import { getFarmAccess } from "@/lib/farms";
import { getForecast, rainTotals, weatherLogs } from "@/lib/weather";
import { formatDate, todayISO } from "@/lib/dates";
import { can } from "@/lib/roles";
import { BackLink, Card, PageTitle, SectionTitle } from "@/components/ui";
import { ForecastStrip } from "@/components/forecast";
import { WeatherForm } from "./form";

export const metadata: Metadata = { title: "Clima y lluvias" };

export default async function WeatherPage({ params }: PageProps<"/c/[slug]/clima">) {
  const { slug } = await params;
  const { farm, role } = await getFarmAccess(slug);
  const [forecast, logs, totals] = await Promise.all([getForecast(farm.latitude, farm.longitude), weatherLogs(farm.id), rainTotals(farm.id)]);
  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/c/${slug}/mas`} label="Volver" />
      <PageTitle>Clima y lluvias</PageTitle>

      <section className="flex flex-col gap-3">
        <SectionTitle>Pronóstico</SectionTitle>
        {farm.latitude === null ? (
          <Card className="text-sm text-ink-2">
            Para ver el pronóstico, cargá la ubicación en{" "}
            <Link href={`/c/${slug}/configuracion`} className="font-semibold text-brand">
              Datos del campo
            </Link>
            .
          </Card>
        ) : forecast ? (
          <ForecastStrip days={forecast} />
        ) : (
          <Card className="text-sm text-ink-2">No pudimos traer el pronóstico ahora. Probá en un rato.</Card>
        )}
      </section>

      <section className="grid grid-cols-3 gap-2.5">
        <Card className="text-center">
          <p className="text-xs text-muted">Lluvia del mes</p>
          <p className="text-xl font-semibold tabular-nums">{Math.round(totals.month)} mm</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-muted">Lluvia del año</p>
          <p className="text-xl font-semibold tabular-nums">{Math.round(totals.year)} mm</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-muted">Heladas del año</p>
          <p className="text-xl font-semibold tabular-nums">{totals.frosts}</p>
        </Card>
      </section>

      {can(role, "cargar") ? (
        <Card className="flex flex-col gap-4">
          <SectionTitle>Registrar lluvia o helada</SectionTitle>
          <WeatherForm slug={slug} today={todayISO()} />
        </Card>
      ) : null}

      {logs.length ? (
        <section className="flex flex-col gap-3">
          <SectionTitle>Registro</SectionTitle>
          <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 border-b border-chip px-4 py-2.5 last:border-b-0">
                <span className="flex flex-col">
                  <span className="text-[15px] font-semibold">{formatDate(l.date)}</span>
                  {l.note ? <span className="text-[13px] text-muted">{l.note}</span> : null}
                </span>
                <span className="text-right text-[15px] font-semibold tabular-nums">
                  {l.rainMm !== null ? `${l.rainMm} mm` : ""}
                  {l.frost ? <span className="block text-xs font-semibold text-info-fg">Helada</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
