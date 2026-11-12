import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashToken } from "./crypto";

/** Valida un enlace y devuelve el usuario, marcándolo como usado. Lo usa la ruta /entrar/enlace. */
export async function consumeLoginToken(token: string) {
  const now = new Date();
  const [row] = await db
    .update(schema.loginTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(schema.loginTokens.tokenHash, hashToken(token)),
        isNull(schema.loginTokens.usedAt),
        gt(schema.loginTokens.expiresAt, now),
      ),
    )
    .returning({ email: schema.loginTokens.email });
  if (!row) return null;
  const [user] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, row.email)).limit(1);
  return user ?? null;
}

