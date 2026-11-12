"use client";

import { useActionState, useState } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { requestLink, signIn, type FormState } from "../actions";

export function SignInForms({ next }: { next: string }) {
  const [mode, setMode] = useState<"password" | "link">("password");
  const [pwState, pwAction, pwPending] = useActionState<FormState, FormData>(signIn, {});
  const [linkState, linkAction, linkPending] = useActionState<FormState, FormData>(requestLink, {});

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Forma de entrar" className="grid grid-cols-2 rounded-xl bg-chip p-1">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "password"}
          onClick={() => setMode("password")}
          className={`h-11 rounded-lg text-[15px] font-semibold ${mode === "password" ? "bg-surface shadow-sm" : "text-muted"}`}
        >
          Con contraseña
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "link"}
          onClick={() => setMode("link")}
          className={`h-11 rounded-lg text-[15px] font-semibold ${mode === "link" ? "bg-surface shadow-sm" : "text-muted"}`}
        >
          Con enlace por mail
        </button>
      </div>

      {mode === "password" ? (
        <form action={pwAction} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <Field id="email" name="email" type="email" label="Mail" autoComplete="email" inputMode="email" required defaultValue={pwState.values?.email} />
          <Field id="password" name="password" type="password" label="Contraseña" autoComplete="current-password" required />
          {pwState.error ? <Notice tone="bad">{pwState.error}</Notice> : null}
          <Button type="submit" disabled={pwPending}>
            {pwPending ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      ) : (
        <form action={linkAction} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <Field
            id="email-link"
            name="email"
            type="email"
            label="Mail"
            autoComplete="email"
            inputMode="email"
            required
            defaultValue={linkState.values?.email}
            hint="Te mandamos un enlace para entrar sin contraseña."
          />
          {linkState.error ? <Notice tone="bad">{linkState.error}</Notice> : null}
          {linkState.ok ? <Notice tone="ok">{linkState.ok}</Notice> : null}
          {linkState.devLink ? (
            <Notice tone="info">
              Modo prueba, sin mail configurado:{" "}
              <a href={linkState.devLink} className="font-semibold underline">
                abrir el enlace
              </a>
            </Notice>
          ) : null}
          <Button type="submit" disabled={linkPending}>
            {linkPending ? "Mandando…" : "Mandarme el enlace"}
          </Button>
        </form>
      )}
    </div>
  );
}
