"use server";

import { redirect } from "next/navigation";
import { and, eq, gt, count } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { hashPassword, verifyPassword, newToken, hashToken } from "@/lib/crypto";
import { endSession, normalizeEmail, safeNext, startSession } from "@/lib/auth";
import { appUrl, buttonMail, sendMail } from "@/lib/email";
import { consumeLoginToken } from "@/lib/login-links";
import { redeemAccessCode } from "@/lib/access-codes";
import { isValidPhone, looksLikeEmail, normalizePhone } from "@/lib/phone";

export type FormState = { error?: string; ok?: string; devLink?: string; values?: Record<string, string> };

const emailField = z.string().trim().min(3, "Escribí tu mail.").email("Ese mail no parece válido.");
const passwordField = z.string().min(8, "La contraseña tiene que tener al menos 8 caracteres.").max(200);

function signupAllowed() {
  return process.env.ALLOW_SIGNUP !== "false";
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
  if (!signupAllowed()) return { error: "Por ahora las cuentas nuevas se crean por invitación.", values };
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Escribí tu nombre.").max(80),
      email: emailField,
      password: passwordField,
    })
    .safeParse({ ...values, password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  const email = normalizeEmail(parsed.data.email);
  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (existing) return { error: "Ya hay una cuenta con ese mail. Entrá con tu contraseña o pedí un enlace.", values };

  const [user] = await db
    .insert(schema.users)
    .values({ email, name: parsed.data.name, passwordHash: await hashPassword(parsed.data.password) })
    .returning({ id: schema.users.id });
  await startSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const login = String(formData.get("login") ?? "").trim();
  const values = { login };
  const password = String(formData.get("password") ?? "");
  if (!login) return { error: "Escribí tu mail o tu celular.", values };
  if (!password) return { error: "Escribí tu contraseña.", values };

  const byEmail = looksLikeEmail(login);
  const key = byEmail ? normalizeEmail(login) : normalizePhone(login);
  if (!byEmail && !isValidPhone(key)) return { error: "Ese celular no parece válido.", values };
  const [user] = await db
    .select({ id: schema.users.id, passwordHash: schema.users.passwordHash })
    .from(schema.users)
    .where(byEmail ? eq(schema.users.email, key) : eq(schema.users.phone, key))
    .limit(1);
  // Siempre se calcula el hash, exista o no la cuenta, para no dar pistas por el tiempo de respuesta.
  const valid = await verifyPassword(password, user?.passwordHash ?? FAKE_HASH);
  if (user && !user.passwordHash && !byEmail) {
    return { error: "Tu cuenta todavía no está activada. Usá el código que te dieron en “Activar cuenta”.", values };
  }
  if (!user || !valid) return { error: byEmail ? "Mail o contraseña incorrectos." : "Celular o contraseña incorrectos.", values };

  await startSession(user.id);
  redirect(safeNext(formData.get("next")));
}

/** Activa una cuenta sin mail (o pone contraseña nueva) con el código que dio el dueño o encargado. */
export async function activateWithCode(_prev: FormState, formData: FormData): Promise<FormState> {
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const code = String(formData.get("code") ?? "");
  const password = String(formData.get("password") ?? "");
  const values = { phone: String(formData.get("phone") ?? ""), code };
  if (!isValidPhone(phone)) return { error: "Ese celular no parece válido.", values };
  if (code.replace(/[^A-Z0-9]/gi, "").length !== 8) return { error: "El código tiene 8 letras y números.", values };
  if (password.length < 8) return { error: "La contraseña tiene que tener al menos 8 caracteres.", values };
  const [user] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.phone, phone)).limit(1);
  if (!user) return { error: "No hay ninguna cuenta con ese celular. Revisá el número.", values };
  const result = await redeemAccessCode(user.id, code, password);
  if (!result.ok) return { error: result.error, values };
  await startSession(user.id);
  redirect("/campos");
}

const FAKE_HASH =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const LINK_MINUTES = 20;
const MAX_LINKS_PER_WINDOW = 3;

export async function requestLink(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { email: String(formData.get("email") ?? "") };
  const parsed = emailField.safeParse(values.email);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const email = normalizeEmail(parsed.data);
  const generic = { ok: "Si hay una cuenta con ese mail, te llega un enlace para entrar. Vale por 20 minutos.", values };

  const [user] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (!user) return generic;

  const windowStart = new Date(Date.now() - LINK_MINUTES * 60 * 1000);
  const [{ value: recent }] = await db
    .select({ value: count() })
    .from(schema.loginTokens)
    .where(and(eq(schema.loginTokens.email, email), gt(schema.loginTokens.createdAt, windowStart)));
  if (recent >= MAX_LINKS_PER_WINDOW) {
    return { error: "Ya pediste varios enlaces. Revisá tu correo o esperá unos minutos.", values };
  }

  const token = newToken();
  await db.insert(schema.loginTokens).values({
    email,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + LINK_MINUTES * 60 * 1000),
  });
  const next = safeNext(formData.get("next"), "");
  const url = `${await appUrl()}/entrar/enlace?token=${token}${next ? `&volver=${encodeURIComponent(next)}` : ""}`;
  const sent = await sendMail({
    to: email,
    subject: "Tu enlace para entrar a Tranquera",
    text: `Para entrar a Tranquera abrí este enlace (vale por ${LINK_MINUTES} minutos):\n${url}\n\nSi no lo pediste, ignorá este mail.`,
    html: buttonMail("Tocá el botón para entrar a Tranquera.", "Entrar", url, `El enlace vale por ${LINK_MINUTES} minutos. Si no lo pediste, ignorá este mail.`),
  });
  // En desarrollo, sin servicio de mail, se muestra el enlace en pantalla para poder probar.
  if (!sent && process.env.NODE_ENV !== "production") return { ...generic, devLink: url };
  if (!sent) return { error: "No pudimos mandar el mail. Probá con tu contraseña o más tarde.", values };
  return generic;
}

/** Botón "Entrar" de la página del enlace: se usa con un toque y no con solo abrir el mail
 * (algunos correos abren los enlaces solos para revisarlos y gastarían el token). */
export async function enterWithLink(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const user = token ? await consumeLoginToken(token) : null;
  if (!user) redirect("/entrar?enlace=vencido");
  await startSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function signOut() {
  await endSession();
  redirect("/entrar");
}
