import type { Metadata } from "next";
import Link from "next/link";
import { getFarmAccess } from "@/lib/farms";
import { formatQty, listSupplies, unitFor, SUPPLY_CATEGORIES, SUPPLY_UNITS } from "@/lib/stock";
import { can } from "@/lib/roles";
import { BackLink, Card, PageTitle, SectionTitle, StatusPill } from "@/components/ui";
import { SupplyForm } from "./forms";

export const metadata: Metadata = { title: "Stock de insumos" };

export default async function StockPage({ params, searchParams }: PageProps<"/c/[slug]/stock">) {
  const { slug } = await params;
  const fromHome = (await searchParams).desde === "inicio";
  const { farm, role } = await getFarmAccess(slug);
  const supplies = await listSupplies(farm.id);
  const low = supplies.filter((s) => s.low).length;
  const groups = SUPPLY_CATEGORIES.map((c) => ({ ...c, items: supplies.filter((s) => s.category === c.key) })).filter((g) => g.items.length);
  const load = can(role, "cargar");

  return (
    <div className="flex flex-col gap-5">
      <BackLink href={fromHome ? `/c/${slug}` : `/c/${slug}/mas`} label="Volver" />
      <PageTitle sub={supplies.length ? `${supplies.length} insumos${low ? ` · ${low} por reponer` : ""}` : "Vacunas, ración, sales, semillas y lo que se use en el campo"}>
        Stock de insumos
      </PageTitle>

      {groups.length ? (
        groups.map((g) => (
          <section key={g.key} className="flex flex-col gap-2">
            <SectionTitle>{g.label}</SectionTitle>
            <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
              {g.items.map((s) => (
                <li key={s.id} className="border-b border-chip last:border-b-0">
                  <Link href={`/c/${slug}/stock/${s.id}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 hover:bg-ground">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[15px] font-semibold">{s.name}</span>
                      <span className="text-[13px] text-muted tabular-nums">
                        {formatQty(s.stock)} {unitFor(s.stock, s.unit)}
                        {s.minimum !== null ? ` · mínimo ${formatQty(s.minimum)}` : ""}
                      </span>
                    </span>
                    {s.empty ? <StatusPill tone="bad">Sin stock</StatusPill> : s.low ? <StatusPill tone="warn">Reponer</StatusPill> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <Card className="flex flex-col gap-2">
          <p className="text-base font-semibold">Todavía no hay insumos</p>
          <p className="text-sm leading-relaxed text-ink-2">
            Cargá lo que tenés guardado y cuánto hay. Cuando algo baje del mínimo, aparece en Inicio para reponerlo.
          </p>
        </Card>
      )}

      {load ? (
        <Card className="flex flex-col gap-4">
          <SectionTitle>Agregar insumo</SectionTitle>
          <SupplyForm slug={slug} categories={SUPPLY_CATEGORIES} units={SUPPLY_UNITS} />
        </Card>
      ) : null}
    </div>
  );
}
