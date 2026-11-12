"use client";

import { useActionState, useState } from "react";
import { Button, Notice } from "@/components/ui";
import { CATALOG, type SpeciesKey } from "@/lib/catalogo";
import { saveSpecies, type ActionState } from "../actions";

type Item = { key: SpeciesKey; active: boolean; orientations: string[]; sells: boolean; count: number };

export function SpeciesForm({ slug, species }: { slug: string; species: Item[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSpecies, {});
  const [items, setItems] = useState(species);

  function update(key: SpeciesKey, change: Partial<Item>) {
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...change } : it)));
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      {items.map((item) => {
        const info = CATALOG[item.key];
        return (
          <fieldset
            key={item.key}
            className={`flex flex-col gap-3 rounded-2xl bg-surface p-4 ${item.active ? "border-2 border-brand" : "border border-line"}`}
          >
            <legend className="sr-only">{info.plural}</legend>
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span className="flex flex-col">
                <span className="text-[17px] font-semibold">{info.plural}</span>
                {item.count ? <span className="text-[13px] text-muted">{item.count} cargados</span> : null}
              </span>
              <input
                type="checkbox"
                role="switch"
                name={`on_${item.key}`}
                checked={item.active}
                onChange={(e) => update(item.key, { active: e.target.checked })}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={`flex h-8 w-13 shrink-0 rounded-full p-[3px] transition-colors peer-focus-visible:outline-3 peer-focus-visible:outline-brand/50 ${item.active ? "justify-end bg-brand" : "bg-line-strong"}`}
              >
                <span className="size-[26px] rounded-full bg-white shadow-sm" />
              </span>
            </label>

            {item.active ? (
              <>
                <div className="flex flex-col gap-2">
                  <p className="text-[13px] font-semibold text-ink-2">Para qué</p>
                  <div className="flex flex-wrap gap-2">
                    {info.orientations.map((o) => {
                      const on = item.orientations.includes(o.key);
                      return (
                        <label key={o.key} className={`cursor-pointer rounded-full px-3.5 py-2 text-sm font-semibold has-focus-visible:outline-3 has-focus-visible:outline-brand/50 ${on ? "bg-brand text-white" : "bg-chip"}`}>
                          <input
                            type="checkbox"
                            name={`or_${item.key}`}
                            value={o.key}
                            checked={on}
                            onChange={(e) =>
                              update(item.key, {
                                orientations: e.target.checked ? [...item.orientations, o.key] : item.orientations.filter((k) => k !== o.key),
                              })
                            }
                            className="sr-only"
                          />
                          {o.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div role="radiogroup" aria-label="¿Vende?" className="grid grid-cols-2 rounded-xl bg-chip p-1">
                  {[
                    { v: "1", label: "Vendo" },
                    { v: "0", label: "Solo consumo" },
                  ].map((opt) => {
                    const on = (opt.v === "1") === item.sells;
                    return (
                      <label key={opt.v} className={`flex h-10 cursor-pointer items-center justify-center rounded-lg text-sm font-semibold has-focus-visible:outline-3 has-focus-visible:outline-brand/50 ${on ? "bg-surface shadow-sm" : "text-muted"}`}>
                        <input type="radio" name={`sells_${item.key}`} value={opt.v} checked={on} onChange={() => update(item.key, { sells: opt.v === "1" })} className="sr-only" />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
                <p className="text-[13px] leading-snug text-muted">Suma: {info.adds}</p>
              </>
            ) : item.count ? (
              <p className="text-[13px] text-muted">Apagada: sus {item.count} animales quedan guardados y vuelven al prenderla.</p>
            ) : null}
          </fieldset>
        );
      })}
      <p className="text-[13px] leading-snug text-muted">Si apagás una especie que ya tiene animales, no se borra nada: se esconde y vuelve igual cuando la prendés.</p>
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      <div className="sticky bottom-24 pt-2">
        <Button type="submit" disabled={pending} className="w-full shadow-lg">
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
