import { formatPhone } from "@/lib/phone";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getFarmAccess } from "@/lib/farms";
import { can, ROLE_LABEL } from "@/lib/roles";
import { FarmMark, StatusPill } from "@/components/ui";
import { hasDemo } from "@/lib/demo";
import { DemoData } from "./demo-data";
import { pendingSetupSteps } from "../setup-checklist";
import { getActiveSpecies } from "@/lib/farm-species";
import { signOut } from "../../../(acceso)/actions";
import { roundsOn, SLOTS, speciesWithPlans } from "@/lib/feeding";
import { lowSupplies } from "@/lib/stock";
import { upcomingCount, monthRange } from "@/lib/calendar";
import { rainTotals } from "@/lib/weather";
import { expenseTotals, formatMoney, pendingReimbursements, addMoney, type Money } from "@/lib/owners";
import { balances } from "@/lib/ledger";
import { salesSummary } from "@/lib/sales";
import { todayISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Más" };

const ICONS: Record<string, ReactNode> = {
  racion: <path d="M4 10h16l-2 9H6zM8 10V7a4 4 0 0 1 8 0v3" />,
  calendario: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  stock: <path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8" />,
  clima: <path d="M7 18a4 4 0 0 1 0-8 6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 18 18z" />,
  gastos: (
    <>
      <rect x="2" y="6" width="20" height="13" rx="2" />
      <path d="M2 10h20M6 15h4" />
    </>
  ),
  ventas: <path d="M4 17l6-6 4 4 6-7M14 8h6v6" />,
  propietarios: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <circle cx="17.5" cy="9" r="2.5" />
      <path d="M16 14.5a5 5 0 0 1 6 5.5" />
    </>
  ),
  campo: <path d="M3 21h18M5 21V10l7-5 7 5v11M10 21v-6h4v6" />,
  especies: <path d="M7 7c0-2 1.5-3 3-3s3 1 3 3-1.5 3-3 3-3-1-3-3zM4 20c0-3.5 3-6 6-6s6 2.5 6 6" />,
  perfil: <path d="M4 6h16M4 12h10M4 18h7M17 15l2 2 3-4" />,
  equipo: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  marca: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  pasos: <path d="M5 12l4 4L19 6" />,
  migrar: <path d="M4 12h12M12 6l6 6-6 6M20 4v16" />,
  cuenta: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  cambiar: <path d="M7 7h11l-3-3M17 17H6l3 3" />,
};

function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

type Tile = { href: string; icon: string; label: string; sub: string; badge?: { text: string; tone: "warn" | "bad" | "info" } };
type Row = { href: string; icon: string; label: string; sub: string };

