"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { CATALOG, formatTag, parseTagList, type SpeciesKey } from "@/lib/catalogo";
import { saveMany, type AnimalFormState } from "../actions";

type State = AnimalFormState & { created?: number; skipped?: string[] };

export function ManyForm({ slug, species, today }: { slug: string; species: SpeciesKey; today: string }) {
  const [state, action, pending] = useActionState<State, FormData>(saveMany, {});
  const [tags, setTags] = useState("");
  const [category, setCategory] = useState("");
  const info = CATALOG[species];
  const list = useMemo(() => parseTagList(tags), [tags]);

  if (state.ok && state.created !== undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="ok">{state.ok}</Notice>
        {state.skipped?.length ? (
          <Notice tone="warn">
            Ya estaban en el campo y no se repitieron: {state.skipped.map(formatTag).join(", ")}
          </Notice>
        ) : null}
        <Link href={`/c/${slug}/animales?e=${species}`} className="inline-flex h-13 items-center justify-center rounded-xl bg-brand px-5 text-base font-semibold text-white">
          Ver {info.plural.toLowerCase()}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="species" value={species} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="tags" className="text-sm font-semibold">
          Caravanas
        </label>
        <textarea
          id="tags"
          name="tags"
          rows={7}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder={"UY 0001 0001\nUY 0001 0002\n…"}
          autoComplete="off"
          className="rounded-xl border border-line-strong bg-field px-4 py-3 font-mono text-base"
        />
        <p className="text-[13px] text-muted">
          {list.length ? `${list.length} caravanas distintas.` : "Una por línea, o separadas por coma."} Las lecturas largas del bastón (solo números) se guardan como botón RFID.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Categoría de todos</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Categoría">
          {info.categories.map((c) => (
            <label key={c.value} className={`cursor-pointer rounded-full px-3.5 py-2 text-sm font-semibold has-focus-visible:outline-3 ${category === c.value ? "bg-brand text-white" : "bg-chip"}`}>
              <input type="radio" name="category" value={c.value} required className="sr-only" checked={category === c.value} onChange={() => setCategory(c.value)} />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field id="breed" name="breed" label="Raza (opcional)" list="razas" />
        <Field id="birthDate" name="birthDate" type="date" max={today} label="Nacimiento (opcional)" />
        <datalist id="razas">
          {info.breeds.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      </div>

      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <Button type="submit" disabled={pending || !list.length || !category}>
        {pending ? "Cargando…" : list.length ? `Cargar ${list.length}` : "Cargar"}
      </Button>
    </form>
  );
}
