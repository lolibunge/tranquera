import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { getFarmAccess } from "@/lib/farms";
import { getActiveSpecies } from "@/lib/farm-species";
import { CATALOG } from "@/lib/catalogo";
import { can } from "@/lib/roles";
import { Card, PageTitle } from "@/components/ui";
import { finishSetup } from "../actions";

export const metadata: Metadata = { title: "Primeros pasos" };

export default async function SetupWizardPage({ params }: PageProps<"/c/[slug]/asistente">) {
  const { slug } = await params;
  const { farm, role } = await getFarmAccess(slug);
  if (!can(role, "configurar")) notFound();
  const base = `/c/${slug}`;
  const [species, [{ value: paddocks }], [{ value: members }], [{ value: invites }], [map]] = await Promise.all([
    getActiveSpecies(farm.id),
    db.select({ value: count() }).from(schema.paddocks).where(and(eq(schema.paddocks.farmId, farm.id), eq(schema.paddocks.active, true))),
    db.select({ value: count() }).from(schema.memberships).where(eq(schema.memberships.farmId, farm.id)),
    db
      .select({ value: count() })
      .from(schema.invitations)
      .where(and(eq(schema.invitations.farmId, farm.id), isNull(schema.invitations.acceptedAt), gt(schema.invitations.expiresAt, new Date()))),
    db.select({ id: schema.farmMaps.farmId }).from(schema.farmMaps).where(eq(schema.farmMaps.farmId, farm.id)).limit(1),
  ]);

  const steps = [
    {
      title: "Datos del campo",
      text: "Ubicación (para el pronóstico), hectáreas y DICOSE.",
      done: farm.latitude !== null || Boolean(farm.locationText),
      status: [farm.locationText, farm.hectares ? `${farm.hectares} ha` : null, farm.dicose ? `DICOSE ${farm.dicose}` : null].filter(Boolean).join(" · "),
      href: `${base}/configuracion?desde=asistente`,
    },
    {
      title: "Especies",
      text: "Qué animales hay y para qué. Define las vacunas, categorías y campañas que vas a ver.",
      done: species.length > 0,
      status: species.map((s) => CATALOG[s.key].plural).join(", "),
      href: `${base}/especies?desde=asistente`,
    },
    {
      title: "Potreros",
      text: "Subí el mapa del campo en SVG y se crean solos, o cargalos a mano.",
      done: paddocks > 0,
      status: paddocks ? `${paddocks} potreros${map ? " con mapa" : ""}` : "",
      href: `${base}/potreros/mapa?desde=asistente`,
      alt: { href: `${base}/potreros/nuevo`, label: "Cargar uno a mano" },
    },
    {
      title: "Equipo",
      text: "Invitá al encargado, peones o veterinario. Los que no tienen mail entran con celular y código.",
      done: members > 1 || invites > 0,
      status: members > 1 || invites > 0 ? `${members} en el campo${invites ? ` · ${invites} invitación${invites > 1 ? "es" : ""} pendiente${invites > 1 ? "s" : ""}` : ""}` : "",
      href: `${base}/usuarios?desde=asistente`,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="flex flex-col gap-5">
      <PageTitle sub={`Cuatro pasos para dejar ${farm.name} listo. Podés saltear cualquiera y hacerlo después desde Más.`}>Primeros pasos</PageTitle>
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-chip">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
        <span className="text-[13px] font-semibold text-muted tabular-nums">
          {doneCount} de {steps.length}
        </span>
      </div>

      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <li key={s.title}>
            <Card className={`flex flex-col gap-3 ${s.done ? "" : "border-line-strong"}`}>
              <div className="flex items-start gap-3">
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${s.done ? "bg-ok-bg text-ok-fg" : "bg-chip text-ink"}`}
                  aria-hidden="true"
                >
                  {s.done ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 12l5 5L19 7" /></svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-base font-semibold">
                    {s.title}
                    <span className="sr-only">{s.done ? " (hecho)" : " (pendiente)"}</span>
                  </span>
                  <span className="text-sm leading-snug text-ink-2">{s.done && s.status ? s.status : s.text}</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-11">
                <Link href={s.href} className={`inline-flex h-11 items-center rounded-xl px-4 text-[15px] font-semibold ${s.done ? "border border-line-strong" : "bg-brand text-white"}`}>
                  {s.done ? "Revisar" : "Hacerlo ahora"}
                </Link>
                {!s.done && s.alt ? (
                  <Link href={s.alt.href} className="py-2 text-[15px] font-semibold text-brand">
                    {s.alt.label}
                  </Link>
                ) : null}
              </div>
            </Card>
          </li>
        ))}
      </ol>

      <form action={finishSetup} className="flex flex-col gap-2">
        <input type="hidden" name="slug" value={slug} />
        <button type="submit" className="h-13 w-full rounded-xl bg-brand text-base font-semibold text-white">
          {doneCount === steps.length ? "Listo, ir al inicio" : "Seguir después"}
        </button>
        {doneCount < steps.length ? <p className="text-center text-[13px] text-muted">Lo que falte va a quedar en Más → Falta configurar.</p> : null}
      </form>
    </div>
  );
}
