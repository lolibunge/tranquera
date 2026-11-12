"use client";

import { useActionState, useState } from "react";
import { Button, Field, Notice, SelectField } from "@/components/ui";
import { createSupplyAction, recordMoveAction, updateSupplyAction, type StockState } from "./actions";

type Option = { key: string; label: string };

export function SupplyForm({
  slug,
  categories,
  units,
  supply,
}: {
  slug: string;
  categories: readonly Option[];
  units: readonly string[];
  supply?: { id: string; name: string; category: string; unit: string; minimum: number | null; notes: string | null };
}) {
  const [state, action, pending] = useActionState<StockState, FormData>(supply ? updateSupplyAction : createSupplyAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      {supply ? <input type="hidden" name="id" value={supply.id} /> : null}
      <Field id="name" name="name" label="Nombre" placeholder="Ej.: Vacuna aftosa, Ración 18%, Sal mineral" defaultValue={supply?.name} required />
      <div className="grid grid-cols-2 gap-3">
        <SelectField id="category" name="category" label="Categoría" defaultValue={supply?.category ?? "medicamentos"}>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </SelectField>
        <SelectField id="unit" name="unit" label="Se cuenta en" defaultValue={supply?.unit ?? "dosis"}>
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {supply ? null : <Field id="initial" name="initial" label="Hay ahora" inputMode="decimal" placeholder="0" />}
        <Field id="minimum" name="minimum" label="Avisar debajo de" inputMode="decimal" placeholder="Opcional" defaultValue={supply?.minimum ?? ""} />
      </div>
      <Field id="notes" name="notes" label="Notas" placeholder="Opcional: proveedor, dónde se guarda…" defaultValue={supply?.notes ?? ""} />
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : supply ? "Guardar cambios" : "Agregar insumo"}
      </Button>
    </form>
  );
}

const KINDS = [
  { value: "consumo", label: "Se usó" },
  { value: "entrada", label: "Entró" },
  { value: "ajuste", label: "Conté" },
] as const;

export function MoveForm({ slug, supplyId, unit, today }: { slug: string; supplyId: string; unit: string; today: string }) {
  const [state, action, pending] = useActionState<StockState, FormData>(recordMoveAction, {});
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("consumo");
  return (
    <form action={action} className="flex flex-col gap-4" key={state.at}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="supplyId" value={supplyId} />
      <input type="hidden" name="kind" value={kind} />
      <div role="radiogroup" aria-label="Qué pasó" className="grid grid-cols-3 gap-1 rounded-xl bg-chip p-1">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            role="radio"
            aria-checked={kind === k.value}
            onClick={() => setKind(k.value)}
            className={`h-11 rounded-lg text-[15px] font-semibold ${kind === k.value ? "bg-surface text-ink shadow-sm" : "text-muted"}`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id="quantity" name="quantity" label={kind === "ajuste" ? `Hay (${unit})` : `Cantidad (${unit})`} inputMode="decimal" required />
        <Field id="date" name="date" type="date" label="Fecha" max={today} defaultValue={today} required />
      </div>
      {kind === "entrada" ? (
        <div className="grid grid-cols-[1fr_6.5rem] gap-3">
          <Field id="unitCost" name="unitCost" label={`Costo por ${unit}`} inputMode="decimal" placeholder="Opcional" />
          <SelectField id="currency" name="currency" label="Moneda" defaultValue="USD">
            <option value="USD">US$</option>
            <option value="UYU">$</option>
          </SelectField>
        </div>
      ) : null}
      <Field id="note" name="note" label="Nota" placeholder={kind === "entrada" ? "Opcional: proveedor, factura…" : "Opcional: para qué se usó"} />
      {kind === "ajuste" ? <p className="text-[13px] text-muted">Poné lo que contaste; se guarda la diferencia con lo que figuraba.</p> : null}
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Registrar"}
      </Button>
    </form>
  );
}
