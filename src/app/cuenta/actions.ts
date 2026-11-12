"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { cookies } from "next/headers";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { hashPassword, hashToken, verifyPassword } from "@/lib/crypto";

export type AccountState = { error?: string; ok?: string; at?: number };

export async function saveName(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const user = await requireUser("/cuenta");
  const parsed = z.string().trim().min(2, "Escribí tu nombre.").max(80).safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.update(schema.users).set({ name: parsed.data, updatedAt: new Date() }).where(eq(schema.users.id, user.id));
  revalidatePath("/", "layout");
  return { ok: "Nombre guardado.", at: Date.now() };
}

export async function savePassword(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const user = await requireUser("/cuenta");
  const next = String(formData.get("password") ?? "");
  if (next.length < 8) return { error: "La contraseña nueva tiene que tener al menos 8 caracteres." };
  const [row] = await db.select({ passwordHash: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.id, user.id));
  if (row?.passwordHash && !(await verifyPassword(String(formData.get("current") ?? ""), row.passwordHash))) {
    return { error: "La contraseña actual no es correcta." };
  }
  await db.update(schema.users).set({ passwordHash: await hashPassword(next), updatedAt: new Date() }).where(eq(schema.users.id, user.id));
  // Cierra las otras sesiones abiertas (otros celulares), deja esta.
  const current = (await cookies()).get("tq_sesion")?.value;
  if (current) {
    await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, user.id), ne(schema.sessions.id, hashToken(current))));
  }
  return { ok: "Contraseña cambiada. Se cerraron las sesiones en otros dispositivos.", at: Date.now() };
}
