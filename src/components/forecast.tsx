import type { ForecastDay } from "@/lib/weather";

const DAY = new Intl.DateTimeFormat("es-UY", { weekday: "short", timeZone: "UTC" });

/** Cinco días de pronóstico, en una fila que se desliza en el celular. */
export function ForecastStrip({ days }: { days: ForecastDay[] }) {
  return (
    <ul className="grid grid-flow-col auto-cols-[minmax(7rem,1fr)] gap-2 overflow-x-auto pb-1">
      {days.map((d, i) => (
        <li key={d.date} className={`flex flex-col gap-1 rounded-2xl border bg-surface p-3 ${d.min !== null && d.min <= 2 ? "border-info-fg/40" : "border-line"}`}>
          <span className="text-xs font-semibold text-muted first-letter:uppercase">{i === 0 ? "Hoy" : DAY.format(new Date(`${d.date}T12:00:00Z`))}</span>
          <span className="text-[13px] leading-tight font-semibold">{d.label}</span>
          <span className="text-[15px] font-semibold tabular-nums">
            {d.max !== null ? `${Math.round(d.max)}°` : "—"} <span className="text-muted">/ {d.min !== null ? `${Math.round(d.min)}°` : "—"}</span>
          </span>
          <span className="text-xs text-muted tabular-nums">
            {d.rainMm ? `${d.rainMm} mm` : "Sin lluvia"}
            {d.rainChance !== null && d.rainMm ? ` · ${d.rainChance}%` : ""}
          </span>
          {d.min !== null && d.min <= 2 ? <span className="text-xs font-semibold text-info-fg">Riesgo de helada</span> : null}
        </li>
      ))}
    </ul>
  );
}
