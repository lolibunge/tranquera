"use client";

import { useActionState } from "react";
import { Button, Notice } from "@/components/ui";
import { uploadMapAction, type PaddockState } from "../actions";

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
