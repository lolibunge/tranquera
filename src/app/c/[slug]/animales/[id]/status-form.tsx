"use client";

import { useActionState, useState } from "react";
import { Button, Field, Notice, SelectField } from "@/components/ui";
import { changeStatus, type AnimalFormState } from "../actions";

export function StatusForm({ slug, animalId, status, today }: { slug: string; animalId: string; status: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<AnimalFormState, FormData>(changeStatus, {});

  if (status !== "activo") {
    return (
      <form action={action} className="flex flex-col gap-2 border-t border-line pt-5">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="id" value={animalId} />
        <input type="hidden" name="status" value="activo" />
        {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
        <Button type="submit" kind="secondary" disabled={pending}>
          Volver a ponerlo en el padrón
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-5">
      {!open ? (
        <Button type="button" kind="danger" onClick={() => setOpen(true)}>
          Dar de baja (vendido, muerto…)
        </Button>
      ) : (
        <form action={action} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="id" value={animalId} />
          <SelectField id="status" name="status" label="Motivo" defaultValue="vendido">
            <option value="vendido">Vendido</option>
            <option value="muerto">Muerto</option>
            <option value="baja">Otra baja</option>
          </SelectField>
          <Field id="statusDate" name="date" type="date" label="Fecha" max={today} defaultValue={today} required />
          <Field id="note" name="note" label="Nota" placeholder="Opcional: a quién, causa…" />
          <p className="text-[13px] text-muted">No se borra: queda en &ldquo;Ver vendidos y bajas&rdquo; con todo su historial.</p>
          {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
          <div className="flex gap-2.5">
            <Button type="button" kind="secondary" onClick={() => setOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" kind="danger" disabled={pending} className="flex-1">
              Confirmar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
