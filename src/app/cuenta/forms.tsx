"use client";

import { useActionState } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { saveName, savePassword, type AccountState } from "./actions";

export function NameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(saveName, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field id="name" name="name" label="Nombre" defaultValue={name} required autoComplete="name" />
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      <Button type="submit" kind="secondary" disabled={pending}>Guardar</Button>
    </form>
  );
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(savePassword, {});
  return (
    <form action={action} className="flex flex-col gap-4" key={state.at}>
      {hasPassword ? <Field id="current" name="current" type="password" label="Contraseña actual" autoComplete="current-password" required /> : null}
      <Field id="password" name="password" type="password" label="Contraseña nueva" autoComplete="new-password" minLength={8} required hint="Al menos 8 caracteres." />
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      <Button type="submit" kind="secondary" disabled={pending}>Guardar contraseña</Button>
    </form>
  );
}
