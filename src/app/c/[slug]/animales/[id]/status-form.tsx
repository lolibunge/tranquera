"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, Field, Notice, SelectField } from "@/components/ui";
import { changeStatus, type AnimalFormState } from "../actions";

const CAUSES = [
  { value: "enfermedad", label: "Enfermedad" },
  { value: "parto", label: "Parto o aborto" },
  { value: "accidente", label: "Accidente" },
  { value: "predador", label: "Predador o abigeato" },
  { value: "clima", label: "Clima (frío, rayo, sequía)" },
  { value: "desconocida", label: "Desconocida" },
];

export function StatusForm({ slug, animalId, status, today }: { slug: string; animalId: string; status: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<"vendido" | "muerto" | "baja">("muerto");
  const [cause, setCause] = useState("");
  const [state, action, pending] = useActionState<AnimalFormState, FormData>(changeStatus, {});

  if (status !== "activo") {
    return (
      <form action={action} className="flex flex-col gap-2 border-t border-line pt-5">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="id" value={animalId} />
        <input type="hidden" name="status" value="activo" />
        {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
        <Button type="submit" kind="secondary" disabled={pending}>
          Volver a ponerlo en el padrón
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-5">
      {!open ? (
        <div className="grid grid-cols-2 gap-2.5">
          <Link href={`/c/${slug}/ventas/nueva?animal=${animalId}`} className="inline-flex h-13 items-center justify-center rounded-xl border border-line-strong bg-surface text-base font-semibold">
            Vender
          </Link>
          <Button type="button" kind="danger" onClick={() => setOpen(true)}>
            Muerte u otra baja
          </Button>
        </div>
      ) : (
        <form action={action} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="id" value={animalId} />
          <SelectField id="status" name="status" label="Motivo" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
            <option value="muerto">Muerte</option>
            <option value="baja">Otra baja (extravío, consumo…)</option>
          </SelectField>
          {reason === "muerto" ? (
            <SelectField id="cause" name="cause" label="Causa" required value={cause} onChange={(e) => setCause(e.target.value)}>
              <option value="" disabled>
                Elegí la causa
              </option>
              {CAUSES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </SelectField>
          ) : null}
          {reason === "muerto" && (cause === "parto" || cause === "enfermedad") ? (
            <Notice tone="warn">
              Los abortos en bovinos, ovinos, cerdos y cabras son de denuncia obligatoria (brucelosis). Ante sospecha de una enfermedad
              de denuncia, avisá al veterinario y a la oficina del MGAP de la zona.
            </Notice>
          ) : null}
          <Field id="statusDate" name="date" type="date" label="Fecha" max={today} defaultValue={today} required />
          <Field id="note" name="note" label="Nota" placeholder="Opcional: síntomas, dónde apareció…" />
          <p className="text-[13px] text-muted">No se borra: queda en &ldquo;Ver vendidos y bajas&rdquo; con todo su historial.</p>
          {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
          <div className="flex gap-2.5">
            <Button type="button" kind="secondary" onClick={() => setOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" kind="danger" disabled={pending} className="flex-1">
              Confirmar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
