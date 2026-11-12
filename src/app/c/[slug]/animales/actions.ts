"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getFarmAccess } from "@/lib/farms";
import { can, type Permission } from "@/lib/roles";
import { createAnimal, createManyByTag, setAnimalStatus, updateAnimal, type AnimalInput } from "@/lib/animals";
import { recordHealth } from "@/lib/health";
import { parseTagList } from "@/lib/catalogo";

export type AnimalFormState = { error?: string; ok?: string; at?: number; values?: Record<string, string> };

async function guard(formData: FormData, permission: Permission) {
  const access = await getFarmAccess(String(formData.get("slug") ?? ""));
  return can(access.role, permission) ? { access, denied: null } : { access, denied: "No tenés permiso para cargar datos en este campo." };
}

function text(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function readAnimal(formData: FormData): AnimalInput {
  return {
    species: text(formData, "species"),
    isLot: formData.get("isLot") === "1",
    headCount: Number(text(formData, "headCount") || 1),
    category: text(formData, "category"),
    name: text(formData, "name"),
    tagVisual: text(formData, "tagVisual"),
    tagRfid: text(formData, "tagRfid"),
    birthDate: text(formData, "birthDate"),
    breed: text(formData, "breed"),
    origin: (text(formData, "origin") || null) as "nacido" | "comprado" | null,
    originDetail: text(formData, "originDetail"),
    arrivedOn: text(formData, "arrivedOn"),
    notes: text(formData, "notes"),
  };
}

const KEEP = ["species", "category", "breed", "origin", "originDetail", "arrivedOn", "isLot"];

export async function saveAnimal(_prev: AnimalFormState, formData: FormData): Promise<AnimalFormState> {
  const { access, denied } = await guard(formData, "cargar");
  if (denied) return { error: denied };
  const id = text(formData, "id");
  const input = readAnimal(formData);
  const values = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const result = id ? await updateAnimal(access.farm.id, id, input) : await createAnimal(access.farm.id, access.user.id, input);
  if (!result.ok) return { error: result.error, values };
  const base = `/c/${access.farm.slug}/animales`;
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  if (!id && formData.get("then") === "otro") {
    // Guarda y deja el formulario listo para el siguiente, con categoría, raza y origen.
    const keep = Object.fromEntries(KEEP.map((k) => [k, values[k] ?? ""]));
    const label = input.name || input.tagVisual || input.tagRfid || "Animal";
    return { ok: `${label} guardado. Seguí con el próximo.`, at: Date.now(), values: keep };
  }
  redirect(`${base}/${result.value.id}`);
}

export async function saveMany(_prev: AnimalFormState, formData: FormData): Promise<AnimalFormState & { created?: number; skipped?: string[] }> {
  const { access, denied } = await guard(formData, "cargar");
  if (denied) return { error: denied };
  const tags = parseTagList(text(formData, "tags"));
  const result = await createManyByTag(access.farm.id, access.user.id, {
    species: text(formData, "species"),
    category: text(formData, "category"),
    tags,
    breed: text(formData, "breed") || null,
    birthDate: text(formData, "birthDate") || null,
    origin: (text(formData, "origin") || null) as "nacido" | "comprado" | null,
  });
  if (!result.ok) return { error: result.error, values: { tags: text(formData, "tags"), category: text(formData, "category"), breed: text(formData, "breed") } };
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  const { created, skipped } = result.value;
  return {
    ok: created ? `Se cargaron ${created} ${created === 1 ? "animal" : "animales"}.` : "No había caravanas nuevas para cargar.",
    created,
    skipped,
    at: Date.now(),
  };
}

export async function changeStatus(_prev: AnimalFormState, formData: FormData): Promise<AnimalFormState> {
  const { access, denied } = await guard(formData, "cargar");
  if (denied) return { error: denied };
  const status = text(formData, "status");
  if (!["activo", "vendido", "muerto", "baja"].includes(status)) return { error: "Elegí el motivo." };
  const result = await setAnimalStatus(
    access.farm.id,
    text(formData, "id"),
    status as "activo" | "vendido" | "muerto" | "baja",
    text(formData, "date") || null,
    text(formData, "note") || null,
  );
  if (!result.ok) return { error: result.error };
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  return { ok: status === "activo" ? "Volvió al padrón." : "Listo, quedó fuera del padrón.", at: Date.now() };
}

export async function addHealth(_prev: AnimalFormState, formData: FormData): Promise<AnimalFormState> {
  const { access, denied } = await guard(formData, "sanidad");
  if (denied) return { error: "No tenés permiso para cargar sanidad en este campo." };
  const result = await recordHealth(access.farm.id, access.user.id, {
    animalId: text(formData, "animalId"),
    control: text(formData, "control"),
    label: text(formData, "label"),
    product: text(formData, "product"),
    batch: text(formData, "batch"),
    dose: text(formData, "dose"),
    date: text(formData, "date"),
    nextDueDate: text(formData, "nextDueDate") || null,
    vet: text(formData, "vet"),
    notes: text(formData, "notes"),
  });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  return { ok: "Registro guardado.", at: Date.now() };
}
