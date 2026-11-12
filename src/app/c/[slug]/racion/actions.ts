"use server";

import { revalidatePath } from "next/cache";
import { getFarmAccess } from "@/lib/farms";
import { can } from "@/lib/roles";
import { addPlanItem, giveRound, removePlanItem, undoRound } from "@/lib/feeding";

export type FeedState = { error?: string; ok?: string; at?: number };
const t = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function giveRoundAction(_prev: FeedState, f: FormData): Promise<FeedState> {
  const a = await getFarmAccess(t(f, "slug"));
  if (!can(a.role, "cargar")) return { error: "No tenés permiso para registrar raciones." };
  const result = await giveRound(a.farm.id, a.user.id, { date: t(f, "date"), slot: t(f, "slot"), skip: f.getAll("skip").map(String) });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/c/${a.farm.slug}`, "layout");
  return { ok: `Listo: ración dada a ${result.value.fed} animal${result.value.fed === 1 ? "" : "es"}. Se descontó del stock.`, at: Date.now() };
}

export async function undoRoundAction(f: FormData) {
  const a = await getFarmAccess(t(f, "slug"));
  if (!can(a.role, "cargar")) return;
  await undoRound(a.farm.id, t(f, "id"));
  revalidatePath(`/c/${a.farm.slug}`, "layout");
}

export async function addPlanAction(_prev: FeedState, f: FormData): Promise<FeedState> {
  const a = await getFarmAccess(t(f, "slug"));
  if (!can(a.role, "cargar")) return { error: "No tenés permiso." };
  const result = await addPlanItem(a.farm.id, {
    animalId: t(f, "animalId"),
    supplyId: t(f, "supplyId"),
    slots: f.getAll("slot").map(String),
    quantity: t(f, "quantity"),
    notes: t(f, "notes"),
  });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/c/${a.farm.slug}`, "layout");
  return { ok: "Ración guardada.", at: Date.now() };
}

export async function removePlanAction(f: FormData) {
  const a = await getFarmAccess(t(f, "slug"));
  if (!can(a.role, "cargar")) return;
  await removePlanItem(a.farm.id, t(f, "id"));
  revalidatePath(`/c/${a.farm.slug}`, "layout");
}
