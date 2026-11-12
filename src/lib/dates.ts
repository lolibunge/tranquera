// Fechas del campo: todo en hora de Uruguay y como texto AAAA-MM-DD (columnas date).
export const TZ = "America/Montevideo";

export function todayISO(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string) {
  return Math.round((Date.parse(`${toIso}T12:00:00Z`) - Date.parse(`${fromIso}T12:00:00Z`)) / 86_400_000);
}

export function isISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

const SHORT = new Intl.DateTimeFormat("es-UY", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const LONG = new Intl.DateTimeFormat("es-UY", { day: "numeric", month: "long", timeZone: "UTC" });

export function formatDate(iso: string | null | undefined) {
  return iso ? SHORT.format(new Date(`${iso}T12:00:00Z`)) : "";
}

export function formatDayMonth(iso: string | null | undefined) {
  return iso ? LONG.format(new Date(`${iso}T12:00:00Z`)) : "";
}

/** "Hoy", "hace 3 días", "en 5 días". */
export function relativeDays(iso: string, today = todayISO()) {
  const diff = daysBetween(today, iso);
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff === -1) return "ayer";
  return diff > 0 ? `en ${diff} días` : `hace ${-diff} días`;
}

/** Edad legible a partir de la fecha de nacimiento. */
export function ageLabel(birth: string | null | undefined, today = todayISO()) {
  if (!birth) return "";
  const days = daysBetween(birth, today);
  if (days < 0) return "";
  if (days < 60) return `${days} días`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} meses`;
  return `${Math.floor(months / 12)} años`;
}
