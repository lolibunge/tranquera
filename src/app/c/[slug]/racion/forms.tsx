"use client";

import { useActionState, useState } from "react";
import { Button, Field, Notice, SelectField } from "@/components/ui";
import { addPlanAction, giveRoundAction, type FeedState } from "./actions";

type Animal = { id: string; title: string; paddock: string | null; items: { supply: string; unit: string; quantity: number }[] };
const qty = (n: number) => n.toLocaleString("es-UY", { maximumFractionDigits: 2 });

export function RoundForm({ slug, slot, date, animals, slotName }: { slug: string; slot: string; date: string; animals: Animal[]; slotName: string }) {
  const [state, action, pending] = useActionState<FeedState, FormData>(giveRoundAction, {});
  const [skip, setSkip] = useState<Set<string>>(new Set());
  if (state.ok) return <Notice tone="ok">{state.ok}</Notice>;
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="slot" value={slot} />
      <input type="hidden" name="date" value={date} />
      {[...skip].map((id) => (
        <input key={id} type="hidden" name="skip" value={id} />
      ))}
      <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
        {animals.map((a) => {
          const eats = !skip.has(a.id);
          return (
            <li key={a.id} className="border-b border-chip last:border-b-0">
              <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={eats}
                  onChange={() =>
                    setSkip((prev) => {
                      const next = new Set(prev);
                      if (eats) next.add(a.id);
                      else next.delete(a.id);
                      return next;
                    })
                  }
                  className="size-5 shrink-0 accent-brand"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={`text-[15px] font-semibold ${eats ? "" : "text-muted line-through"}`}>{a.title}</span>
                  <span className="text-[13px] text-muted">{a.items.map((i) => `${qty(i.quantity)} ${i.unit} ${i.supply}`).join(" · ")}</span>
                </span>
                {a.paddock ? <span className="shrink-0 text-[12px] text-muted">{a.paddock}</span> : null}
              </label>
            </li>
          );
        })}
      </ul>
      {skip.size ? <p className="text-[13px] text-muted">Destildá los que no comieron: no se descuenta lo de ellos.</p> : null}
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <Button type="submit" disabled={pending || skip.size === animals.length}>
        {pending ? "Guardando…" : `Ración de la ${slotName.toLowerCase()} dada (${animals.length - skip.size})`}
      </Button>
    </form>
  );
}

export function PlanForm({
  slug,
  animalId,
  supplies,
  slots,
}: {
  slug: string;
  animalId: string;
  supplies: { id: string; name: string; unit: string }[];
  slots: readonly { key: string; label: string }[];
}) {
  const [state, action, pending] = useActionState<FeedState, FormData>(addPlanAction, {});
  const [supply, setSupply] = useState(supplies[0]?.id ?? "");
  const unit = supplies.find((s) => s.id === supply)?.unit ?? "";
  return (
    <form action={action} className="flex flex-col gap-4" key={state.at}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="animalId" value={animalId} />
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <SelectField id="supplyId" name="supplyId" label="Qué come" value={supply} onChange={(e) => setSupply(e.target.value)}>
          {supplies.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <Field id="planQty" name="quantity" label={`Cantidad (${unit})`} inputMode="decimal" required />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-semibold">Turnos</legend>
        <div className="flex flex-wrap gap-2">
          {slots.map((s) => (
            <label key={s.key} className="flex cursor-pointer items-center gap-2 rounded-full bg-chip px-3.5 py-2 text-sm font-semibold has-checked:bg-brand has-checked:text-white">
              <input type="checkbox" name="slot" value={s.key} defaultChecked={s.key !== "tarde"} className="sr-only" />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      <Button type="submit" kind="secondary" disabled={pending}>
        {pending ? "Guardando…" : "Agregar a la ración"}
      </Button>
    </form>
  );
}
