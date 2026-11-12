import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "@/db";
import { newToken, hashToken } from "./crypto";

const SESSION_COOKIE = "tq_sesion";
const SESSION_DAYS = 30;

export type CurrentUser = { id: string; email: string; name: string; hasPassword: boolean };

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Crea una sesión para el usuario y deja la cookie puesta. */
export async function startSession(userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(schema.sessions).values({ id: hashToken(token), userId, expiresAt });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token)));
  }
  jar.delete(SESSION_COOKIE);
}

/** Usuario de la sesión actual, o null. Se calcula una vez por pedido. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      passwordHash: schema.users.passwordHash,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, hashToken(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, hasPassword: Boolean(row.passwordHash) };
});

/** Para páginas que requieren estar adentro. */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/entrar?volver=${encodeURIComponent(next)}` : "/entrar");
  return user;
}

/** Solo acepta rutas internas para volver después de entrar. */
export function safeNext(value: unknown, fallback = "/campos") {
  const text = typeof value === "string" ? value : "";
  return text.startsWith("/") && !text.startsWith("//") ? text : fallback;
}

/** En las pantallas de entrar: si ya hay sesión, sigue de largo. */
export async function redirectIfSignedIn(next: string) {
  if (await getCurrentUser()) redirect(next);
}
