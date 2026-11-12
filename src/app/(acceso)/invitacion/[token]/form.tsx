"use client";

import { useActionState } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { acceptInvitation, type AcceptState } from "./actions";

export function AcceptForm({ token, mode }: { token: string; mode: "join" | "create" }) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(acceptInvitation, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {mode === "create" ? (
        <>
          <Field id="name" name="name" label="Tu nombre" autoComplete="name" required defaultValue={state.values?.name} />
          <Field id="password" name="password" type="password" label="Contraseña" autoComplete="new-password" minLength={8} required hint="Al menos 8 caracteres." />
        </>
      ) : null}
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Entrando…" : mode === "create" ? "Crear cuenta y entrar" : "Aceptar y entrar"}
      </Button>
    </form>
  );
}
