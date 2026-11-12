import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { isISODate, todayISO } from "./dates";

export type ForecastDay = {
  date: string;
  code: number;
  label: string;
  max: number | null;
  min: number | null;
  rainMm: number | null;
  rainChance: number | null;
};

const CODES: [number[], string][] = [
  [[0], "Despejado"],
  [[1, 2], "Parcialmente nublado"],
  [[3], "Nublado"],
  [[45, 48], "Niebla"],
  [[51, 53, 55, 56, 57], "Llovizna"],
  [[61, 63, 66, 80, 81], "Lluvia"],
  [[65, 67, 82], "Lluvia fuerte"],
  [[71, 73, 75, 77, 85, 86], "Nieve"],
  [[95, 96, 99], "Tormenta"],
];

function codeLabel(code: number) {
  return CODES.find(([codes]) => codes.includes(code))?.[1] ?? "—";
}

/** Pronóstico de 5 días de Open-Meteo (gratis, sin clave). Se guarda 30 minutos. */
export async function getForecast(latitude: number | null, longitude: number | null): Promise<ForecastDay[] | null> {
  if (latitude === null || longitude === null) return null;
  const search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone: "America/Montevideo",
    daily: "weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
    forecast_days: "5",
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${search}`, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      daily?: {
        time: string[];
        weathercode: number[];
        temperature_2m_max: (number | null)[];
        temperature_2m_min: (number | null)[];
        precipitation_sum: (number | null)[];
        precipitation_probability_max: (number | null)[];
      };
    };
    const d = data.daily;
    if (!d?.time?.length) return null;
    const round = (n: number | null | undefined) => (typeof n === "number" ? Math.round(n * 10) / 10 : null);
    return d.time.map((date, i) => ({
      date,
      code: d.weathercode[i],
      label: codeLabel(d.weathercode[i]),
      max: round(d.temperature_2m_max[i]),
      min: round(d.temperature_2m_min[i]),
      rainMm: round(d.precipitation_sum[i]),
      rainChance: typeof d.precipitation_probability_max[i] === "number" ? Math.round(d.precipitation_probability_max[i]!) : null,
    }));
  } catch {
    return null;
  }
}

/** Días del pronóstico con riesgo de helada (mínima de 2 °C o menos). */
export function frostDays(forecast: ForecastDay[] | null) {
  return (forecast ?? []).filter((d) => d.min !== null && d.min <= 2);
}

export const FROST_LEVELS = [
  { value: "leve", label: "Leve" },
  { value: "moderada", label: "Moderada" },
  { value: "fuerte", label: "Fuerte" },
] as const;

export async function saveWeatherLog(
  farmId: string,
  userId: string,
  input: { date: string; rainMm: number | null; frost: boolean; frostIntensity?: string | null; tempMin?: number | null; tempMax?: number | null; note: string | null },
) {
  if (!isISODate(input.date) || input.date > todayISO()) return { ok: false as const, error: "Revisá la fecha." };
  if (input.rainMm !== null && !(input.rainMm >= 0 && input.rainMm < 1000)) return { ok: false as const, error: "Revisá los milímetros." };
  const temp = (v: number | null | undefined) => (v === null || v === undefined ? null : v);
  const tempMin = temp(input.tempMin);
  const tempMax = temp(input.tempMax);
  if ([tempMin, tempMax].some((t) => t !== null && !(t > -30 && t < 55))) return { ok: false as const, error: "Revisá las temperaturas." };
  if (tempMin !== null && tempMax !== null && tempMin > tempMax) return { ok: false as const, error: "La mínima no puede ser mayor que la máxima." };
  if (input.rainMm === null && !input.frost && !input.note && tempMin === null && tempMax === null)
    return { ok: false as const, error: "Poné los milímetros, una temperatura, marcá la helada o escribí una nota." };
  const frostIntensity = input.frost && FROST_LEVELS.some((f) => f.value === input.frostIntensity) ? input.frostIntensity! : null;
  const values = { rainMm: input.rainMm, frost: input.frost, frostIntensity, tempMin, tempMax, note: input.note };
  await db
    .insert(schema.weatherLogs)
    .values({ farmId, date: input.date, ...values, createdBy: userId })
    .onConflictDoUpdate({
      target: [schema.weatherLogs.farmId, schema.weatherLogs.date],
      set: { ...values, updatedAt: new Date() },
    });
  return { ok: true as const };
}

export async function weatherLogs(farmId: string) {
  return db.select().from(schema.weatherLogs).where(eq(schema.weatherLogs.farmId, farmId)).orderBy(desc(schema.weatherLogs.date)).limit(60);
}

export async function rainTotals(farmId: string) {
  const today = todayISO();
  const [row] = await db
    .select({
      month: sql<number>`coalesce(sum(${schema.weatherLogs.rainMm}) filter (where to_char(${schema.weatherLogs.date}, 'YYYY-MM') = ${today.slice(0, 7)}), 0)::float`,
      year: sql<number>`coalesce(sum(${schema.weatherLogs.rainMm}) filter (where to_char(${schema.weatherLogs.date}, 'YYYY') = ${today.slice(0, 4)}), 0)::float`,
      frosts: sql<number>`count(*) filter (where ${schema.weatherLogs.frost} and to_char(${schema.weatherLogs.date}, 'YYYY') = ${today.slice(0, 4)})::int`,
    })
    .from(schema.weatherLogs)
    .where(and(eq(schema.weatherLogs.farmId, farmId)));
  return row ?? { month: 0, year: 0, frosts: 0 };
}
