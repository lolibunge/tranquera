"use client";

import { useActionState } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { signUp, type FormState } from "../actions";

export function SignUpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signUp, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field id="name" name="name" label="Nombre" autoComplete="name" required defaultValue={state.values?.name} />
      <Field id="email" name="email" type="email" label="Mail" autoComplete="email" inputMode="email" required defaultValue={state.values?.email} />
      <Field id="password" name="password" type="password" label="Contraseña" autoComplete="new-password" minLength={8} required hint="Al menos 8 caracteres." />
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creando…" : "Crear cuenta"}
      </Button>
    </form>
  );
}
