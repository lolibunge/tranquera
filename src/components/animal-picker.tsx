"use client";

import { useMemo, useState } from "react";
import { SelectField } from "./ui";
import { tagMatches } from "@/lib/catalogo";

export type PickAnimal = {
  id: string;
  species: string;
  tagVisual: string | null;
  tagRfid: string | null;
  paddockId: string | null;
  heads: number;
  title: string;
  sub: string;
};

/** Elegir varios animales: filtros por especie y potrero, bastón o checkboxes. */
export function AnimalPicker({
  animals,
  species,
  paddocks,
  selected,
  onChange,
}: {
  animals: PickAnimal[];
  species: { key: string; label: string }[];
  paddocks: { id: string; name: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [kind, setKind] = useState(() => animals.find((a) => selected.has(a.id))?.species ?? species[0]?.key ?? "");
  const [from, setFrom] = useState("todos");
  const [read, setRead] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const names = useMemo(() => new Map(paddocks.map((p) => [p.id, p.name])), [paddocks]);
  const visible = animals.filter(
    (a) => (species.length < 2 || a.species === kind) && (from === "todos" || (from === "sin" ? !a.paddockId : a.paddockId === from)),
  );
  const allVisible = visible.length > 0 && visible.every((a) => selected.has(a.id));

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const addByTag = () => {
    const matches = animals.filter((a) => tagMatches(read, a.tagVisual, a.tagRfid));
    if (matches.length === 1) {
      onChange(new Set(selected).add(matches[0].id));
      setMsg(`${matches[0].title} agregado.`);
    } else setMsg(matches.length ? `${matches.length} coinciden: escribí más números.` : `${read} no está en el padrón.`);
    setRead("");
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <p className="text-[15px] font-semibold">Animales</p>
      <div className="grid grid-cols-2 gap-3">
        {species.length > 1 ? (
          <SelectField id="pick-kind" label="Especie" value={kind} onChange={(e) => setKind(e.target.value)}>
            {species.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </SelectField>
        ) : null}
        {paddocks.length ? (
          <SelectField id="pick-from" label="Que están en" value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="todos">Todos los potreros</option>
            <option value="sin">Sin potrero</option>
            {paddocks.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>
        ) : null}
      </div>
      <div className="flex gap-2">
        <label htmlFor="pick-read" className="sr-only">
          Caravana
        </label>
        <input
          id="pick-read"
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
        <button type="button" onClick={() => read.trim() && addByTag()} className="h-12 shrink-0 rounded-xl border border-line-strong bg-surface px-4 font-semibold">
          Sumar
        </button>
      </div>
      {msg ? <p className="text-[13px] text-muted">{msg}</p> : null}
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={allVisible}
          onChange={() => {
            const next = new Set(selected);
            for (const a of visible) {
              if (allVisible) next.delete(a.id);
              else next.add(a.id);
            }
            onChange(next);
          }}
          className="size-5 accent-brand"
        />
        Todos los de la lista ({visible.length})
      </label>
      <ul className="flex max-h-[40vh] flex-col overflow-auto rounded-xl border border-chip">
        {visible.map((a) => (
          <li key={a.id} className="border-b border-chip last:border-b-0">
            <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2">
              <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} className="size-5 shrink-0 accent-brand" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold tabular-nums">{a.title}</span>
                <span className="truncate text-xs text-muted">
                  {a.sub}
                  {paddocks.length ? (a.paddockId ? ` · ${names.get(a.paddockId)}` : " · sin potrero") : ""}
                </span>
              </span>
            </label>
          </li>
        ))}
        {!visible.length ? <li className="px-3 py-4 text-sm text-muted">No hay animales con ese filtro.</li> : null}
      </ul>
    </section>
  );
}
