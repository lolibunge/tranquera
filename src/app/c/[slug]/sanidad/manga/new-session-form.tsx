"use client";

import { useActionState, useState } from "react";
import { Button, Field, Notice, SelectField } from "@/components/ui";
import { CATALOG, isHealthControl, type SpeciesKey } from "@/lib/catalogo";
import { ControlSelect } from "@/components/control-select";
import { addDays } from "@/lib/dates";
import { startSession, type SessionState } from "../actions";

type Supply = { id: string; name: string; unit: string; stock: number };
type Props = { slug: string; options: SpeciesKey[]; species: SpeciesKey; control: string; today: string; supplies?: Supply[] };

export function NewSessionForm({ slug, options, species: initialSpecies, control: initialControl, today, supplies = [] }: Props) {
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
  const info = CATALOG[species].controls.find((c) => c.key === control);
  const isWork = info ? !isHealthControl(info) : false;
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
      <ControlSelect
        species={species}
        value={control}
        onChange={(v) => {
          setControl(v);
          setNext(suggest(species, v, date));
        }}
      />
      {control === "otro" ? <Field id="label" name="label" label="Descripción" required /> : null}
      {info?.perAnimal ? (
        <p className="rounded-xl bg-info-bg px-4 py-3 text-sm text-info-fg">
          Al pasar el bastón te va a pedir {info.perAnimal.type === "choice" ? "el resultado" : `${info.perAnimal.label.toLowerCase()} (${info.perAnimal.unit})`} de cada animal.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Field id="product" name="product" label={info?.productLabel ?? "Producto"} key={`p-${control}`} />
        <Field id="batch" name="batch" label={info?.batchLabel ?? "Serie"} key={`b-${control}`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {isWork ? <span /> : <Field id="dose" name="dose" label="Dosis" placeholder="5 ml" />}
        <Field id="vet" name="vet" label={info?.vetLabel ?? "Veterinario"} key={`v-${control}`} />
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
      {supplies.length ? (
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <SelectField id="supplyId" name="supplyId" label="Descontar del stock" defaultValue="">
            <option value="">No descontar</option>
            {supplies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (hay {s.stock.toLocaleString("es-UY", { maximumFractionDigits: 2 })} {s.unit})
              </option>
            ))}
          </SelectField>
          <Field id="supplyQty" name="supplyQty" label="Cantidad" inputMode="decimal" placeholder="0" />
        </div>
      ) : null}
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Abriendo…" : "Empezar jornada"}
      </Button>
    </form>
  );
}
