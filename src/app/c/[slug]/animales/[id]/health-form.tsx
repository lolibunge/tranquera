"use client";

import { useActionState, useState } from "react";
import { Button, Field, Notice, SelectField } from "@/components/ui";
import { CATALOG, type SpeciesKey } from "@/lib/catalogo";
import { addDays } from "@/lib/dates";
import { addHealth, type AnimalFormState } from "../actions";

export function HealthForm({ slug, animalId, species, today }: { slug: string; animalId: string; species: SpeciesKey; today: string }) {
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const [state, action, pending] = useActionState<AnimalFormState, FormData>(addHealth, {});
  const controls = CATALOG[species].controls;
  const intervalOf = (key: string) => controls.find((c) => c.key === key)?.intervalDays ?? null;
  const suggest = (key: string, from: string) => {
    const days = intervalOf(key);
    return days ? addDays(from, days) : "";
  };
  const [control, setControl] = useState(controls[0]?.key ?? "otro");
  const [date, setDate] = useState(today);
  const [next, setNext] = useState(() => suggest(controls[0]?.key ?? "otro", today));
  const interval = intervalOf(control);
  // Se cierra solo cuando guarda bien (un guardado posterior a abrirlo).
  const open = openedAt !== null && !(state.ok && (state.at ?? 0) > openedAt);
  const setOpen = (value: boolean) => setOpenedAt(value ? Date.now() : null);

  if (!open) {
    return (
      <>
        {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
        <Button type="button" onClick={() => setOpen(true)}>
          Registrar sanidad
        </Button>
      </>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="animalId" value={animalId} />
      <SelectField
        id="control"
        name="control"
        label="Qué se hizo"
        value={control}
        onChange={(e) => {
          setControl(e.target.value);
          setNext(suggest(e.target.value, date));
        }}
      >
        {controls.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
        <option value="otro">Otro…</option>
      </SelectField>
      {control === "otro" ? <Field id="label" name="label" label="Descripción" required placeholder="Ej.: curación de herida" /> : null}
      <div className="grid grid-cols-2 gap-3">
        <Field id="date" name="date" type="date" label="Fecha" max={today} required value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setNext(suggest(control, e.target.value));
          }}
        />
        <Field
          id="nextDueDate"
          name="nextDueDate"
          type="date"
          label="Próxima"
          value={next}
          min={date}
          onChange={(e) => setNext(e.target.value)}
          hint={interval ? `Sugerida: cada ${interval} días.` : "Opcional."}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id="product" name="product" label="Producto" />
        <Field id="batch" name="batch" label="Serie" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id="dose" name="dose" label="Dosis" placeholder="5 ml" />
        <Field id="vet" name="vet" label="Veterinario" />
      </div>
      <Field id="notes" name="notes" label="Notas" />
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <div className="flex gap-2.5">
        <Button type="button" kind="secondary" onClick={() => setOpen(false)} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
