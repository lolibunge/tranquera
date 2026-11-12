import { formatPhone } from "@/lib/phone";
import type { Metadata } from "next";
import Link from "next/link";
import { getFarmAccess } from "@/lib/farms";
import { can, ROLE_LABEL } from "@/lib/roles";
import { PageTitle } from "@/components/ui";
import { hasDemo } from "@/lib/demo";
import { DemoData } from "./demo-data";
import { pendingSetupSteps } from "../setup-checklist";
import { getActiveSpecies } from "@/lib/farm-species";
import { signOut } from "../../../(acceso)/actions";

export const metadata: Metadata = { title: "Más" };

export default async function MorePage({ params }: PageProps<"/c/[slug]/mas">) {
  const { slug } = await params;
  const { farm, role, user } = await getFarmAccess(slug);
  const base = `/c/${slug}`;
  const pending = can(role, "configurar")
    ? await pendingSetupSteps(slug, farm, (await getActiveSpecies(farm.id)).length > 0, "mas")
    : [];
  const items = [
    can(role, "configurar") && { href: `${base}/configuracion`, label: "Datos del campo", sub: "Nombre, ubicación, hectáreas, DICOSE" },
    can(role, "configurar") && { href: `${base}/especies`, label: "Especies del campo", sub: "Qué animales tenés y para qué" },
    can(role, "configurar") && { href: `${base}/marca`, label: "Marca", sub: "Logo y colores" },
    { href: `${base}/stock`, label: "Stock de insumos", sub: "Vacunas, ración, sales y lo que se use" },
    { href: `${base}/ventas`, label: "Ventas", sub: "Tropas vendidas y resumen del año" },
    { href: `${base}/clima`, label: "Clima y lluvias", sub: "Pronóstico, lluvias y heladas" },
    { href: `${base}/usuarios`, label: "Equipo", sub: can(role, "usuarios") ? "Invitar y manejar roles" : "Quiénes están en el campo" },
    { href: "/cuenta", label: "Mi cuenta", sub: user.email ?? formatPhone(user.phone) },
    { href: "/campos?todos", label: "Cambiar de campo", sub: "Ver todos tus campos" },
  ].filter(Boolean) as { href: string; label: string; sub: string }[];

  return (
    <div className="flex flex-col gap-6">
      <PageTitle sub={`${farm.name} · ${ROLE_LABEL[role]}`}>Más</PageTitle>
      {pending.length ? (
        <section className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold text-muted">Falta configurar</p>
          <ul className="flex flex-col overflow-hidden rounded-2xl border border-warn-dot/30 bg-warn-bg/50">
            {pending.map((step) => (
              <li key={step.href} className="border-b border-warn-dot/20 last:border-b-0">
                <Link href={step.href} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 text-[15px] font-semibold">
                  {step.label}
                  <span aria-hidden="true" className="text-muted">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
        {items.map((item) => (
          <li key={item.href} className="border-b border-chip last:border-b-0">
            <Link href={item.href} className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 hover:bg-ground">
              <span className="flex flex-col">
                <span className="text-base font-semibold">{item.label}</span>
                <span className="text-[13px] text-muted">{item.sub}</span>
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="text-muted">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
      {can(role, "dueños") ? <DemoData slug={slug} hasDemo={await hasDemo(farm.id)} /> : null}
      <form action={signOut}>
        <button type="submit" className="h-13 w-full rounded-xl border border-line-strong bg-surface text-base font-semibold text-ink hover:bg-chip">
          Salir
        </button>
      </form>
    </div>
  );
}
