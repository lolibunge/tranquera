"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { and, count, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { normalizeEmail } from "@/lib/auth";
import { newToken, hashToken } from "@/lib/crypto";
import { appUrl, buttonMail, sendMail } from "@/lib/email";
import { getFarmAccess } from "@/lib/farms";
import { can, isRole, ROLE_LABEL, type Permission, type Role } from "@/lib/roles";
import { contrastWithWhite } from "@/lib/color";
import { CATALOG, SPECIES_KEYS } from "@/lib/catalogo";
import { createAccessCode } from "@/lib/access-codes";
import { clearDemo, loadDemo } from "@/lib/demo";
import { isValidPhone, normalizePhone } from "@/lib/phone";

export type ActionState = { error?: string; ok?: string; link?: string; at?: number };

/** Cada acción vuelve a verificar sesión, campo y permiso: nunca confía en lo que manda la pantalla. */
async function guard(formData: FormData, permission: Permission) {
  const slug = String(formData.get("slug") ?? "");
  const access = await getFarmAccess(slug);
  if (!can(access.role, permission)) return { access, denied: "No tenés permiso para hacer esto en este campo." };
  return { access, denied: null };
}

const optionalNumber = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(",", "."))
    .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= min && Number(v) <= max), message)
    .transform((v) => (v === "" ? null : Number(v)));

export async function saveFarmInfo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { access, denied } = await guard(formData, "configurar");
  if (denied) return { error: denied };
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Escribí el nombre del campo.").max(80),
      location: z.string().trim().max(120),
      latitude: optionalNumber(-90, 90, "La latitud tiene que estar entre -90 y 90."),
      longitude: optionalNumber(-180, 180, "La longitud tiene que estar entre -180 y 180."),
      hectares: optionalNumber(0, 1_000_000, "Revisá las hectáreas."),
      dicose: z.string().trim().max(30),
    })
    .safeParse(Object.fromEntries(["name", "location", "latitude", "longitude", "hectares", "dicose"].map((k) => [k, String(formData.get(k) ?? "")])));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if ((d.latitude === null) !== (d.longitude === null)) return { error: "Completá latitud y longitud, o dejá las dos vacías." };

  await db
    .update(schema.farms)
    .set({
      name: d.name,
      locationText: d.location || null,
      latitude: d.latitude,
      longitude: d.longitude,
      hectares: d.hectares,
      dicose: d.dicose || null,
      updatedAt: new Date(),
    })
    .where(eq(schema.farms.id, access.farm.id));
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  return { ok: "Datos guardados.", at: Date.now() };
}

const HEX = /^#[0-9a-f]{6}$/i;
const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const LOGO_MAX_BYTES = 300 * 1024;

export async function saveBrand(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { access, denied } = await guard(formData, "configurar");
  if (denied) return { error: denied };
  const primary = String(formData.get("primary") ?? "").toLowerCase();
  const accent = String(formData.get("accent") ?? "").toLowerCase();
  if (!HEX.test(primary) || !HEX.test(accent)) return { error: "Elegí los dos colores." };
  if (contrastWithWhite(primary) < 4.5) {
    return { error: "El color principal es muy claro: el texto blanco de los botones no se leería al sol. Probá uno más oscuro." };
  }

  const update: Partial<typeof schema.farms.$inferInsert> = { colorPrimary: primary, colorAccent: accent, updatedAt: new Date() };
  const file = formData.get("logo");
  if (formData.get("removeLogo") === "1") {
    update.logo = null;
  } else if (file instanceof File && file.size > 0) {
    if (!LOGO_TYPES.has(file.type)) return { error: "El logo tiene que ser PNG, JPG, WEBP o SVG." };
    if (file.size > LOGO_MAX_BYTES) return { error: "El logo pesa más de 300 KB. Probá con una versión más chica." };
    const bytes = Buffer.from(await file.arrayBuffer());
    update.logo = `data:${file.type};base64,${bytes.toString("base64")}`;
  }

  await db.update(schema.farms).set(update).where(eq(schema.farms.id, access.farm.id));
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  revalidatePath("/campos");
  return { ok: "Marca guardada.", at: Date.now() };
}

const INVITE_DAYS = 7;

