"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getFarmAccess } from "@/lib/farms";
import { can } from "@/lib/roles";
import { archiveSupply, createSupply, deleteSupplyMove, recordSupplyMove, updateSupply } from "@/lib/stock";

export type StockState = { error?: string; ok?: string; at?: number };

const text = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function createSupplyAction(_prev: StockState, f: FormData): Promise<StockState> {
  const access = await getFarmAccess(text(f, "slug"));
  if (!can(access.role, "cargar")) return { error: "No tenés permiso para cargar insumos." };
  const result = await createSupply(access.farm.id, access.user.id, {
    name: text(f, "name"),
    category: text(f, "category"),
    unit: text(f, "unit"),
    minimum: text(f, "minimum"),
    initial: text(f, "initial"),
    notes: text(f, "notes"),
  });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  redirect(`/c/${access.farm.slug}/stock/${result.value.id}`);
}

export async function updateSupplyAction(_prev: StockState, f: FormData): Promise<StockState> {
  const access = await getFarmAccess(text(f, "slug"));
  if (!can(access.role, "cargar")) return { error: "No tenés permiso para editar insumos." };
  const result = await updateSupply(access.farm.id, text(f, "id"), {
    name: text(f, "name"),
    category: text(f, "category"),
    unit: text(f, "unit"),
    minimum: text(f, "minimum"),
    notes: text(f, "notes"),
  });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  return { ok: "Guardado.", at: Date.now() };
}

export async function recordMoveAction(_prev: StockState, f: FormData): Promise<StockState> {
  const access = await getFarmAccess(text(f, "slug"));
  if (!can(access.role, "cargar")) return { error: "No tenés permiso para mover stock." };
  const kind = text(f, "kind");
  const result = await recordSupplyMove(access.farm.id, access.user.id, {
    supplyId: text(f, "supplyId"),
    kind: kind === "entrada" || kind === "ajuste" ? kind : "consumo",
    quantity: text(f, "quantity"),
    date: text(f, "date"),
    unitCost: text(f, "unitCost"),
    currency: text(f, "currency") === "UYU" ? "UYU" : "USD",
    note: text(f, "note"),
  });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  return { ok: kind === "entrada" ? "Entrada registrada." : kind === "ajuste" ? "Stock ajustado." : "Consumo registrado.", at: Date.now() };
}

export async function deleteMoveAction(f: FormData) {
  const access = await getFarmAccess(text(f, "slug"));
  if (!can(access.role, "cargar")) return;
  await deleteSupplyMove(access.farm.id, text(f, "moveId"));
  revalidatePath(`/c/${access.farm.slug}`, "layout");
}

export async function archiveSupplyAction(f: FormData) {
  const access = await getFarmAccess(text(f, "slug"));
  if (!can(access.role, "cargar")) return;
  await archiveSupply(access.farm.id, text(f, "id"));
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  redirect(`/c/${access.farm.slug}/stock`);
}
