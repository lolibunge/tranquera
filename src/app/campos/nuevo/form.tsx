"use client";

import { useActionState } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { createFarm, type CreateFarmState } from "../actions";

export function CreateFarmForm() {
  const [state, action, pending] = useActionState<CreateFarmState, FormData>(createFarm, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field id="name" name="name" label="Nombre del campo" placeholder="La Hidalguía" required defaultValue={state.values?.name} />
      <Field id="location" name="location" label="Dónde queda" placeholder="Paraje, departamento" defaultValue={state.values?.location} hint="Opcional. Sirve para el clima." />
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creando…" : "Crear campo"}
      </Button>
    </form>
  );
}
