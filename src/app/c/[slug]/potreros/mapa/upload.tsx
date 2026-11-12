"use client";

import { useActionState } from "react";
import { Button, Notice } from "@/components/ui";
import { archiveUnmappedAction, uploadMapAction, type PaddockState } from "../actions";

export function MapUpload({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<PaddockState, FormData>(uploadMapAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Archivo SVG
        <input
          type="file"
          name="map"
          accept=".svg,image/svg+xml"
          required
          className="rounded-xl border border-line-strong bg-field p-3 text-base file:mr-3 file:rounded-lg file:border-0 file:bg-chip file:px-3 file:py-2 file:font-semibold"
        />
      </label>
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Leyendo el mapa…" : "Subir mapa"}
      </Button>
    </form>
  );
}

/** Potreros que no están en el mapa actual: se pueden archivar de una vez los que están vacíos. */
export function UnmappedList({ slug, items }: { slug: string; items: { name: string; heads: number }[] }) {
  const [state, action, pending] = useActionState<PaddockState, FormData>(archiveUnmappedAction, {});
  const empty = items.filter((i) => i.heads === 0).length;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-warn-dot/30 bg-warn-bg/50 p-4">
      <p className="text-[15px] font-semibold">No están en el mapa ({items.length})</p>
      <p className="text-sm text-ink-2">
        Estos potreros existen pero no aparecen en el mapa. Si ya no se usan, archivalos: no se borra su historial. Si sí existen, nombralos en el mapa.
      </p>
      <p className="text-sm text-ink-2">{items.map((i) => (i.heads ? `${i.name} (${i.heads} cab.)` : i.name)).join(", ")}</p>
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {empty ? (
        <form action={action}>
          <input type="hidden" name="slug" value={slug} />
          <Button type="submit" kind="secondary" disabled={pending} className="w-full">
            Archivar los {empty} que están vacíos
          </Button>
        </form>
      ) : null}
    </section>
  );
}