function Tiles({ items }: { items: Tile[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {items.map((t) => (
        <Link key={t.href} href={t.href} className="relative flex min-h-28 flex-col gap-2.5 rounded-2xl border border-line bg-surface p-3.5 hover:border-line-strong">
          {t.badge ? (
            <span className="absolute top-3 right-3">
              <StatusPill tone={t.badge.tone}>{t.badge.text}</StatusPill>
            </span>
          ) : null}
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Icon name={t.icon} />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold">{t.label}</span>
            <span className="text-[12px] leading-snug text-muted">{t.sub}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function Rows({ items }: { items: Row[] }) {
  return (
    <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      {items.map((r) => (
        <li key={r.href} className="border-b border-chip last:border-b-0">
          <Link href={r.href} className="flex min-h-14 items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-ground">
            <span className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <Icon name={r.icon} size={20} />
              </span>
              <span className="flex flex-col">
                <span className="text-[15px] font-semibold">{r.label}</span>
                <span className="text-[13px] text-muted">{r.sub}</span>
              </span>
            </span>
            <span aria-hidden="true" className="text-muted">›</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}

export default async function MorePage({ params }: PageProps<"/c/[slug]/mas">) {
  const { slug } = await params;
  const { farm, role, user } = await getFarmAccess(slug);
  const base = `/c/${slug}`;
  const today = todayISO();
  const month = monthRange(undefined, today);
  const money = can(role, "cuentas");
  const species = await getActiveSpecies(farm.id);
  const [pending, feedSpecies, rounds, low, upcoming, rain, spent, reimb, owed, sales] = await Promise.all([
    can(role, "configurar") ? pendingSetupSteps(slug, farm, species.length > 0, "mas") : Promise.resolve([]),
    speciesWithPlans(farm.id),
    roundsOn(farm.id, today),
    lowSupplies(farm.id),
    upcomingCount(farm.id),
    rainTotals(farm.id),
    money ? expenseTotals(farm.id, month.first, month.last) : Promise.resolve({} as Money),
    money ? pendingReimbursements(farm.id) : Promise.resolve([]),
    money && (farm.hasBoarders || farm.hasPartners) ? balances(farm.id) : Promise.resolve(new Map<string, Money>()),
    salesSummary(farm.id, Number(today.slice(0, 4))),
  ]);

  // Ración: turnos de hoy que faltan, sumando todas las especies con ración.
  const missing = feedSpecies.reduce((n, sp) => n + SLOTS.filter((s) => !rounds.some((r) => r.species === sp && r.slot === s.key)).length, 0);
  const owedTotal: Money = {};
  for (const m of owed.values()) for (const [c, v] of Object.entries(m)) if ((v ?? 0) > 0) addMoney(owedTotal, c, v as number);
  const reimbTotal: Money = {};
  for (const r of reimb) for (const [c, v] of Object.entries(r.total)) addMoney(reimbTotal, c, v as number);
  const heads = sales.reduce((n, s) => n + s.heads, 0);

  const daily: Tile[] = [
    {
      href: `${base}/racion`,
      icon: "racion",
      label: "Ración",
      sub: feedSpecies.length ? (missing ? `${missing} turno${missing === 1 ? "" : "s"} sin dar hoy` : "Todo dado hoy") : "Armar la ración diaria",
      badge: feedSpecies.length && missing ? { text: String(missing), tone: "warn" } : undefined,
    },
    { href: `${base}/calendario`, icon: "calendario", label: "Calendario", sub: upcoming ? `${upcoming} esta semana` : "Nada esta semana" },
    {
      href: `${base}/stock`,
      icon: "stock",
      label: "Stock",
      sub: low.length ? `${low.length} por reponer` : "Insumos al día",
      badge: low.length ? { text: String(low.length), tone: low.some((s) => s.empty) ? "bad" : "warn" } : undefined,
    },
    { href: `${base}/clima?desde=mas`, icon: "clima", label: "Clima y lluvias", sub: `${Math.round(rain.month)} mm en el mes` },
  ];
  const plata: Tile[] = [
    ...(money
      ? [
          {
            href: `${base}/gastos`,
            icon: "gastos",
            label: "Gastos",
            sub: Object.keys(spent).length ? `Este mes: ${formatMoney(spent)}` : "Nada este mes",
            badge: reimb.length ? { text: "Reintegro", tone: "warn" as const } : undefined,
          },
        ]
      : []),
    { href: `${base}/ventas`, icon: "ventas", label: "Ventas", sub: heads ? `${heads} cabezas en el año` : "Sin ventas este año" },
    ...(money && (farm.hasBoarders || farm.hasPartners)
      ? [{ href: `${base}/propietarios`, icon: "propietarios", label: "Propietarios", sub: Object.keys(owedTotal).length ? `Por cobrar: ${formatMoney(owedTotal)}` : "Cuentas al día" }]
      : []),
  ];
  const field: Row[] = [
    ...(can(role, "configurar")
      ? [
          { href: `${base}/configuracion`, icon: "campo", label: "Datos del campo", sub: "Nombre, ubicación, hectáreas, DICOSE" },
          { href: `${base}/perfil`, icon: "perfil", label: "Cómo es tu campo", sub: farm.hasBoarders || farm.hasPartners ? [farm.hasBoarders && "Animales de otros dueños", farm.hasPartners && "Socios"].filter(Boolean).join(" · ") : "Familiar: todo del campo" },
          { href: `${base}/especies`, icon: "especies", label: "Especies", sub: species.map((s) => s.key).length ? `${species.length} en el campo` : "Qué animales hay y para qué" },
        ]
      : []),
    { href: `${base}/usuarios`, icon: "equipo", label: "Equipo", sub: can(role, "usuarios") ? "Invitar y manejar roles" : "Quiénes están en el campo" },
    ...(can(role, "configurar") ? [{ href: `${base}/marca`, icon: "marca", label: "Marca", sub: "Logo y colores" }] : []),
  ];
  const account: Row[] = [
    { href: "/cuenta", icon: "cuenta", label: "Mi cuenta", sub: user.email ?? formatPhone(user.phone) },
    ...(can(role, "dueños") ? [{ href: `${base}/migracion`, icon: "migrar", label: "Traer datos de campo-admin", sub: "Migrar del sistema anterior" }] : []),
    { href: "/campos?todos", icon: "cambiar", label: "Cambiar de campo", sub: "Ver todos tus campos" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <FarmMark name={farm.name} logo={farm.logo} size={44} />
        <div className="flex flex-col">
          <h1 className="font-display text-[26px] leading-tight font-bold">Más</h1>
          <p className="text-[14px] text-ink-2">
            {farm.name} · {ROLE_LABEL[role]}
          </p>
        </div>
      </header>

      {pending.length ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold tracking-wide text-muted uppercase">Falta configurar</p>
            <Link href={`${base}/asistente`} className="py-1 text-[14px] font-semibold text-brand">
              Primeros pasos
            </Link>
          </div>
          <ul className="flex flex-col overflow-hidden rounded-2xl border border-warn-dot/30 bg-warn-bg/50">
            {pending.map((step) => (
              <li key={step.href} className="border-b border-warn-dot/20 last:border-b-0">
                <Link href={step.href} className="flex min-h-13 items-center justify-between gap-3 px-4 py-3 text-[15px] font-semibold">
                  {step.label}
                  <span aria-hidden="true" className="text-muted">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Group title="Todos los días">
        <Tiles items={daily} />
      </Group>
      <Group title="Plata">
        <Tiles items={plata} />
      </Group>
      <Group title="El campo">
        <Rows items={field} />
      </Group>
      <Group title="Cuenta">
        <Rows items={account} />
      </Group>

      {can(role, "dueños") ? <DemoData slug={slug} hasDemo={await hasDemo(farm.id)} /> : null}
      <form action={signOut}>
        <button type="submit" className="h-13 w-full rounded-xl border border-line-strong bg-surface text-base font-semibold text-ink hover:bg-chip">
          Salir
        </button>
      </form>
    </div>
  );
}
