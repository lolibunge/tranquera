"use client";

import { useActionState, useMemo, useState } from "react";
import { Button, Field, Notice, SelectField } from "@/components/ui";
import { AnimalPicker, type PickAnimal } from "@/components/animal-picker";
import { createExpenseAction, type OwnerState } from "../../propietarios/actions";

type Category = { key: string; short: string; color: string };
type Owner = { id: string; name: string; kind: string };
type Props = {
  slug: string;
  today: string;
  categories: readonly Category[];
  payers: string[];
  askForWhom: boolean;
  owners: Owner[];
  animals: (PickAnimal & { ownerId: string | null })[];
  species: { key: string; label: string }[];
  paddocks: { id: string; name: string }[];
};

const chip = (on: boolean) =>
  `min-h-11 rounded-full px-4 text-[15px] font-semibold ${on ? "bg-brand text-white" : "bg-chip text-ink"}`;

export function NewExpenseForm({ slug, today, categories, payers, askForWhom, owners, animals, species, paddocks }: Props) {
  const [state, action, pending] = useActionState<OwnerState, FormData>(createExpenseAction, {});
  const [currency, setCurrency] = useState<"UYU" | "USD">("UYU");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [forWhom, setForWhom] = useState<"campo" | "dueno" | "reparto">("campo");
  const [ownerId, setOwnerId] = useState(owners.find((o) => o.kind !== "campo")?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const value = Number(amount.replace(/\./g, "").replace(",", ".")) || 0;
  const parts = useMemo(() => {
    const picked = animals.filter((a) => selected.has(a.id));
    const total = picked.reduce((n, a) => n + a.heads, 0);
    const map = new Map<string, { name: string; heads: number }>();
    for (const a of picked) {
      const o = owners.find((x) => x.id === a.ownerId && x.kind !== "campo");
      const key = o?.id ?? "campo";
      const g = map.get(key) ?? { name: o?.name ?? "El campo", heads: 0 };
      g.heads += a.heads;
      map.set(key, g);
    }
    return { total, list: [...map.entries()].map(([id, g]) => ({ id, ...g, share: total ? (value * g.heads) / total : 0 })) };
  }, [animals, owners, selected, value]);
  const money = (n: number) => `${currency === "USD" ? "US$" : "$"} ${Math.round(n).toLocaleString("es-UY")}`;
  const ownerKind = owners.find((o) => o.id === ownerId)?.kind;

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="forWhom" value={askForWhom ? forWhom : "campo"} />
      {forWhom === "reparto" ? [...selected].map((id) => <input key={id} type="hidden" name="animal" value={id} />) : null}

      <div className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-5">
        <label htmlFor="amount" className="text-[13px] text-muted">
          Monto
        </label>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-muted">{currency === "USD" ? "US$" : "$"}</span>
          <input
            id="amount"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-44 bg-transparent font-display text-[40px] font-bold tabular-nums outline-none placeholder:text-line-strong"
          />
        </div>
        <div role="radiogroup" aria-label="Moneda" className="flex gap-1.5">
          {(["UYU", "USD"] as const).map((c) => (
            <button key={c} type="button" role="radio" aria-checked={currency === c} onClick={() => setCurrency(c)} className={`h-9 rounded-full px-4 text-[13px] font-semibold ${currency === c ? "bg-brand text-white" : "bg-chip"}`}>
              {c === "USD" ? "US$" : "$"}
            </button>
          ))}
        </div>
      </div>

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-2 text-[15px] font-semibold">¿En qué?</legend>
        <div className="grid grid-cols-3 gap-2">
          {categories.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={category === c.key}
              onClick={() => setCategory(c.key)}
              className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl px-1.5 py-2.5 text-[13px] font-semibold ${category === c.key ? "border-2 border-brand bg-brand-soft" : "border border-line bg-surface"}`}
            >
              <span className="size-3 rounded-[4px]" style={{ background: c.color }} aria-hidden="true" />
              {c.short}
            </button>
          ))}
        </div>
      </fieldset>

      <Field id="concept" name="concept" label="Concepto" placeholder="Ej.: Herrero, Sueldo de octubre, Gasoil" required />
      <div className="grid grid-cols-2 gap-3">
        <Field id="date" name="date" type="date" label="Fecha" max={today} defaultValue={today} required />
        <Field id="supplier" name="supplier" label="Proveedor" placeholder="Opcional" />
      </div>

      <fieldset className="flex min-w-0 flex-col gap-2.5 rounded-2xl border border-line bg-surface p-4">
        <legend className="sr-only">¿Quién lo pagó?</legend>
        <p className="flex flex-col">
          <span className="text-[15px] font-semibold">¿Quién lo pagó?</span>
          <span className="text-[13px] text-muted">Con qué plata salió</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={paidBy === ""} onClick={() => setPaidBy("")} className={chip(paidBy === "")}>
            Caja del campo
          </button>
          {payers.map((p) => (
            <button key={p} type="button" aria-pressed={paidBy === p} onClick={() => setPaidBy(p)} className={chip(paidBy === p)}>
              {p}
            </button>
          ))}
          <button type="button" aria-pressed={paidBy === "__otra"} onClick={() => setPaidBy("__otra")} className={chip(paidBy === "__otra")}>
            Otra persona…
          </button>
        </div>
        <input type="hidden" name="paidBy" value={paidBy} />
        {paidBy === "__otra" ? <Field id="paidByOther" name="paidByOther" label="Nombre" placeholder="Ej.: Papá" required /> : null}
        {paidBy ? (
          <p className="rounded-lg bg-warn-bg px-3 py-2 text-[13px] font-semibold text-warn-fg">
            Queda como reintegro pendiente{paidBy !== "__otra" ? ` para ${paidBy}` : ""}. Lo marcás como devuelto en Gastos.
          </p>
        ) : null}
      </fieldset>

      {askForWhom ? (
        <fieldset className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
          <legend className="sr-only">¿Para quién es el gasto?</legend>
          <p className="flex flex-col">
            <span className="text-[15px] font-semibold">¿Para quién es el gasto?</span>
            <span className="text-[13px] text-muted">De quién es el costo</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { v: "campo" as const, label: "Del campo" },
              { v: "dueno" as const, label: "Un dueño" },
              { v: "reparto" as const, label: "Repartir entre animales" },
            ].map((o) => (
              <button key={o.v} type="button" aria-pressed={forWhom === o.v} onClick={() => setForWhom(o.v)} className={chip(forWhom === o.v)}>
                {o.label}
              </button>
            ))}
          </div>
          {forWhom === "dueno" ? (
            <>
              <SelectField id="ownerId" name="ownerId" label="Dueño" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </SelectField>
              {ownerKind && ownerKind !== "campo" ? (
                <label className="flex items-center gap-3 text-[15px]">
                  <input type="checkbox" name="bill" defaultChecked={ownerKind === "tercero"} className="size-5 accent-brand" />
                  Cobrárselo (suma a su cuenta)
                </label>
              ) : null}
            </>
          ) : null}
          {forWhom === "reparto" ? (
            <>
              <AnimalPicker animals={animals} species={species} paddocks={paddocks} selected={selected} onChange={setSelected} />
              {parts.list.length ? (
                <div className="flex flex-col gap-1">
                  <p className="text-[13px] text-muted">Se divide por cabeza entre {parts.total} animales</p>
                  {parts.list.map((p) => (
                    <div key={p.id} className="flex justify-between border-t border-chip py-1.5 text-[15px] first:border-t-0">
                      <span>
                        {p.name} <span className="text-muted">· {p.heads}</span>
                      </span>
                      <span className="font-semibold tabular-nums">{value ? money(p.share) : "—"}</span>
                    </div>
                  ))}
                  {parts.list.some((p) => p.id !== "campo") ? (
                    <label className="mt-1 flex items-center gap-3 text-[15px]">
                      <input type="checkbox" name="bill" defaultChecked className="size-5 accent-brand" />
                      Cobrarle su parte a cada dueño
                    </label>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </fieldset>
      ) : null}

      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <Button type="submit" disabled={pending || !category || (forWhom === "reparto" && askForWhom && !selected.size)}>
        {pending ? "Guardando…" : !category ? "Elegí en qué se gastó" : "Guardar gasto"}
      </Button>
    </form>
  );
}
