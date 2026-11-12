"use client";

import { useActionState, useState } from "react";
import { Button, Field, Notice, SelectField } from "@/components/ui";
import { CATALOG, type SpeciesKey } from "@/lib/catalogo";
import { addDays } from "@/lib/dates";
import { startSession, type SessionState } from "../actions";

type Props = { slug: string; options: SpeciesKey[]; species: SpeciesKey; control: string; today: string };

export function NewSessionForm({ slug, options, species: initialSpecies, control: initialControl, today }: Props) {
  const [state, action, pending] = useActionState<SessionState, FormData>(startSession, {});
  const [species, setSpecies] = useState<SpeciesKey>(initialSpecies);
  const controls = CATALOG[species].controls;
  const [control, setControl] = useState(controls.some((c) => c.key === initialControl) ? initialControl : controls[0]?.key ?? "otro");
  const [date, setDate] = useState(today);
  const intervalOf = (s: SpeciesKey, key: string) => CATALOG[s].controls.find((c) => c.key === key)?.intervalDays ?? null;
  const suggest = (s: SpeciesKey, key: string, from: string) => {
    const days = intervalOf(s, key);
    return days ? addDays(from, days) : "";
  };
  const interval = intervalOf(species, control);
  const [next, setNext] = useState(() => suggest(species, control, today));

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      {options.length > 1 ? (
        <SelectField
          id="species"
          name="species"
          label="Especie"
          value={species}
          onChange={(e) => {
            const s = e.target.value as SpeciesKey;
            const first = CATALOG[s].controls[0]?.key ?? "otro";
            setSpecies(s);
            setControl(first);
            setNext(suggest(s, first, date));
          }}
        >
          {options.map((k) => (
            <option key={k} value={k}>
              {CATALOG[k].plural}
            </option>
          ))}
        </SelectField>
      ) : (
        <input type="hidden" name="species" value={species} />
      )}
      <SelectField id="control" name="control" label="Qué se aplica" value={control}
        onChange={(e) => {
          setControl(e.target.value);
          setNext(suggest(species, e.target.value, date));
        }}
      >
        {controls.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
        <option value="otro">Otro…</option>
      </SelectField>
      {control === "otro" ? <Field id="label" name="label" label="Descripción" required /> : null}
      <div className="grid grid-cols-2 gap-3">
        <Field id="product" name="product" label="Producto" />
        <Field id="batch" name="batch" label="Serie" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id="dose" name="dose" label="Dosis" placeholder="5 ml" />
        <Field id="vet" name="vet" label="Veterinario" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id="date" name="date" type="date" label="Fecha" max={today} required value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setNext(suggest(species, control, e.target.value));
          }}
        />
        <Field
          id="nextDueDate"
          name="nextDueDate"
          type="date"
          label="Próxima"
          min={date}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          hint={interval ? `Sugerida: cada ${interval} días.` : "Opcional."}
        />
      </div>
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Abriendo…" : "Empezar jornada"}
      </Button>
    </form>
  );
}
