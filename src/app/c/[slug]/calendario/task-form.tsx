"use client";

import { useActionState } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { createTaskAction, type TaskState } from "./actions";

export function TaskForm({ slug, defaultDate }: { slug: string; defaultDate: string }) {
  const [state, action, pending] = useActionState<TaskState, FormData>(createTaskAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" key={state.at}>
      <input type="hidden" name="slug" value={slug} />
      <Field id="title" name="title" label="Qué hay que hacer" placeholder="Ej.: Arreglar alambrado del Potrero 3" required />
      <div className="grid grid-cols-2 gap-3">
        <Field id="date" name="date" type="date" label="Día" defaultValue={defaultDate} required />
        <Field id="notes" name="notes" label="Nota" placeholder="Opcional" />
      </div>
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Agregar tarea"}
      </Button>
    </form>
  );
}
