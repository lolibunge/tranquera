"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getFarmAccess } from "@/lib/farms";
import { can, type Permission } from "@/lib/roles";
import { deleteReading, deleteWork, recordReading, recordWork } from "@/lib/pasture";
import { archivePaddock, archiveUnmapped, deleteMap, moveAnimals, nameShape, saveMap, savePaddock } from "@/lib/paddocks";

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
    {
      name: text(formData, "name"),
      hectares: text(formData, "hectares"),
      kind: text(formData, "kind"),
      notes: text(formData, "notes"),
      parentId: formData.has("parentId") ? text(formData, "parentId") : undefined,
      zone: formData.has("zone") ? text(formData, "zone") : undefined,
      restSince: formData.has("restSince") ? text(formData, "restSince") : undefined,
    },
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
    result.orphans ? `${result.orphans} potreros que tenías no están en este mapa: abajo podés archivarlos.` : "",
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

export async function archiveUnmappedAction(_prev: PaddockState, formData: FormData): Promise<PaddockState> {
  const { access, denied } = await guard(formData, "configurar");
  if (denied) return { error: denied };
  const r = await archiveUnmapped(access.farm.id);
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  return {
    ok:
      `Se archivaron ${r.archived} potreros.` +
      (r.withAnimals.length ? ` Quedan ${r.withAnimals.length} con animales (${r.withAnimals.join(", ")}): movelos y volvé a archivar.` : ""),
    at: Date.now(),
  };
}

export async function recordWorkAction(_prev: PaddockState, f: FormData): Promise<PaddockState> {
  const access = await getFarmAccess(text(f, "slug"));
  if (!can(access.role, "cargar")) return { error: "No tenés permiso para cargar laboreos." };
  const result = await recordWork(access.farm.id, access.user.id, {
    paddockId: text(f, "paddockId"),
    kind: text(f, "kind"),
    date: text(f, "date"),
    readyOn: text(f, "readyOn"),
    doneBy: text(f, "doneBy"),
    notes: text(f, "notes"),
  });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  return { ok: "Laboreo registrado.", at: Date.now() };
}

export async function recordReadingAction(_prev: PaddockState, f: FormData): Promise<PaddockState> {
  const access = await getFarmAccess(text(f, "slug"));
  if (!can(access.role, "cargar")) return { error: "No tenés permiso para cargar mediciones." };
  const result = await recordReading(access.farm.id, access.user.id, {
    paddockId: text(f, "paddockId"),
    date: text(f, "date"),
    direct: text(f, "direct"),
    samples: text(f, "samples"),
    areaM2: text(f, "areaM2"),
    mode: text(f, "mode") === "seco" ? "seco" : "verde",
    dmPct: text(f, "dmPct"),
    height: text(f, "height"),
    notes: text(f, "notes"),
  });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  return { ok: `Medición guardada: ${result.value.kg.toLocaleString("es-UY")} kg MS/ha.`, at: Date.now() };
}

export async function deleteWorkAction(f: FormData) {
  const access = await getFarmAccess(text(f, "slug"));
  if (!can(access.role, "cargar")) return;
  await deleteWork(access.farm.id, text(f, "id"));
  revalidatePath(`/c/${access.farm.slug}`, "layout");
}

export async function deleteReadingAction(f: FormData) {
  const access = await getFarmAccess(text(f, "slug"));
  if (!can(access.role, "cargar")) return;
  await deleteReading(access.farm.id, text(f, "id"));
  revalidatePath(`/c/${access.farm.slug}`, "layout");
}
