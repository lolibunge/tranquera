"use client";

import { useActionState } from "react";
import { Button, Field, Notice, SelectField } from "@/components/ui";
import { savePaddockAction, type PaddockState } from "./actions";

const KINDS = [
  { value: "", label: "Sin especificar" },
  { value: "natural", label: "Campo natural" },
  { value: "pradera", label: "Pradera" },
  { value: "verdeo", label: "Verdeo" },
  { value: "rastrojo", label: "Rastrojo" },
  { value: "monte", label: "Monte" },
  { value: "otro", label: "Otro" },
];

type Initial = { id: string; name: string; hectares: string; kind: string; notes: string; parentId?: string; zone?: string; restSince?: string };

export function PaddockForm({ slug, initial, parents = [], today }: { slug: string; initial?: Initial; parents?: { id: string; name: string }[]; today?: string }) {
  const [state, action, pending] = useActionState<PaddockState, FormData>(savePaddockAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <Field id="name" name="name" label="Nombre" required defaultValue={initial?.name} placeholder="Potrero 3" />
      <div className="grid grid-cols-2 gap-3">
        <Field id="hectares" name="hectares" label="Hectáreas" inputMode="decimal" defaultValue={initial?.hectares} />
        <SelectField id="kind" name="kind" label="Tipo" defaultValue={initial?.kind ?? ""}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </SelectField>
      </div>
      {parents.length ? (
        <div className="grid grid-cols-2 gap-3">
          <SelectField id="parentId" name="parentId" label="Está dentro de" defaultValue={initial?.parentId ?? ""}>
            <option value="">Ninguno</option>
            {parents
              .filter((p) => p.id !== initial?.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </SelectField>
          <Field id="zone" name="zone" label="Zona" defaultValue={initial?.zone} placeholder="Opcional" />
        </div>
      ) : null}
      {initial ? (
        <Field
          id="restSince"
          name="restSince"
          type="date"
          label="En descanso desde"
          max={today}
          defaultValue={initial.restSince}
          hint="Opcional. Si no hay movimientos cargados, marcá desde cuándo está sin animales."
        />
      ) : null}
      <Field id="notes" name="notes" label="Notas" defaultValue={initial?.notes} placeholder="Aguada, sombra, estado de alambrados…" />
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
