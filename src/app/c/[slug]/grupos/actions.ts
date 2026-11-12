"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getFarmAccess } from "@/lib/farms";
import { can } from "@/lib/roles";
import { archiveHerd, saveHerd, setHerdMembers } from "@/lib/herds";

export type HerdState = { error?: string; ok?: string; at?: number };
const t = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function saveHerdAction(_prev: HerdState, f: FormData): Promise<HerdState> {
  const a = await getFarmAccess(t(f, "slug"));
  if (!can(a.role, "cargar")) return { error: "No tenés permiso para manejar grupos." };
  const id = t(f, "id") || null;
  const result = await saveHerd(a.farm.id, id, { name: t(f, "name"), notes: t(f, "notes") });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/c/${a.farm.slug}`, "layout");
  if (!id) redirect(`/c/${a.farm.slug}/grupos/${result.value.id}?elegir=1`);
  return { ok: "Guardado.", at: Date.now() };
}

export async function setMembersAction(_prev: HerdState, f: FormData): Promise<HerdState> {
  const a = await getFarmAccess(t(f, "slug"));
  if (!can(a.role, "cargar")) return { error: "No tenés permiso." };
  const result = await setHerdMembers(a.farm.id, t(f, "id"), f.getAll("animal").map(String), t(f, "date"));
  if (!result.ok) return { error: result.error };
  revalidatePath(`/c/${a.farm.slug}`, "layout");
  redirect(`/c/${a.farm.slug}/grupos/${t(f, "id")}`);
}

export async function archiveHerdAction(f: FormData) {
  const a = await getFarmAccess(t(f, "slug"));
  if (!can(a.role, "cargar")) return;
  await archiveHerd(a.farm.id, t(f, "id"));
  revalidatePath(`/c/${a.farm.slug}`, "layout");
  redirect(`/c/${a.farm.slug}/grupos`);
}