export async function inviteMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { access, denied } = await guard(formData, "usuarios");
  if (denied) return { error: denied };
  const emailParsed = z.string().trim().email("Ese mail no parece válido.").safeParse(formData.get("email"));
  if (!emailParsed.success) return { error: emailParsed.error.issues[0].message };
  const role = formData.get("role");
  if (!isRole(role)) return { error: "Elegí un rol." };
  if (role === "dueno" && !can(access.role, "dueños")) return { error: "Solo un dueño puede invitar a otro dueño." };

  const email = normalizeEmail(emailParsed.data);
  const [already] = await db
    .select({ id: schema.users.id })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(and(eq(schema.memberships.farmId, access.farm.id), eq(schema.users.email, email)))
    .limit(1);
  if (already) return { error: "Esa persona ya está en el campo." };

  const token = newToken();
  await db.transaction(async (tx) => {
    // Una invitación pendiente por mail: la nueva reemplaza a la anterior.
    await tx
      .delete(schema.invitations)
      .where(and(eq(schema.invitations.farmId, access.farm.id), eq(schema.invitations.email, email), isNull(schema.invitations.acceptedAt)));
    await tx.insert(schema.invitations).values({
      farmId: access.farm.id,
      email,
      role,
      tokenHash: hashToken(token),
      invitedBy: access.user.id,
      expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
    });
  });

  const link = `${await appUrl()}/invitacion/${token}`;
  const sent = await sendMail({
    to: email,
    subject: `${access.user.name} te invitó a ${access.farm.name} en Tranquera`,
    text: `${access.user.name} te invitó a ${access.farm.name} como ${ROLE_LABEL[role]}.\nPara entrar abrí este enlace (vale por ${INVITE_DAYS} días):\n${link}`,
    html: buttonMail(
      `${access.user.name} te invitó a ${access.farm.name} en Tranquera, como ${ROLE_LABEL[role]}.`,
      "Aceptar invitación",
      link,
      `La invitación vale por ${INVITE_DAYS} días.`,
    ),
  });
  revalidatePath(`/c/${access.farm.slug}/usuarios`);
  return {
    ok: sent
      ? `Invitación enviada a ${email}. También podés mandarle el enlace por WhatsApp.`
      : `Invitación creada. Mandale este enlace a ${email} por WhatsApp o mail.`,
    link,
    at: Date.now(),
  };
}

async function countOwners(farmId: string) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.farmId, farmId), eq(schema.memberships.role, "dueno")));
  return value;
}

async function memberRole(farmId: string, userId: string): Promise<Role | null> {
  const [row] = await db
    .select({ role: schema.memberships.role })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.farmId, farmId), eq(schema.memberships.userId, userId)))
    .limit(1);
  return row?.role ?? null;
}

export async function changeRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { access, denied } = await guard(formData, "usuarios");
  if (denied) return { error: denied };
  const userId = String(formData.get("userId") ?? "");
  const role = formData.get("role");
  if (!isRole(role)) return { error: "Elegí un rol." };
  const current = await memberRole(access.farm.id, userId);
  if (!current) return { error: "Esa persona ya no está en el campo." };
  if ((current === "dueno" || role === "dueno") && !can(access.role, "dueños")) {
    return { error: "Solo un dueño puede dar o quitar el rol de dueño." };
  }
  if (current === "dueno" && role !== "dueno" && (await countOwners(access.farm.id)) <= 1) {
    return { error: "El campo tiene que tener al menos un dueño." };
  }
  await db
    .update(schema.memberships)
    .set({ role, updatedAt: new Date() })
    .where(and(eq(schema.memberships.farmId, access.farm.id), eq(schema.memberships.userId, userId)));
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  return { ok: "Rol actualizado.", at: Date.now() };
}

export async function removeMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { access, denied } = await guard(formData, "usuarios");
  if (denied) return { error: denied };
  const userId = String(formData.get("userId") ?? "");
  const current = await memberRole(access.farm.id, userId);
  if (!current) return { ok: "Esa persona ya no estaba en el campo.", at: Date.now() };
  if (current === "dueno" && !can(access.role, "dueños")) return { error: "Solo un dueño puede sacar a otro dueño." };
  if (current === "dueno" && (await countOwners(access.farm.id)) <= 1) return { error: "El campo tiene que tener al menos un dueño." };
  await db
    .delete(schema.memberships)
    .where(and(eq(schema.memberships.farmId, access.farm.id), eq(schema.memberships.userId, userId)));
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  return { ok: "Listo, ya no está en el campo.", at: Date.now() };
}

export async function revokeInvitation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { access, denied } = await guard(formData, "usuarios");
  if (denied) return { error: denied };
  const id = String(formData.get("invitationId") ?? "");
  await db
    .delete(schema.invitations)
    .where(and(eq(schema.invitations.id, id), eq(schema.invitations.farmId, access.farm.id), isNull(schema.invitations.acceptedAt)));
  revalidatePath(`/c/${access.farm.slug}/usuarios`);
  return { ok: "Invitación cancelada.", at: Date.now() };
}

export async function saveSpecies(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { access, denied } = await guard(formData, "configurar");
  if (denied) return { error: denied };
  const now = new Date();
  await db.transaction(async (tx) => {
    for (const key of SPECIES_KEYS) {
      const active = formData.get(`on_${key}`) === "on";
      const valid = new Set(CATALOG[key].orientations.map((o) => o.key));
      const orientations = formData.getAll(`or_${key}`).map(String).filter((o) => valid.has(o));
      const sells = formData.get(`sells_${key}`) === "0" ? 0 : 1;
      await tx
        .insert(schema.farmSpecies)
        .values({ farmId: access.farm.id, speciesKey: key, active, orientations, sells })
        .onConflictDoUpdate({
          target: [schema.farmSpecies.farmId, schema.farmSpecies.speciesKey],
          set: active ? { active, orientations, sells, updatedAt: now } : { active, updatedAt: now },
        });
    }
  });
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  return { ok: "Especies guardadas.", at: Date.now() };
}

