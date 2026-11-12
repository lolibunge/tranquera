"use server";

import { revalidatePath } from "next/cache";
import { getFarmAccess } from "@/lib/farms";
import { can } from "@/lib/roles";
import { saveWeatherLog } from "@/lib/weather";
import { parseAmount } from "@/lib/number";

export type WeatherState = { error?: string; ok?: string; at?: number };

export async function saveWeatherAction(_prev: WeatherState, formData: FormData): Promise<WeatherState> {
  const access = await getFarmAccess(String(formData.get("slug") ?? ""));
  if (!can(access.role, "cargar")) return { error: "No tenés permiso para cargar datos." };
  const mm = String(formData.get("rainMm") ?? "").trim();
  const num = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v ? parseAmount(v.replace(/^−/, "-")) : null;
  };
  const result = await saveWeatherLog(access.farm.id, access.user.id, {
    date: String(formData.get("date") ?? ""),
    rainMm: mm ? parseAmount(mm) : null,
    frost: formData.get("frost") === "on",
    frostIntensity: String(formData.get("frostIntensity") ?? "") || null,
    tempMin: num("tempMin"),
    tempMax: num("tempMax"),
    note: String(formData.get("note") ?? "").trim() || null,
  });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/c/${access.farm.slug}/clima`);
  return { ok: "Guardado.", at: Date.now() };
}
