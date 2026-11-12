import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashToken } from "./crypto";

/** Invitación vigente por token, con el nombre del campo. */
export async function findOpenInvitation(token: string) {
  const [row] = await db
    .select({
      id: schema.invitations.id,
      email: schema.invitations.email,
      role: schema.invitations.role,
      farmId: schema.invitations.farmId,
      farmName: schema.farms.name,
      farmSlug: schema.farms.slug,
    })
    .from(schema.invitations)
    .innerJoin(schema.farms, eq(schema.farms.id, schema.invitations.farmId))
    .where(
      and(
        eq(schema.invitations.tokenHash, hashToken(token)),
        isNull(schema.invitations.acceptedAt),
        gt(schema.invitations.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row ?? null;
}
