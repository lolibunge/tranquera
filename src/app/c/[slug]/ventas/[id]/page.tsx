import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFarmAccess } from "@/lib/farms";
import { getSale } from "@/lib/sales";
import { categoryOf, formatTag, isSpeciesKey } from "@/lib/catalogo";
import { formatDate } from "@/lib/dates";
import { BackLink, Card, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Venta" };

const money = (n: number, currency: string) => `${currency === "USD" ? "US$" : "$"} ${n.toLocaleString("es-UY", { maximumFractionDigits: 2 })}`;

export default async function SalePage({ params }: PageProps<"/c/[slug]/ventas/[id]">) {
  const { slug, id } = await params;
  const { farm } = await getFarmAccess(slug);
  const data = await getSale(farm.id, id);
  if (!data) notFound();
  const { sale, animals } = data;
  const gross = Number(sale.gross);
  const expenses = Number(sale.expenses);
  const kilos = sale.kilos ? Number(sale.kilos) : null;
  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/c/${slug}/ventas`} label="Volver" />
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] font-bold leading-tight">{sale.buyer}</h1>
        <p className="text-[15px] text-ink-2">
          {formatDate(sale.date)}
          {sale.intermediary ? ` · ${sale.intermediary}` : ""}
          {sale.guide ? ` · guía ${sale.guide}` : ""}
        </p>
      </div>
      <Card className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Item label="Cabezas" value={String(sale.heads)} />
        <Item label="Kilos" value={kilos ? `${kilos.toLocaleString("es-UY")} kg` : "—"} />
        <Item label={sale.priceMode === "kilo" ? "Precio por kilo" : "Precio por cabeza"} value={money(Number(sale.unitPrice), sale.currency)} />
        <Item label="Promedio" value={kilos ? `${Math.round(kilos / sale.heads)} kg/cab.` : "—"} />
        <Item label="Bruto" value={money(gross, sale.currency)} />
        <Item label="Gastos" value={money(expenses, sale.currency)} />
        <div className="col-span-2 border-t border-chip pt-3">
          <Item label="Neto" value={money(gross - expenses, sale.currency)} />
        </div>
      </Card>
      {sale.notes ? <p className="text-[15px] whitespace-pre-line text-ink-2">{sale.notes}</p> : null}
      <section className="flex flex-col gap-3">
        <SectionTitle>Animales</SectionTitle>
        <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
          {animals.map((a) => (
            <li key={a.id} className="border-b border-chip last:border-b-0">
              <Link href={`/c/${slug}/animales/${a.id}`} className="flex justify-between gap-3 px-4 py-2.5 hover:bg-ground">
                <span className="text-[15px] font-semibold tabular-nums">{a.isLot ? a.name : a.tagVisual ? formatTag(a.tagVisual) : a.name ?? formatTag(a.tagRfid)}</span>
                <span className="text-[13px] text-muted">{isSpeciesKey(a.species) ? (a.isLot ? `Lote · ${a.headCount}` : categoryOf(a.species, a.category)?.label) : ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-[15px] font-semibold tabular-nums">{value}</span>
    </div>
  );
}
