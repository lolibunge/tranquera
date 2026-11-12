"use client";

import { useActionState, useState } from "react";
import { Button, Field, Notice, SelectField } from "@/components/ui";
import { recordReadingAction, recordWorkAction, type PaddockState } from "./actions";

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function WorkForm({ slug, paddockId, today, kinds }: { slug: string; paddockId: string; today: string; kinds: readonly { value: string; label: string; days: number }[] }) {
  const [state, action, pending] = useActionState<PaddockState, FormData>(recordWorkAction, {});
  const [kind, setKind] = useState<string>(kinds[0].value);
  const [date, setDate] = useState(today);
  const days = kinds.find((k) => k.value === kind)?.days ?? 0;
  const [ready, setReady] = useState(days ? addDays(today, days) : "");
  const update = (k: string, d: string) => {
    const n = kinds.find((x) => x.value === k)?.days ?? 0;
    setReady(n ? addDays(d, n) : "");
  };
  return (
    <form action={action} className="flex flex-col gap-4" key={state.at}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="paddockId" value={paddockId} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          id="kind"
          name="kind"
          label="Qué se hizo"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            update(e.target.value, date);
          }}
        >
          {kinds.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </SelectField>
        <Field
          id="workDate"
          name="date"
          type="date"
          label="Fecha"
          max={today}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            update(kind, e.target.value);
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id="readyOn" name="readyOn" type="date" label="Pronto para pastorear" min={date} value={ready} onChange={(e) => setReady(e.target.value)} hint={days ? `Sugerido: ${days} días.` : "Opcional."} />
        <Field id="doneBy" name="doneBy" label="Lo hizo" placeholder="Opcional" />
      </div>
      <Field id="workNotes" name="notes" label="Notas" placeholder="Semilla, producto, dosis…" />
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Registrar laboreo"}
      </Button>
    </form>
  );
}

export function ReadingForm({ slug, paddockId, today }: { slug: string; paddockId: string; today: string }) {
  const [state, action, pending] = useActionState<PaddockState, FormData>(recordReadingAction, {});
  const [how, setHow] = useState<"cuadro" | "directo">("cuadro");
  const [mode, setMode] = useState<"verde" | "seco">("verde");
  return (
    <form action={action} className="flex flex-col gap-4" key={state.at}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="paddockId" value={paddockId} />
      <input type="hidden" name="mode" value={mode} />
      <div role="radiogroup" aria-label="Cómo se midió" className="grid grid-cols-2 gap-1 rounded-xl bg-chip p-1">
        {[
          { v: "cuadro" as const, label: "Con cuadro" },
          { v: "directo" as const, label: "Ya tengo el kg MS/ha" },
        ].map((o) => (
          <button key={o.v} type="button" role="radio" aria-checked={how === o.v} onClick={() => setHow(o.v)} className={`h-11 rounded-lg text-sm font-semibold ${how === o.v ? "bg-surface shadow-sm" : "text-muted"}`}>
            {o.label}
          </button>
        ))}
      </div>
      <Field id="readingDate" name="date" type="date" label="Fecha" max={today} defaultValue={today} />
      {how === "directo" ? (
        <Field id="direct" name="direct" label="kg de MS por hectárea" inputMode="decimal" required />
      ) : (
        <>
          <Field id="samples" name="samples" label="Gramos de cada muestra" placeholder="Ej.: 120 95 140 110" hint="Separados por espacio." required />
          <div className="grid grid-cols-2 gap-3">
            <Field id="areaM2" name="areaM2" label="Área del cuadro (m²)" inputMode="decimal" defaultValue="0,25" />
            <SelectField id="modePick" label="Se pesó" value={mode} onChange={(e) => setMode(e.target.value as "verde" | "seco")}>
              <option value="verde">En verde</option>
              <option value="seco">Seco</option>
            </SelectField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {mode === "verde" ? <Field id="dmPct" name="dmPct" label="% materia seca" inputMode="decimal" defaultValue="20" /> : <span />}
            <Field id="height" name="height" label="Altura" placeholder="Opcional: 8 cm" />
          </div>
        </>
      )}
      <Field id="readingNotes" name="notes" label="Notas" placeholder="Opcional" />
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar medición"}
      </Button>
    </form>
  );
}
