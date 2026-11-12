"use client";

import { useActionState } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { saveWeatherAction, type WeatherState } from "./actions";

export function WeatherForm({ slug, today }: { slug: string; today: string }) {
  const [state, action, pending] = useActionState<WeatherState, FormData>(saveWeatherAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" key={state.at}>
      <input type="hidden" name="slug" value={slug} />
      <div className="grid grid-cols-2 gap-3">
        <Field id="date" name="date" type="date" label="Fecha" max={today} defaultValue={today} required />
        <Field id="rainMm" name="rainMm" label="Lluvia (mm)" inputMode="decimal" placeholder="0" />
      </div>
      <label className="flex min-h-11 items-center gap-3 text-[15px] font-semibold">
        <input type="checkbox" name="frost" className="size-5 accent-brand" />
        Hubo helada
      </label>
      <Field id="note" name="note" label="Nota" placeholder="Opcional: granizo, viento…" />
      <p className="text-[13px] text-muted">Si ya había un registro de ese día, se reemplaza.</p>
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
