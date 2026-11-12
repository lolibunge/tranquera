"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCurrentUser, startSession } from "@/lib/auth";
import { hashPassword } from "@/lib/crypto";
import { findOpenInvitation } from "@/lib/invitations";

export type AcceptState = { error?: string; values?: { name?: string } };

/**
 * Acepta la invitación. Si ya hay sesión con el mismo mail, suma al campo.
 * Si no hay cuenta, la crea con nombre y contraseña: abrir el enlace prueba que el mail es suyo.
 */
export async function acceptInvitation(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
  const token = String(formData.get("token") ?? "");
  const invitation = await findOpenInvitation(token);
  if (!invitation) return { error: "La invitación ya se usó, se canceló o venció. Pedí una nueva." };

  let userId: string;
  const current = await getCurrentUser();
  if (current) {
    if (current.email !== invitation.email) return { error: `Esta invitación es para ${invitation.email}. Salí y entrá con ese mail.` };
    userId = current.id;
  } else {
    const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, invitation.email)).limit(1);
    if (existing) return { error: "Ya tenés cuenta con ese mail: entrá primero y después aceptá." };
    const values = { name: String(formData.get("name") ?? "") };
    const parsed = z
      .object({
        name: z.string().trim().min(2, "Escribí tu nombre.").max(80),
        password: z.string().min(8, "La contraseña tiene que tener al menos 8 caracteres.").max(200),
      })
      .safeParse({ ...values, password: formData.get("password") });
    if (!parsed.success) return { error: parsed.error.issues[0].message, values };
    const [created] = await db
      .insert(schema.users)
      .values({ email: invitation.email, name: parsed.data.name, passwordHash: await hashPassword(parsed.data.password) })
      .returning({ id: schema.users.id });
    userId = created.id;
  }

  await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(schema.invitations)
      .set({ acceptedAt: new Date() })
      .where(and(eq(schema.invitations.id, invitation.id), isNull(schema.invitations.acceptedAt)))
      .returning({ id: schema.invitations.id });
    if (!claimed) return;
    await tx
      .insert(schema.memberships)
      .values({ farmId: invitation.farmId, userId, role: invitation.role })
      .onConflictDoNothing();
  });

  if (!current) await startSession(userId);
  redirect(`/c/${invitation.farmSlug}`);
}
