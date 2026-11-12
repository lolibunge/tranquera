"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getFarmAccess } from "@/lib/farms";
import { can, type Permission } from "@/lib/roles";
import { archivePaddock, deleteMap, moveAnimals, nameShape, saveMap, savePaddock } from "@/lib/paddocks";

export type PaddockState = { error?: string; ok?: string; at?: number };

async function guard(formData: FormData, permission: Permission) {
  const access = await getFarmAccess(String(formData.get("slug") ?? ""));
  return can(access.role, permission) ? { access, denied: null } : { access, denied: "No tenés permiso para hacer esto en este campo." };
}
const text = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function savePaddockAction(_prev: PaddockState, formData: FormData): Promise<PaddockState> {
  const { access, denied } = await guard(formData, "configurar");
  if (denied) return { error: denied };
  const id = text(formData, "id") || undefined;
  const result = await savePaddock(
    access.farm.id,
    { name: text(formData, "name"), hectares: text(formData, "hectares"), kind: text(formData, "kind"), notes: text(formData, "notes") },
    id,
  );
  if (!result.ok) return { error: result.error };
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  if (id) return { ok: "Potrero guardado.", at: Date.now() };
  redirect(`/c/${access.farm.slug}/potreros/${result.value.id}`);
}

export async function archivePaddockAction(formData: FormData) {
  const { access, denied } = await guard(formData, "configurar");
  if (denied) return;
  await archivePaddock(access.farm.id, text(formData, "id"));
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  redirect(`/c/${access.farm.slug}/potreros`);
}

export async function uploadMapAction(_prev: PaddockState, formData: FormData): Promise<PaddockState> {
  const { access, denied } = await guard(formData, "configurar");
  if (denied) return { error: denied };
  const file = formData.get("map");
  if (!(file instanceof File) || !file.size) return { error: "Elegí el archivo SVG del mapa." };
  if (file.size > 2_000_000) return { error: "El mapa pesa más de 2 MB." };
  const result = await saveMap(access.farm.id, await file.text());
  if (!result.ok) return { error: result.error };
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  const parts = [
    `Mapa guardado con ${result.names.length} potreros con nombre${result.fromText ? ` (${result.fromText} tomados de los textos del mapa)` : ""}.`,
    result.created ? `Se crearon ${result.created} potreros nuevos.` : "",
    result.unnamed ? `Quedan ${result.unnamed} divisiones sin nombre: tocá "Nombrar las divisiones".` : "",
  ];
  return { ok: parts.filter(Boolean).join(" "), at: Date.now() };
}

export async function deleteMapAction(formData: FormData) {
  const { access, denied } = await guard(formData, "configurar");
  if (denied) return;
  await deleteMap(access.farm.id);
  revalidatePath(`/c/${access.farm.slug}`, "layout");
}

export async function moveAction(_prev: PaddockState, formData: FormData): Promise<PaddockState> {
  const { access, denied } = await guard(formData, "cargar");
  if (denied) return { error: denied };
  const to = text(formData, "to");
  const result = await moveAnimals(access.farm.id, access.user.id, {
    animalIds: formData.getAll("animal").map(String),
    toPaddockId: to === "ninguno" ? null : to,
    date: text(formData, "date"),
    note: text(formData, "note") || null,
  });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  return {
    ok: result.moved ? `Listo: ${result.moved} ${result.moved === 1 ? "animal movido" : "animales movidos"}.` : "Ya estaban en ese potrero.",
    at: Date.now(),
  };
}

export async function nameShapeAction(_prev: PaddockState, formData: FormData): Promise<PaddockState> {
  const { access, denied } = await guard(formData, "configurar");
  if (denied) return { error: denied };
  const result = await nameShape(access.farm.id, Number(formData.get("index")), {
    name: text(formData, "name") || null,
    background: formData.get("background") === "1",
  });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  return { ok: formData.get("background") === "1" ? "Marcada como fondo." : `Guardado: ${text(formData, "name")}.`, at: Date.now() };
}
