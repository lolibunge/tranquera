"use client";

import { useActionState } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { activateWithCode, type FormState } from "../actions";

export function ActivateForm({ phone }: { phone: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(activateWithCode, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field id="phone" name="phone" type="tel" inputMode="tel" label="Celular" autoComplete="tel" required defaultValue={state.values?.phone ?? phone} placeholder="099 123 456" />
      <Field
        id="code"
        name="code"
        label="Código"
        required
        autoCapitalize="characters"
        autoComplete="one-time-code"
        defaultValue={state.values?.code}
        placeholder="ABCD-2345"
        className="[&_input]:uppercase [&_input]:tracking-widest"
      />
      <Field id="password" name="password" type="password" label="Contraseña nueva" autoComplete="new-password" minLength={8} required hint="Al menos 8 caracteres. La vas a usar para entrar." />
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Activando…" : "Activar y entrar"}
      </Button>
    </form>
  );
}
