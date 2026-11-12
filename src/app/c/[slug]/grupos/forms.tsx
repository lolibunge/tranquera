"use client";

import { useActionState, useState } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { AnimalPicker, type PickAnimal } from "@/components/animal-picker";
import { saveHerdAction, setMembersAction, type HerdState } from "./actions";

export function HerdForm({ slug, herd }: { slug: string; herd?: { id: string; name: string; notes: string | null } }) {
  const [state, action, pending] = useActionState<HerdState, FormData>(saveHerdAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      {herd ? <input type="hidden" name="id" value={herd.id} /> : null}
      <Field id="name" name="name" label="Nombre" defaultValue={herd?.name} placeholder="Ej.: Tropilla de trabajo, Yeguas de cría" required />
      <Field id="notes" name="notes" label="Notas" defaultValue={herd?.notes ?? ""} placeholder="Opcional" />
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : herd ? "Guardar" : "Crear grupo"}
      </Button>
    </form>
  );
}

export function MembersForm({
  slug,
  herdId,
  today,
  animals,
  species,
  paddocks,
  preselected,
}: {
  slug: string;
  herdId: string;
  today: string;
  animals: PickAnimal[];
  species: { key: string; label: string }[];
  paddocks: { id: string; name: string }[];
  preselected: string[];
}) {
  const [state, action, pending] = useActionState<HerdState, FormData>(setMembersAction, {});
  const [selected, setSelected] = useState(() => new Set(preselected));
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={herdId} />
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="animal" value={id} />
      ))}
      <AnimalPicker animals={animals} species={species} paddocks={paddocks} selected={selected} onChange={setSelected} />
      <Field id="date" name="date" type="date" label="Desde cuándo" max={today} defaultValue={today} hint="Los que sumes entran ese día; los que saques, salen ese día." />
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : `Guardar (${selected.size})`}
      </Button>
    </form>
  );
}
