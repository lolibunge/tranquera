"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { uniqueFarmSlug } from "@/lib/farms";

export type CreateFarmState = { error?: string; values?: Record<string, string> };

export async function createFarm(_prev: CreateFarmState, formData: FormData): Promise<CreateFarmState> {
  const user = await requireUser("/campos/nuevo");
  const values = {
    name: String(formData.get("name") ?? ""),
    location: String(formData.get("location") ?? ""),
  };
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Escribí el nombre del campo.").max(80, "El nombre es muy largo."),
      location: z.string().trim().max(120, "La ubicación es muy larga."),
    })
    .safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  const slug = await uniqueFarmSlug(parsed.data.name);
  await db.transaction(async (tx) => {
    const [farm] = await tx
      .insert(schema.farms)
      .values({ slug, name: parsed.data.name, locationText: parsed.data.location || null, createdBy: user.id })
      .returning({ id: schema.farms.id });
    await tx.insert(schema.memberships).values({ farmId: farm.id, userId: user.id, role: "dueno" });
  });
  redirect(`/c/${slug}`);
}
