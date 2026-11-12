import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getFarmAccess } from "@/lib/farms";
import { can } from "@/lib/roles";
import { getActiveSpecies } from "@/lib/farm-species";
import { FarmMark, SectionTitle } from "@/components/ui";
import { SetupChecklist } from "./setup-checklist";
import { AttendList } from "@/components/attend-list";
import Link from "next/link";
import { frostDays, getForecast } from "@/lib/weather";

const DAY = new Intl.DateTimeFormat("es-UY", { weekday: "long", timeZone: "UTC" });

export async function generateMetadata({ params }: PageProps<"/c/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { farm } = await getFarmAccess(slug);
  return { title: farm.name };
}

const DATE = new Intl.DateTimeFormat("es-UY", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Montevideo" });

export default async function FarmHome({ params }: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const { farm, role } = await getFarmAccess(slug);
  // Campo recién creado: primero el asistente (se puede saltear).
  if (!farm.setupDoneAt && can(role, "configurar")) redirect(`/c/${slug}/asistente`);
  const today = DATE.format(new Date());
  const [species, forecast] = await Promise.all([getActiveSpecies(farm.id), getForecast(farm.latitude, farm.longitude)]);
  const frost = frostDays(forecast);
  const now = forecast?.[0];
  const hasSpecies = species.length > 0;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <FarmMark name={farm.name} logo={farm.logo} />
        <div className="flex flex-col">
          <h1 className="text-base font-semibold">{farm.name}</h1>
          <p className="text-[13px] text-muted first-letter:uppercase">{today}</p>
        </div>
      </header>

      {now ? (
        <Link href={`/c/${slug}/clima?desde=inicio`} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
          <span className="flex flex-col">
            <span className="text-[15px] font-semibold">{now.label}</span>
            <span className="text-[13px] text-muted">
              {now.rainMm ? `${now.rainMm} mm de lluvia` : "Sin lluvia prevista"}
              {frost.length ? ` · riesgo de helada ${frost[0].date === forecast?.[0].date ? "hoy" : `el ${DAY.format(new Date(`${frost[0].date}T12:00:00Z`))}`}` : ""}
            </span>
          </span>
          <span className="text-xl font-semibold tabular-nums">
            {now.max !== null ? `${Math.round(now.max)}°` : ""}
            <span className="text-base text-muted"> / {now.min !== null ? `${Math.round(now.min)}°` : ""}</span>
          </span>
        </Link>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Para atender</SectionTitle>
          <Link href={`/c/${slug}/calendario?desde=inicio`} className="py-1 text-[15px] font-semibold text-brand">
            Calendario
          </Link>
        </div>
        <AttendList slug={slug} farmId={farm.id} activeSpecies={species.map((x) => x.key)} />
      </section>

      {can(role, "configurar") ? <SetupChecklist slug={slug} farm={farm} hasSpecies={hasSpecies} /> : null}
    </div>
  );
}
