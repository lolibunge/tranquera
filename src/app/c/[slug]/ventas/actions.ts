"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getFarmAccess } from "@/lib/farms";
import { can } from "@/lib/roles";
import { createSale } from "@/lib/sales";

export type SaleState = { error?: string };

export async function createSaleAction(_prev: SaleState, formData: FormData): Promise<SaleState> {
  const access = await getFarmAccess(String(formData.get("slug") ?? ""));
  if (!can(access.role, "cargar")) return { error: "No tenés permiso para registrar ventas." };
  const t = (k: string) => String(formData.get(k) ?? "");
  const result = await createSale(access.farm.id, access.user.id, {
    animalIds: formData.getAll("animal").map(String),
    date: t("date"),
    buyer: t("buyer"),
    intermediary: t("intermediary"),
    guide: t("guide"),
    priceMode: t("priceMode") === "cabeza" ? "cabeza" : "kilo",
    kilos: t("kilos"),
    unitPrice: t("unitPrice"),
    currency: t("currency") === "UYU" ? "UYU" : "USD",
    expenses: t("expenses"),
    notes: t("notes"),
  });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  redirect(`/c/${access.farm.slug}/ventas/${result.value.id}`);
}
