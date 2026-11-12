import { cookies } from "next/headers";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Farm } from "@/db/schema";
import { ButtonLink, SectionTitle } from "@/components/ui";
import { hideSetup } from "./actions";

const DEFAULT_PRIMARY = "#7a4a2a";
const DEFAULT_ACCENT = "#c9733d";

/**
 * "Para empezar": solo lo que falta configurar. Cada paso desaparece cuando
 * se hace, y la sección entera se puede ocultar (todo sigue en Más).
 */
export async function pendingSetupSteps(slug: string, farm: Farm, hasSpecies: boolean, from: "inicio" | "mas") {
  const [[{ value: members }], [{ value: invites }]] = await Promise.all([
    db.select({ value: count() }).from(schema.memberships).where(eq(schema.memberships.farmId, farm.id)),
    db
      .select({ value: count() })
      .from(schema.invitations)
      .where(and(eq(schema.invitations.farmId, farm.id), isNull(schema.invitations.acceptedAt), gt(schema.invitations.expiresAt, new Date()))),
  ]);

  const steps = [
    !hasSpecies && { href: `/c/${slug}/especies?desde=inicio`, label: "Elegir las especies del campo", main: true },
    !farm.logo && {
      href: `/c/${slug}/marca?desde=inicio`,
      label: farm.colorPrimary === DEFAULT_PRIMARY && farm.colorAccent === DEFAULT_ACCENT ? "Poner logo y colores" : "Poner el logo",
    },
    members <= 1 && invites === 0 && { href: `/c/${slug}/usuarios?desde=inicio`, label: "Invitar al equipo" },
    farm.latitude === null && !farm.locationText && { href: `/c/${slug}/configuracion?desde=inicio`, label: "Datos del campo" },
  ].filter(Boolean) as { href: string; label: string; main?: boolean }[];
  return from === "mas" ? steps.map((st) => ({ ...st, href: st.href.replace("desde=inicio", "desde=mas"), main: false })) : steps;
}

/** Hay animales cargados: el campo ya arrancó y lo pendiente pasa a Más. */
export async function farmStarted(farmId: string) {
  const [row] = await db.select({ id: schema.animals.id }).from(schema.animals).where(eq(schema.animals.farmId, farmId)).limit(1);
  return Boolean(row);
}

/**
 * En el Inicio solo mientras el campo arranca (sin animales cargados).
 * Después, lo que falte se muestra en Más.
 */
export async function SetupChecklist({ slug, farm, hasSpecies }: { slug: string; farm: Farm; hasSpecies: boolean }) {
  const jar = await cookies();
  if (jar.get(`tq_setup_${farm.id}`)?.value === "oculto") return null;
  if (hasSpecies && (await farmStarted(farm.id))) return null;
  const steps = await pendingSetupSteps(slug, farm, hasSpecies, "inicio");
  if (!steps.length) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle>Para empezar</SectionTitle>
        <form action={hideSetup}>
          <input type="hidden" name="slug" value={slug} />
          <button type="submit" className="h-10 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-chip">
            No mostrar más
          </button>
        </form>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {steps.map((step) => (
          <ButtonLink key={step.href} href={step.href} kind={step.main ? "primary" : "secondary"} className={step.main ? "sm:col-span-2" : ""}>
            {step.label}
          </ButtonLink>
        ))}
      </div>
    </section>
  );
}