export type CodeState = ActionState & { code?: string; phone?: string; name?: string };

/** Suma al campo a alguien sin mail: nombre y celular. Devuelve el código para activar la cuenta. */
export async function addPhoneMember(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const { access, denied } = await guard(formData, "usuarios");
  if (denied) return { error: denied };
  const name = String(formData.get("name") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const role = formData.get("role");
  if (name.length < 2) return { error: "Escribí el nombre." };
  if (!isValidPhone(phone)) return { error: "Ese celular no parece válido. Ejemplo: 099 123 456." };
  if (!isRole(role)) return { error: "Elegí un rol." };
  if (role === "dueno" && !can(access.role, "dueños")) return { error: "Solo un dueño puede sumar a otro dueño." };

  const [existing] = await db
    .select({ id: schema.users.id, hasPassword: schema.users.passwordHash })
    .from(schema.users)
    .where(eq(schema.users.phone, phone))
    .limit(1);
  if (existing) {
    const already = await memberRole(access.farm.id, existing.id);
    if (already) return { error: "Esa persona ya está en el campo." };
    await db.insert(schema.memberships).values({ farmId: access.farm.id, userId: existing.id, role });
    revalidatePath(`/c/${access.farm.slug}/usuarios`);
    if (existing.hasPassword) {
      return { ok: `${name} ya tenía cuenta: entra con su celular y su contraseña de siempre.`, at: Date.now() };
    }
    const code = await createAccessCode(existing.id, access.user.id);
    return { ok: "Listo. Pasale el código para activar su cuenta.", code, phone, name, link: await activationLink(phone), at: Date.now() };
  }

  const userId = await db.transaction(async (tx) => {
    const [user] = await tx.insert(schema.users).values({ name, phone }).returning({ id: schema.users.id });
    await tx.insert(schema.memberships).values({ farmId: access.farm.id, userId: user.id, role });
    return user.id;
  });
  const code = await createAccessCode(userId, access.user.id);
  revalidatePath(`/c/${access.farm.slug}/usuarios`);
  return { ok: "Listo. Pasale el código para activar su cuenta.", code, phone, name, link: await activationLink(phone), at: Date.now() };
}

/** Código nuevo para alguien del campo con celular (no activó, o se olvidó la contraseña). */
export async function newAccessCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const { access, denied } = await guard(formData, "usuarios");
  if (denied) return { error: denied };
  const userId = String(formData.get("userId") ?? "");
  const current = await memberRole(access.farm.id, userId);
  if (!current) return { error: "Esa persona ya no está en el campo." };
  if (current === "dueno" && !can(access.role, "dueños")) return { error: "Solo un dueño puede hacer esto con otro dueño." };
  const [user] = await db.select({ phone: schema.users.phone, name: schema.users.name }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user?.phone) return { error: "Esa persona entra con mail: que use “Con enlace por mail” en la pantalla de entrar." };
  const code = await createAccessCode(userId, access.user.id);
  return { ok: "Código nuevo. El anterior ya no sirve.", code, phone: user.phone, name: user.name, link: await activationLink(user.phone), at: Date.now() };
}

async function activationLink(phone: string) {
  return `${await appUrl()}/activar?cel=${encodeURIComponent(phone)}`;
}

export async function loadDemoData(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { access, denied } = await guard(formData, "dueños");
  if (denied) return { error: "Solo un dueño puede cargar datos de prueba." };
  const result = await loadDemo(access.farm.id, access.user.id);
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  return result.already
    ? { error: "Los datos de prueba ya están cargados. Borralos primero si querés cargarlos de nuevo." }
    : { ok: `Listo: ${result.created} registros de prueba (vacunos, ovinos, caballos, cabras, chanchos y aves, con lotes), potreros con mapa, sanidad, lluvias y dos jornadas abiertas (aftosa y esquila).`, at: Date.now() };
}

export async function clearDemoData(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { access, denied } = await guard(formData, "dueños");
  if (denied) return { error: "Solo un dueño puede borrar datos de prueba." };
  const removed = await clearDemo(access.farm.id);
  revalidatePath(`/c/${access.farm.slug}`, "layout");
  return { ok: removed ? `Se borraron ${removed} registros de prueba y su sanidad.` : "No había datos de prueba.", at: Date.now() };
}

/** Oculta "Para empezar" en el Inicio de este campo (queda todo en Más). */
export async function hideSetup(formData: FormData) {
  const access = await getFarmAccess(String(formData.get("slug") ?? ""));
  (await cookies()).set(`tq_setup_${access.farm.id}`, "oculto", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 5,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath(`/c/${access.farm.slug}`);
}
