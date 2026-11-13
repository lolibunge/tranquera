"use client";

import { useActionState, useState } from "react";
import { Button, Notice } from "@/components/ui";
import { saveProfileAction, type OwnerState } from "../propietarios/actions";

function YesNo({ name, question, help, initial }: { name: string; question: string; help: string; initial: boolean }) {
  const [yes, setYes] = useState(initial);
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-4">
      <input type="hidden" name={name} value={yes ? "si" : "no"} />
      <p className="text-base font-semibold">{question}</p>
      <p className="text-[13px] leading-snug text-muted">{help}</p>
      <div role="radiogroup" aria-label={question} className="grid grid-cols-2 gap-1 rounded-xl bg-chip p-1">
        {[false, true].map((v) => (
          <button key={String(v)} type="button" role="radio" aria-checked={yes === v} onClick={() => setYes(v)} className={`h-11 rounded-lg text-[15px] font-semibold ${yes === v ? "bg-surface shadow-sm" : "text-muted"}`}>
            {v ? "Sí" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ProfileForm({ slug, hasBoarders, hasPartners }: { slug: string; hasBoarders: boolean; hasPartners: boolean }) {
  const [state, action, pending] = useActionState<OwnerState, FormData>(saveProfileAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      <YesNo
        name="hasBoarders"
        question="¿Hay animales de otros dueños en el campo?"
        help="Pensión, haras, club de polo, capitalización. Suma la cuenta de cada dueño, las tarifas y repartir gastos entre animales."
        initial={hasBoarders}
      />
      <YesNo name="hasPartners" question="¿Hay socios o pozo común?" help="Suma el porcentaje de cada socio y el resultado del año por socio." initial={hasPartners} />
      <p className="text-[13px] text-muted">Siempre están: gastos, ventas, quién puso la plata y reintegros.</p>
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
