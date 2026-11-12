"use client";

import { useActionState, useRef, useState } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { saveFarmInfo, type ActionState } from "../actions";

type Values = { name: string; location: string; latitude: string; longitude: string; hectares: string; dicose: string };

export function FarmInfoForm({ slug, initial }: { slug: string; initial: Values }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveFarmInfo, {});
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);
  const latRef = useRef<HTMLInputElement>(null);
  const lngRef = useRef<HTMLInputElement>(null);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGpsMessage("Este dispositivo no da la ubicación.");
      return;
    }
    setGpsMessage("Buscando ubicación…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (latRef.current) latRef.current.value = pos.coords.latitude.toFixed(5);
        if (lngRef.current) lngRef.current.value = pos.coords.longitude.toFixed(5);
        setGpsMessage("Listo. Guardá para que quede.");
      },
      () => setGpsMessage("No pudimos obtener la ubicación. Revisá el permiso del navegador."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      <Field id="name" name="name" label="Nombre" required defaultValue={initial.name} />
      <Field id="location" name="location" label="Dónde queda" defaultValue={initial.location} placeholder="Paraje, departamento" />
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-3">
          <Field id="latitude" name="latitude" label="Latitud" inputMode="decimal" defaultValue={initial.latitude} ref={latRef} placeholder="-34.5" />
          <Field id="longitude" name="longitude" label="Longitud" inputMode="decimal" defaultValue={initial.longitude} ref={lngRef} placeholder="-56.2" />
        </div>
        <button type="button" onClick={useMyLocation} className="h-11 self-start rounded-xl px-3 text-[15px] font-semibold text-brand hover:bg-brand-soft">
          Usar mi ubicación actual
        </button>
        {gpsMessage ? <p className="text-[13px] text-muted">{gpsMessage}</p> : null}
        <p className="text-[13px] text-muted">Las coordenadas se usan para el pronóstico del clima.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id="hectares" name="hectares" label="Hectáreas" inputMode="decimal" defaultValue={initial.hectares} />
        <Field id="dicose" name="dicose" label="N.º de DICOSE" inputMode="numeric" defaultValue={initial.dicose} />
      </div>
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
