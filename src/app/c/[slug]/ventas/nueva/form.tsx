"use client";

import { useActionState, useState } from "react";
import { Button, Field, Notice, SelectField } from "@/components/ui";
import { AnimalPicker, type PickAnimal } from "@/components/animal-picker";
import { createSaleAction, type SaleState } from "../actions";
import { parseAmount } from "@/lib/number";

const num = (v: string) => parseAmount(v) ?? 0;
const fmt = (n: number, currency: string) => `${currency === "USD" ? "US$" : "$"} ${n.toLocaleString("es-UY", { maximumFractionDigits: 2 })}`;

type Props = {
  slug: string;
  today: string;
  animals: PickAnimal[];
  species: { key: string; label: string }[];
  paddocks: { id: string; name: string }[];
  preselected: string[];
};

export function SaleForm({ slug, today, animals, species, paddocks, preselected }: Props) {
  const [state, action, pending] = useActionState<SaleState, FormData>(createSaleAction, {});
  const [selected, setSelected] = useState<Set<string>>(() => new Set(preselected));
  const [mode, setMode] = useState<"kilo" | "cabeza">("kilo");
  const [kilos, setKilos] = useState("");
  const [price, setPrice] = useState("");
  const [expenses, setExpenses] = useState("");
  const [currency, setCurrency] = useState("USD");

  const heads = animals.filter((a) => selected.has(a.id)).reduce((n, a) => n + a.heads, 0);
  const gross = mode === "kilo" ? num(kilos) * num(price) : heads * num(price);
  const net = gross - num(expenses);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="priceMode" value={mode} />
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="animal" value={id} />
      ))}

      <AnimalPicker animals={animals} species={species} paddocks={paddocks} selected={selected} onChange={setSelected} />

      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
        <p className="text-[15px] font-semibold">Datos de la venta</p>
        <div className="grid grid-cols-2 gap-3">
          <Field id="date" name="date" type="date" label="Fecha" max={today} defaultValue={today} required />
          <Field id="guide" name="guide" label="N.º de guía" inputMode="numeric" />
        </div>
        <Field id="buyer" name="buyer" label="Comprador" required placeholder="Frigorífico, productor, remate…" />
        <Field id="intermediary" name="intermediary" label="Consignatario o escritorio" placeholder="Opcional" />

        <div role="radiogroup" aria-label="Cómo se vende" className="grid grid-cols-2 rounded-xl bg-chip p-1">
          {[
            { v: "kilo" as const, label: "Por kilo" },
            { v: "cabeza" as const, label: "Por cabeza" },
          ].map((o) => (
            <label key={o.v} className={`flex h-11 cursor-pointer items-center justify-center rounded-lg text-sm font-semibold ${mode === o.v ? "bg-surface shadow-sm" : "text-muted"}`}>
              <input type="radio" name="modePick" className="sr-only" checked={mode === o.v} onChange={() => setMode(o.v)} />
              {o.label}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {mode === "kilo" ? (
            <Field id="kilos" name="kilos" label="Kilos totales" inputMode="decimal" required value={kilos} onChange={(e) => setKilos(e.target.value)} />
          ) : (
            <Field id="kilos" name="kilos" label="Kilos (opcional)" inputMode="decimal" value={kilos} onChange={(e) => setKilos(e.target.value)} />
          )}
          <Field
            id="unitPrice"
            name="unitPrice"
            label={mode === "kilo" ? "Precio por kilo" : "Precio por cabeza"}
            inputMode="decimal"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField id="currency" name="currency" label="Moneda" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="USD">Dólares</option>
            <option value="UYU">Pesos</option>
          </SelectField>
          <Field id="expenses" name="expenses" label="Gastos" inputMode="decimal" placeholder="Flete, comisión…" value={expenses} onChange={(e) => setExpenses(e.target.value)} />
        </div>
        <Field id="notes" name="notes" label="Notas" />

        <dl className="grid grid-cols-3 gap-2 rounded-xl bg-ground p-3 text-center">
          <div>
            <dt className="text-xs text-muted">Cabezas</dt>
            <dd className="text-base font-semibold tabular-nums">{heads}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Bruto</dt>
            <dd className="text-base font-semibold tabular-nums">{fmt(gross, currency)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Neto</dt>
            <dd className="text-base font-semibold tabular-nums">{fmt(net, currency)}</dd>
          </div>
          {mode === "kilo" && heads && num(kilos) ? (
            <p className="col-span-3 text-xs text-muted">Promedio: {Math.round(num(kilos) / heads)} kg por cabeza</p>
          ) : null}
        </dl>
      </section>

      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <div className="sticky bottom-24">
        <Button type="submit" disabled={pending || !selected.size} className="w-full shadow-lg">
          {pending ? "Guardando…" : selected.size ? `Registrar venta de ${heads} ${heads === 1 ? "cabeza" : "cabezas"}` : "Elegí los animales"}
        </Button>
      </div>
    </form>
  );
}
