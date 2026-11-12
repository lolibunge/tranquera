import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser, type CurrentUser } from "./auth";
import { can, type Permission, type Role } from "./roles";

export type FarmAccess = {
  user: CurrentUser;
  farm: typeof schema.farms.$inferSelect;
  role: Role;
};

/** Campos a los que entra el usuario, con su rol en cada uno. */
export async function listMyFarms(userId: string) {
  return db
    .select({
      id: schema.farms.id,
      slug: schema.farms.slug,
      name: schema.farms.name,
      logo: schema.farms.logo,
      colorPrimary: schema.farms.colorPrimary,
      role: schema.memberships.role,
    })
    .from(schema.memberships)
    .innerJoin(schema.farms, eq(schema.farms.id, schema.memberships.farmId))
    .where(eq(schema.memberships.userId, userId))
    .orderBy(asc(schema.farms.name));
}

/**
 * Carga el campo por slug y verifica que el usuario sea miembro.
 * Si no lo es, responde 404 (no revela que el campo existe).
 */
export const getFarmAccess = cache(async (slug: string): Promise<FarmAccess> => {
  const user = await requireUser(`/c/${slug}`);
  const [row] = await db
    .select({ farm: schema.farms, role: schema.memberships.role })
    .from(schema.farms)
    .innerJoin(
      schema.memberships,
      and(eq(schema.memberships.farmId, schema.farms.id), eq(schema.memberships.userId, user.id)),
    )
    .where(eq(schema.farms.slug, slug))
    .limit(1);
  if (!row) notFound();
  return { user, farm: row.farm, role: row.role };
});

/** Igual que getFarmAccess pero exige un permiso; para acciones que cambian datos. */
export async function requirePermission(slug: string, permission: Permission) {
  const access = await getFarmAccess(slug);
  if (!can(access.role, permission)) {
    throw new Error("No tenés permiso para hacer esto en este campo.");
  }
  return access;
}

/** "La Hidalguía" → "la-hidalguia", con sufijo si ya existe. */
export async function uniqueFarmSlug(name: string) {
  const base =
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "campo";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const [taken] = await db
      .select({ id: schema.farms.id })
      .from(schema.farms)
      .where(eq(schema.farms.slug, candidate))
      .limit(1);
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** A dónde vuelve la flecha según de dónde se vino (?desde=inicio|asistente). */
export function backHref(slug: string, desde: unknown, fallback = `/c/${slug}/mas`) {
  if (desde === "inicio") return `/c/${slug}`;
  if (desde === "asistente") return `/c/${slug}/asistente`;
  return fallback;
}
