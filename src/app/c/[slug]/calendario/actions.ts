"use server";

import { revalidatePath } from "next/cache";
import { getFarmAccess } from "@/lib/farms";
import { can } from "@/lib/roles";
import { createTask, deleteTask, setTaskDone } from "@/lib/calendar";

export type TaskState = { error?: string; ok?: string; at?: number };

export async function createTaskAction(_prev: TaskState, f: FormData): Promise<TaskState> {
  const access = await getFarmAccess(String(f.get("slug") ?? ""));
  if (!can(access.role, "cargar")) return { error: "No tenés permiso para agregar tareas." };
  const result = await createTask(access.farm.id, access.user.id, {
    date: String(f.get("date") ?? ""),
    title: String(f.get("title") ?? ""),
    notes: String(f.get("notes") ?? ""),
  });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  return { ok: "Tarea agregada.", at: Date.now() };
}

export async function toggleTaskAction(f: FormData) {
  const access = await getFarmAccess(String(f.get("slug") ?? ""));
  if (!can(access.role, "cargar")) return;
  await setTaskDone(access.farm.id, String(f.get("id") ?? ""), f.get("done") === "1");
  revalidatePath(`/c/${access.farm.slug}`, "layout");
}

export async function deleteTaskAction(f: FormData) {
  const access = await getFarmAccess(String(f.get("slug") ?? ""));
  if (!can(access.role, "cargar")) return;
  await deleteTask(access.farm.id, String(f.get("id") ?? ""));
  revalidatePath(`/c/${access.farm.slug}`, "layout");
}
