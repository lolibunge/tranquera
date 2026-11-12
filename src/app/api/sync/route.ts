import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { can, type Role } from "@/lib/roles";
import { recordHealth } from "@/lib/health";
import { getSession } from "@/lib/sessions";

/**
 * Recibe lo que se cargó en el celular (con o sin señal) y lo guarda.
 * Cada operación trae un client_id generado en el celular: si llega dos veces,
 * se guarda una sola. Responde el resultado de cada una para que el celular
 * saque de la cola lo que ya quedó guardado.
 */

const op = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("manga"),
    clientId: z.string().uuid(),
    sessionId: z.string().uuid(),
    animalId: z.string().uuid(),
    result: z.string().max(40).nullable().optional(),
  }),
  z.object({ kind: z.literal("undo"), clientId: z.string().uuid() }),
  z.object({
    kind: z.literal("health"),
    clientId: z.string().uuid(),
    animalId: z.string().uuid(),
    control: z.string(),
    label: z.string().optional(),
    product: z.string().optional(),
    batch: z.string().optional(),
    dose: z.string().optional(),
    date: z.string(),
    nextDueDate: z.string().nullable().optional(),
    vet: z.string().optional(),
    notes: z.string().optional(),
  }),
]);

const body = z.object({ slug: z.string().min(1), ops: z.array(op).max(500) });

type Result = { clientId: string; ok: boolean; error?: string; retry?: boolean };

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Tu sesión venció. Entrá de nuevo para sincronizar." }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Datos inválidos." }, { status: 400 });

  const [access] = await db
    .select({ farmId: schema.farms.id, role: schema.memberships.role })
    .from(schema.farms)
    .innerJoin(schema.memberships, and(eq(schema.memberships.farmId, schema.farms.id), eq(schema.memberships.userId, user.id)))
    .where(eq(schema.farms.slug, parsed.data.slug))
    .limit(1);
  if (!access) return Response.json({ error: "No tenés acceso a ese campo." }, { status: 403 });
  const role = access.role as Role;

  const sessions = new Map<string, Awaited<ReturnType<typeof getSession>>>();
  const results: Result[] = [];

  for (const item of parsed.data.ops) {
    try {
      if (item.kind === "undo") {
        if (!can(role, "sanidad")) {
          results.push({ clientId: item.clientId, ok: false, error: "Sin permiso." });
          continue;
        }
        await db
          .delete(schema.healthEvents)
          .where(and(eq(schema.healthEvents.clientId, item.clientId), eq(schema.healthEvents.farmId, access.farmId)));
        results.push({ clientId: item.clientId, ok: true });
        continue;
      }

      if (!can(role, "sanidad")) {
        results.push({ clientId: item.clientId, ok: false, error: "No tenés permiso para cargar sanidad." });
        continue;
      }

      if (item.kind === "manga") {
        if (!sessions.has(item.sessionId)) sessions.set(item.sessionId, await getSession(access.farmId, item.sessionId));
        const s = sessions.get(item.sessionId);
        if (!s) {
          results.push({ clientId: item.clientId, ok: false, error: "La jornada ya no existe." });
          continue;
        }
        const r = await recordHealth(access.farmId, user.id, {
          animalId: item.animalId,
          control: s.control.startsWith("otro:") ? "otro" : s.control,
          label: s.label,
          product: s.product ?? undefined,
          batch: s.batch ?? undefined,
          dose: s.dose ?? undefined,
          date: s.date,
          nextDueDate: s.nextDueDate,
          vet: s.vet ?? undefined,
          sessionId: s.id,
          clientId: item.clientId,
          result: item.result ?? null,
        });
        results.push(r.ok ? { clientId: item.clientId, ok: true } : { clientId: item.clientId, ok: false, error: r.error });
        continue;
      }

      const r = await recordHealth(access.farmId, user.id, { ...item });
      results.push(r.ok ? { clientId: item.clientId, ok: true } : { clientId: item.clientId, ok: false, error: r.error });
    } catch (error) {
      console.error("[sync]", error);
      results.push({ clientId: item.clientId, ok: false, error: "Error del servidor.", retry: true });
    }
  }

  return Response.json({ results });
}
