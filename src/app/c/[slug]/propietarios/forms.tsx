"use client";

import { useActionState, useState } from "react";
import { Button, Field, Notice, SelectField } from "@/components/ui";
import { AnimalPicker, type PickAnimal } from "@/components/animal-picker";
import { assignAnimalsAction, createExpenseAction, saveOwnerAction, saveSharesAction, type OwnerState } from "./actions";

type Kind = { value: string; label: string; help: string };
type Owner = { id: string; name: string; kind: string; phone: string | null; monthlyFee: string | null; currency: string; notes: string | null };

export function OwnerForm({ slug, kinds, owner, hasFarmOwner }: { slug: string; kinds: readonly Kind[]; owner?: Owner; hasFarmOwner: boolean }) {
  const [state, action, pending] = useActionState<OwnerState, FormData>(saveOwnerAction, {});
  const options = kinds.filter((k) => k.value !== "campo" || !hasFarmOwner || owner?.kind === "campo");
  const [kind, setKind] = useState(owner?.kind ?? options[0]?.value ?? "socio");
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      {owner ? <input type="hidden" name="id" value={owner.id} /> : null}
      <Field id="name" name="name" label="Nombre" defaultValue={owner?.name} placeholder="Ej.: Juan Pérez, Pozo 2026" required />
      <SelectField id="kind" name="kind" label="Tipo" value={kind} onChange={(e) => setKind(e.target.value)}>
        {options.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </SelectField>
      <p className="-mt-2 text-[13px] text-muted">{kinds.find((k) => k.value === kind)?.help}</p>
      {kind === "pozo" || kind === "campo" ? null : <Field id="phone" name="phone" label="Celular" inputMode="tel" defaultValue={owner?.phone ?? ""} placeholder="Opcional" />}
      {kind === "tercero" ? (
        <div className="grid grid-cols-[1fr_6.5rem] gap-3">
          <Field id="monthlyFee" name="monthlyFee" label="Pensión por mes (total)" inputMode="decimal" defaultValue={owner?.monthlyFee ?? ""} placeholder="Opcional" />
          <SelectField id="currency" name="currency" label="Moneda" defaultValue={owner?.currency ?? "USD"}>
            <option value="USD">US$</option>
            <option value="UYU">$</option>
          </SelectField>
        </div>
      ) : (
        <input type="hidden" name="currency" value={owner?.currency ?? "USD"} />
      )}
      <Field id="notes" name="notes" label="Notas" defaultValue={owner?.notes ?? ""} placeholder="Opcional" />
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : owner ? "Guardar cambios" : "Agregar propietario"}
      </Button>
    </form>
  );
}

export function SharesForm({ slug, poolId, partners, shares }: { slug: string; poolId: string; partners: { id: string; name: string }[]; shares: Record<string, number> }) {
  const [state, action, pending] = useActionState<OwnerState, FormData>(saveSharesAction, {});
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(partners.map((p) => [p.id, shares[p.id] ? String(shares[p.id]).replace(".", ",") : ""])));
  const total = Object.values(values).reduce((n, v) => n + (Number(v.replace(",", ".")) || 0), 0);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={poolId} />
      {partners.map((p) => (
        <div key={p.id} className="flex items-center justify-between gap-3">
          <input type="hidden" name="partner" value={p.id} />
          <label htmlFor={`pct-${p.id}`} className="text-[15px] font-semibold">
            {p.name}
          </label>
          <span className="flex items-center gap-2">
            <input
              id={`pct-${p.id}`}
              name={`pct-${p.id}`}
              inputMode="decimal"
              value={values[p.id]}
              onChange={(e) => setValues({ ...values, [p.id]: e.target.value })}
              placeholder="0"
              className="h-11 w-20 rounded-xl border border-line-strong bg-field px-3 text-right text-base tabular-nums"
            />
            <span className="text-muted">%</span>
          </span>
        </div>
      ))}
      <p className={`text-right text-sm font-semibold tabular-nums ${Math.abs(total - 100) < 0.01 ? "text-ok-fg" : "text-warn-fg"}`}>Total: {total.toLocaleString("es-UY")}%</p>
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      <Button type="submit" kind="secondary" disabled={pending}>
        {pending ? "Guardando…" : "Guardar porcentajes"}
      </Button>
    </form>
  );
}

export function AssignForm({
  slug,
  ownerId,
  animals,
  species,
  paddocks,
  preselected,
  others,
}: {
  slug: string;
  ownerId: string;
  animals: PickAnimal[];
  species: { key: string; label: string }[];
  paddocks: { id: string; name: string }[];
  preselected: string[];
  others: number;
}) {
  const [state, action, pending] = useActionState<OwnerState, FormData>(assignAnimalsAction, {});
  const [selected, setSelected] = useState(() => new Set(preselected));
  const heads = animals.filter((a) => selected.has(a.id)).reduce((n, a) => n + a.heads, 0);
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={ownerId} />
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="animal" value={id} />
      ))}
      <AnimalPicker animals={animals} species={species} paddocks={paddocks} selected={selected} onChange={setSelected} />
      {others ? <p className="text-[13px] text-muted">Si elegís animales que hoy son de otro propietario, pasan a este.</p> : null}
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : `Guardar (${heads} cab.)`}
      </Button>
    </form>
  );
}

export function ExpenseForm({
  slug,
  today,
  categories,
  owners,
}: {
  slug: string;
  today: string;
  categories: readonly { key: string; label: string }[];
  owners: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<OwnerState, FormData>(createExpenseAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" key={state.at}>
      <input type="hidden" name="slug" value={slug} />
      <Field id="concept" name="concept" label="Concepto" placeholder="Ej.: Sueldo octubre, Flete a remate" required />
      <div className="grid grid-cols-2 gap-3">
        <Field id="date" name="date" type="date" label="Fecha" max={today} defaultValue={today} required />
        <SelectField id="category" name="category" label="Categoría" defaultValue="otros">
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="grid grid-cols-[1fr_6.5rem] gap-3">
        <Field id="amount" name="amount" label="Monto" inputMode="decimal" required />
        <SelectField id="currency" name="currency" label="Moneda" defaultValue="USD">
          <option value="USD">US$</option>
          <option value="UYU">$</option>
        </SelectField>
      </div>
      {owners.length ? (
        <SelectField id="ownerId" name="ownerId" label="Se imputa a" defaultValue="">
          <option value="">Gasto general del campo</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </SelectField>
      ) : null}
      <Field id="supplier" name="supplier" label="Proveedor" placeholder="Opcional" />
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Registrar gasto"}
      </Button>
    </form>
  );
}
