// Celulares de Uruguay: se guardan como 09XXXXXXX. Acepta +598, espacios y guiones.
export function normalizePhone(raw: string) {
  let digits = raw.replace(/\D+/g, "");
  if (digits.startsWith("598")) digits = `0${digits.slice(3)}`;
  if (digits.length === 8 && digits.startsWith("9")) digits = `0${digits}`;
  return digits;
}

export function isValidPhone(normalized: string) {
  return /^0\d{7,11}$/.test(normalized);
}

export function formatPhone(normalized: string | null | undefined) {
  if (!normalized) return "";
  const m = normalized.match(/^(09\d)(\d{3})(\d{3})$/);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : normalized;
}

export function looksLikeEmail(value: string) {
  return value.includes("@");
}
