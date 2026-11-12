"use client";

import { useActionState, useMemo, useState } from "react";
import { Button, Field, Notice, SelectField } from "@/components/ui";
import { tagMatches } from "@/lib/catalogo";
import { moveAction, type PaddockState } from "../potreros/actions";

type Animal = {
  id: string;
  species: string;
  tagVisual: string | null;
  tagRfid: string | null;
  paddockId: string | null;
  category: string | null;
  heads: number;
  title: string;
  sub: string;
};

type Props = {
  slug: string;
  today: string;
  paddocks: { id: string; name: string }[];
  species: { key: string; label: string }[];
  animals: Animal[];
  initialFrom: string;
  initialTo: string;
  herds?: { id: string; name: string; memberIds: string[] }[];
  initialHerd?: string;
};

export function MoveForm({ slug, today, paddocks, species, animals, initialFrom, initialTo, herds = [], initialHerd }: Props) {
  const [state, action, pending] = useActionState<PaddockState, FormData>(moveAction, {});
  const [from, setFrom] = useState(initialFrom || "todos");
  const [kind, setKind] = useState(species[0]?.key ?? "");
  const [selected, setSelected] = useState<Set<string>>(() =>
    initialHerd
      ? new Set(herds.find((h) => h.id === initialHerd)?.memberIds ?? [])
      : new Set(initialFrom ? animals.filter((a) => a.paddockId === initialFrom).map((a) => a.id) : []),
  );
  const [read, setRead] = useState("");
  const [readMsg, setReadMsg] = useState<string | null>(null);
  const names = useMemo(() => new Map(paddocks.map((p) => [p.id, p.name])), [paddocks]);

  const visible = animals.filter(
    (a) => (species.length < 2 || a.species === kind) && (from === "todos" || (from === "sin" ? !a.paddockId : a.paddockId === from)),
  );
  const heads = animals.filter((a) => selected.has(a.id)).reduce((n, a) => n + a.heads, 0);
  const allVisible = visible.length > 0 && visible.every((a) => selected.has(a.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addByTag() {
    const matches = animals.filter((a) => tagMatches(read, a.tagVisual, a.tagRfid));
    if (matches.length === 1) {
      setSelected((prev) => new Set(prev).add(matches[0].id));
      setReadMsg(`${matches[0].title} agregado.`);
    } else setReadMsg(matches.length ? `${matches.length} coinciden: escribí más números.` : `${read} no está en el padrón.`);
    setRead("");
  }

  if (state.ok) {
    return (
      <div className="flex flex-col gap-3">
        <Notice tone="ok">{state.ok}</Notice>
        <a href={`/c/${slug}/potreros`} className="inline-flex h-13 items-center justify-center rounded-xl bg-brand text-base font-semibold text-white">
          Ver potreros
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="slug" value={slug} />
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="animal" value={id} />
      ))}

      <SelectField id="to" name="to" label="Llevar a" required defaultValue={initialTo}>
        <option value="" disabled>
          Elegí el potrero
        </option>
        {paddocks.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
        <option value="ninguno">Sacar del potrero (sin potrero)</option>
      </SelectField>
      <div className="grid grid-cols-2 gap-3">
        <Field id="date" name="date" type="date" label="Fecha" max={today} defaultValue={today} required />
        <Field id="note" name="note" label="Nota" placeholder="Opcional" />
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <p className="text-[15px] font-semibold">Animales</p>
        {herds.length ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-[13px] font-semibold text-muted">Sumar un grupo entero</p>
            <div className="flex flex-wrap gap-2">
              {herds.map((h) => {
                const all = h.memberIds.every((id) => selected.has(id));
                return (
                  <button
                    key={h.id}
                    type="button"
                    aria-pressed={all}
                    onClick={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        for (const id of h.memberIds) {
                          if (all) next.delete(id);
                          else next.add(id);
                        }
                        return next;
                      })
                    }
                    className={`rounded-full px-3.5 py-2 text-sm font-semibold ${all ? "bg-brand text-white" : "bg-chip"}`}
                  >
                    {h.name} · {h.memberIds.length}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          {species.length > 1 ? (
            <SelectField id="kind" label="Especie" value={kind} onChange={(e) => setKind(e.target.value)}>
              {species.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </SelectField>
          ) : null}
          <SelectField id="from" label="Que están en" value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="todos">Todos los potreros</option>
            <option value="sin">Sin potrero</option>
            {paddocks.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="flex gap-2">
          <label htmlFor="read" className="sr-only">
            Caravana
          </label>
          <input
            id="read"
            value={read}
            onChange={(e) => setRead(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (read.trim()) addByTag();
              }
            }}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Pasá el bastón o escribí la caravana"
            className="h-12 min-w-0 flex-1 rounded-xl border border-line-strong bg-field px-3.5 text-base"
          />
          <Button type="button" kind="secondary" onClick={() => read.trim() && addByTag()} className="h-12! shrink-0">
            Sumar
          </Button>
        </div>
        {readMsg ? <p className="text-[13px] text-muted">{readMsg}</p> : null}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={allVisible}
              onChange={() =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  for (const a of visible) {
                    if (allVisible) next.delete(a.id);
                    else next.add(a.id);
                  }
                  return next;
                })
              }
              className="size-5 accent-brand"
            />
            Todos los de la lista ({visible.length})
          </label>
        </div>
        <ul className="flex max-h-[45vh] flex-col overflow-auto rounded-xl border border-chip">
          {visible.map((a) => (
            <li key={a.id} className="border-b border-chip last:border-b-0">
              <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2">
                <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} className="size-5 shrink-0 accent-brand" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold tabular-nums">{a.title}</span>
                  <span className="truncate text-xs text-muted">
                    {a.sub}
                    {a.paddockId ? ` · ${names.get(a.paddockId)}` : " · sin potrero"}
                  </span>
                </span>
              </label>
            </li>
          ))}
          {!visible.length ? <li className="px-3 py-4 text-sm text-muted">No hay animales con ese filtro.</li> : null}
        </ul>
      </section>

      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <div className="sticky bottom-24">
        <Button type="submit" disabled={pending || !selected.size} className="w-full shadow-lg">
          {pending ? "Moviendo…" : selected.size ? `Mover ${selected.size} (${heads} cabezas)` : "Elegí animales"}
        </Button>
      </div>
    </form>
  );
}
