"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getFarmAccess } from "@/lib/farms";
import { can } from "@/lib/roles";
import { createSession } from "@/lib/sessions";

export type SessionState = { error?: string };

export async function startSession(_prev: SessionState, formData: FormData): Promise<SessionState> {
  const access = await getFarmAccess(String(formData.get("slug") ?? ""));
  if (!can(access.role, "sanidad")) return { error: "No tenés permiso para cargar sanidad." };
  const get = (k: string) => String(formData.get(k) ?? "");
  const result = await createSession(access.farm.id, access.user.id, {
    species: get("species"),
    control: get("control"),
    label: get("label"),
    product: get("product"),
    batch: get("batch"),
    dose: get("dose"),
    date: get("date"),
    nextDueDate: get("nextDueDate") || null,
    vet: get("vet"),
    notes: get("notes"),
  });
  if (!result.ok) return { error: result.error };
  redirect(`/c/${access.farm.slug}/sanidad/manga/${result.value.id}`);
}

export async function closeSession(formData: FormData) {
  const access = await getFarmAccess(String(formData.get("slug") ?? ""));
  if (!can(access.role, "sanidad")) return;
  await db
    .update(schema.healthSessions)
    .set({ closedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.healthSessions.id, String(formData.get("id") ?? "")), eq(schema.healthSessions.farmId, access.farm.id)));
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  redirect(`/c/${access.farm.slug}/sanidad`);
}
