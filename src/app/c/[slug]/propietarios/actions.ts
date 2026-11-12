"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getFarmAccess } from "@/lib/farms";
import { can } from "@/lib/roles";
import { parseAmount } from "@/lib/number";
import { archiveOwner, assignAnimals, createExpense, deleteExpense, saveOwner, savePoolShares } from "@/lib/owners";

export type OwnerState = { error?: string; ok?: string; at?: number };
const t = (f: FormData, k: string) => String(f.get(k) ?? "");

async function access(f: FormData) {
  const a = await getFarmAccess(t(f, "slug"));
  return can(a.role, "cuentas") ? a : null;
}

export async function saveOwnerAction(_prev: OwnerState, f: FormData): Promise<OwnerState> {
  const a = await access(f);
  if (!a) return { error: "No tenés permiso para manejar propietarios." };
  const id = t(f, "id") || null;
  const result = await saveOwner(a.farm.id, id, {
    name: t(f, "name"),
    kind: t(f, "kind") as never,
    phone: t(f, "phone"),
    monthlyFee: t(f, "monthlyFee"),
    currency: t(f, "currency") === "UYU" ? "UYU" : "USD",
    notes: t(f, "notes"),
  });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/c/${a.farm.slug}`, "layout");
  if (!id) redirect(`/c/${a.farm.slug}/propietarios/${result.value.id}`);
  return { ok: "Guardado.", at: Date.now() };
}

export async function saveSharesAction(_prev: OwnerState, f: FormData): Promise<OwnerState> {
  const a = await access(f);
  if (!a) return { error: "No tenés permiso." };
  const shares = f
    .getAll("partner")
    .map(String)
    .map((partnerId) => ({ partnerId, percent: parseAmount(t(f, `pct-${partnerId}`)) ?? 0 }));
  const result = await savePoolShares(a.farm.id, t(f, "id"), shares);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/c/${a.farm.slug}`, "layout");
  return { ok: "Porcentajes guardados.", at: Date.now() };
}

export async function assignAnimalsAction(_prev: OwnerState, f: FormData): Promise<OwnerState> {
  const a = await access(f);
  if (!a) return { error: "No tenés permiso." };
  const result = await assignAnimals(a.farm.id, t(f, "id"), f.getAll("animal").map(String));
  if (!result.ok) return { error: result.error };
  revalidatePath(`/c/${a.farm.slug}`, "layout");
  redirect(`/c/${a.farm.slug}/propietarios/${t(f, "id")}`);
}

export async function archiveOwnerAction(f: FormData) {
  const a = await access(f);
  if (!a) return;
  await archiveOwner(a.farm.id, t(f, "id"));
  revalidatePath(`/c/${a.farm.slug}`, "layout");
  redirect(`/c/${a.farm.slug}/propietarios`);
}

export async function createExpenseAction(_prev: OwnerState, f: FormData): Promise<OwnerState> {
  const a = await access(f);
  if (!a) return { error: "No tenés permiso para cargar gastos." };
  const result = await createExpense(a.farm.id, a.user.id, {
    date: t(f, "date"),
    concept: t(f, "concept"),
    category: t(f, "category"),
    amount: t(f, "amount"),
    currency: t(f, "currency") === "UYU" ? "UYU" : "USD",
    ownerId: t(f, "ownerId") || null,
    supplier: t(f, "supplier"),
    notes: t(f, "notes"),
  });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/c/${a.farm.slug}`, "layout");
  return { ok: "Gasto registrado.", at: Date.now() };
}

export async function deleteExpenseAction(f: FormData) {
  const a = await access(f);
  if (!a) return;
  await deleteExpense(a.farm.id, t(f, "id"));
  revalidatePath(`/c/${a.farm.slug}`, "layout");
}
