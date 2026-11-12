import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashPassword } from "./crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I para no confundir
const CODE_DAYS = 7;
const MAX_FAILS = 5;

function hashCode(code: string) {
  return createHash("sha256").update(code.replace(/[^A-Z0-9]/gi, "").toUpperCase()).digest("hex");
}

/** Crea un código nuevo (anula los anteriores sin usar) y lo devuelve para mostrarlo una sola vez. */
export async function createAccessCode(userId: string, createdBy: string) {
  const raw = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(schema.accessCodes)
      .set({ usedAt: now })
      .where(and(eq(schema.accessCodes.userId, userId), isNull(schema.accessCodes.usedAt)));
    await tx.insert(schema.accessCodes).values({
      userId,
      codeHash: hashCode(raw),
      expiresAt: new Date(now.getTime() + CODE_DAYS * 24 * 60 * 60 * 1000),
      createdBy,
    });
  });
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/**
 * Usa el código: si es correcto pone la contraseña nueva y devuelve el usuario.
 * Después de 5 intentos fallidos el código deja de servir.
 */
export async function redeemAccessCode(userId: string, code: string, newPassword: string) {
  const [row] = await db
    .select()
    .from(schema.accessCodes)
    .where(and(eq(schema.accessCodes.userId, userId), isNull(schema.accessCodes.usedAt), gt(schema.accessCodes.expiresAt, new Date())))
    .orderBy(desc(schema.accessCodes.createdAt))
    .limit(1);
  if (!row) return { ok: false as const, error: "No hay un código vigente para ese celular. Pedile uno nuevo a quien te sumó al campo." };
  if (row.failedAttempts >= MAX_FAILS) return { ok: false as const, error: "Ese código se bloqueó por muchos intentos. Pedí uno nuevo." };
  const expected = Buffer.from(row.codeHash, "hex");
  const actual = Buffer.from(hashCode(code), "hex");
  if (!timingSafeEqual(expected, actual)) {
    await db.update(schema.accessCodes).set({ failedAttempts: row.failedAttempts + 1 }).where(eq(schema.accessCodes.id, row.id));
    return { ok: false as const, error: "El código no es correcto." };
  }
  const passwordHash = await hashPassword(newPassword);
  await db.transaction(async (tx) => {
    await tx.update(schema.accessCodes).set({ usedAt: new Date() }).where(eq(schema.accessCodes.id, row.id));
    await tx.update(schema.users).set({ passwordHash, updatedAt: new Date() }).where(eq(schema.users.id, userId));
    // Si cambió la contraseña con un código, se cierran las sesiones viejas.
    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
  });
  return { ok: true as const };
}
