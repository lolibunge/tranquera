"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button, Field, Notice, SelectField } from "@/components/ui";
import { CATALOG, type SpeciesKey } from "@/lib/catalogo";
import { saveAnimal, type AnimalFormState } from "./actions";

export type AnimalValues = {
  id?: string;
  species: SpeciesKey;
  isLot: boolean;
  headCount: string;
  category: string;
  name: string;
  tagVisual: string;
  tagRfid: string;
  birthDate: string;
  breed: string;
  color?: string;
  training?: string;
  origin: "" | "nacido" | "comprado";
  originDetail: string;
  arrivedOn: string;
  notes: string;
  paddockId: string;
  ownerId?: string;
};

type Props = {
  slug: string;
  paddocks?: { id: string; name: string }[];
  /** Propietarios del campo (solo si hay y el usuario maneja cuentas). */
  owners?: { id: string; name: string }[];
  initial: AnimalValues;
  /** Especies prendidas en el campo (para cambiar al cargar uno nuevo). */
  speciesOptions?: SpeciesKey[];
  today: string;
};

const chip = (on: boolean) =>
  `cursor-pointer rounded-full px-3.5 py-2 text-sm font-semibold has-focus-visible:outline-3 has-focus-visible:outline-brand/50 ${on ? "bg-brand text-white" : "bg-chip"}`;

export function AnimalForm(props: Props) {
  const [state, action, pending] = useActionState<AnimalFormState, FormData>(saveAnimal, {});
  // Después de "Guardar y otro" el formulario se vuelve a armar (key nueva) con
  // especie, categoría, raza y origen del anterior, y lo propio del animal vacío.
  const kept = state.ok && state.values ? state.values : null;
  const start: AnimalValues = kept
    ? {
        ...props.initial,
        species: (kept.species as SpeciesKey) || props.initial.species,
        isLot: kept.isLot === "1",
        category: kept.category ?? "",
        breed: kept.breed ?? "",
        color: props.initial.color ?? "",
        training: props.initial.training ?? "",
        origin: (kept.origin as AnimalValues["origin"]) ?? "",
        originDetail: kept.originDetail ?? "",
        arrivedOn: kept.arrivedOn ?? "",
        paddockId: kept.paddockId ?? "",
        ownerId: kept.ownerId ?? props.initial.ownerId ?? "",
      }
    : props.initial;
  return <AnimalFormBody key={state.at ?? 0} {...props} initial={start} state={state} action={action} pending={pending} autoFocus={Boolean(kept)} />;
}

function AnimalFormBody({
  slug,
  paddocks = [],
  owners = [],
  initial,
  speciesOptions = [],
  today,
  state,
  action,
  pending,
  autoFocus,
}: Props & { state: AnimalFormState; action: (fd: FormData) => void; pending: boolean; autoFocus: boolean }) {
  const [v, setV] = useState<AnimalValues>(initial);
  const firstField = useRef<HTMLInputElement>(null);
  const editing = Boolean(initial.id);
  const info = CATALOG[v.species];
  const lotMode = info.mode === "lote" || (info.mode === "ambos" && v.isLot);

  useEffect(() => {
    if (autoFocus) firstField.current?.focus();
  }, [autoFocus]);

  const set = <K extends keyof AnimalValues>(key: K, value: AnimalValues[K]) => setV((prev) => ({ ...prev, [key]: value }));

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="species" value={v.species} />
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="isLot" value={lotMode ? "1" : "0"} />

      {!editing && speciesOptions.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Especie">
          {speciesOptions.map((key) => (
            <label key={key} className={chip(v.species === key)}>
              <input
                type="radio"
                name="speciesPick"
                className="sr-only"
                checked={v.species === key}
                onChange={() => setV((prev) => ({ ...prev, species: key, category: "", breed: "", isLot: CATALOG[key].mode === "lote" }))}
              />
              {CATALOG[key].label}
            </label>
          ))}
        </div>
      ) : null}

      {!editing && info.mode === "ambos" ? (
        <div role="radiogroup" aria-label="Cómo cargar" className="grid grid-cols-2 rounded-xl bg-chip p-1">
          {[
            { lot: false, label: "Uno por uno" },
            { lot: true, label: "Lote con cantidad" },
          ].map((opt) => (
            <label key={opt.label} className={`flex h-11 cursor-pointer items-center justify-center rounded-lg text-sm font-semibold has-focus-visible:outline-3 ${v.isLot === opt.lot ? "bg-surface shadow-sm" : "text-muted"}`}>
              <input type="radio" name="lotPick" className="sr-only" checked={v.isLot === opt.lot} onChange={() => set("isLot", opt.lot)} />
              {opt.label}
            </label>
          ))}
        </div>
      ) : null}

      {lotMode ? (
        <div className="grid grid-cols-[1fr_8rem] gap-3">
          <Field id="name" name="name" label="Nombre del lote" required value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Ponedoras galpón 1" ref={firstField} />
          <Field id="headCount" name="headCount" label="Cabezas" type="number" inputMode="numeric" min={1} required value={v.headCount} onChange={(e) => set("headCount", e.target.value)} />
        </div>
      ) : (
        <>
          {info.traceability ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                id="tagVisual"
                name="tagVisual"
                label="Caravana visual"
                value={v.tagVisual}
                onChange={(e) => set("tagVisual", e.target.value)}
                placeholder={info.traceability === "snig" ? "UY 0000 0000" : "Número"}
                autoComplete="off"
                ref={firstField}
              />
              <Field
                id="tagRfid"
                name="tagRfid"
                label="Botón RFID"
                value={v.tagRfid}
                onChange={(e) => set("tagRfid", e.target.value)}
                inputMode="numeric"
                autoComplete="off"
                hint="Tocá acá y pasá el bastón."
              />
            </div>
          ) : null}
          <Field
            id="name"
            name="name"
            label={info.traceability ? "Nombre (opcional)" : "Nombre"}
            value={v.name}
            onChange={(e) => set("name", e.target.value)}
            ref={info.traceability ? undefined : firstField}
          />
        </>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Categoría{lotMode ? " (opcional)" : ""}</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Categoría">
          {info.categories.map((c) => (
            <label key={c.value} className={chip(v.category === c.value)}>
              <input type="radio" name="category" value={c.value} className="sr-only" checked={v.category === c.value} onChange={() => set("category", c.value)} required={!lotMode} />
              {c.label}
            </label>
          ))}
        </div>
        {!lotMode ? <p className="text-[13px] text-muted">El sexo sale de la categoría.</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field id="birthDate" name="birthDate" label={lotMode ? "Nacimiento o ingreso" : "Nacimiento"} type="date" max={today} value={v.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="breed" className="text-sm font-semibold">
            Raza
          </label>
          <input
            id="breed"
            name="breed"
            list={`razas-${v.species}`}
            value={v.breed}
            onChange={(e) => set("breed", e.target.value)}
            className="h-13 rounded-xl border border-line-strong bg-field px-4 text-base"
          />
          <datalist id={`razas-${v.species}`}>
            {info.breeds.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </div>
      </div>

      {v.species === "caballo" && !lotMode ? (
        <div className="grid grid-cols-2 gap-3">
          <Field id="color" name="color" label="Pelaje" list="pelajes" value={v.color ?? ""} onChange={(e) => set("color", e.target.value)} placeholder="Zaino, tordillo…" />
          <datalist id="pelajes">
            {["Zaino", "Tordillo", "Moro", "Alazán", "Bayo", "Overo", "Picazo", "Gateado", "Rosillo", "Tostado", "Blanco", "Negro"].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <SelectField id="training" name="training" label="Doma" value={v.training ?? ""} onChange={(e) => set("training", e.target.value)}>
            <option value="">Sin dato</option>
            <option value="sin_domar">Sin domar</option>
            <option value="en_doma">En doma</option>
            <option value="domado">Domado</option>
            <option value="retirado">Retirado</option>
          </SelectField>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Origen</p>
        <div role="radiogroup" aria-label="Origen" className="grid grid-cols-2 rounded-xl bg-chip p-1">
          {[
            { value: "nacido" as const, label: "Nació en el campo" },
            { value: "comprado" as const, label: "Comprado" },
          ].map((opt) => (
            <label key={opt.value} className={`flex h-11 cursor-pointer items-center justify-center rounded-lg text-sm font-semibold has-focus-visible:outline-3 ${v.origin === opt.value ? "bg-surface shadow-sm" : "text-muted"}`}>
              <input type="radio" name="origin" value={opt.value} className="sr-only" checked={v.origin === opt.value} onChange={() => set("origin", opt.value)} />
              {opt.label}
            </label>
          ))}
        </div>
        {v.origin === "comprado" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field id="originDetail" name="originDetail" label="A quién / dónde" value={v.originDetail} onChange={(e) => set("originDetail", e.target.value)} />
            <Field id="arrivedOn" name="arrivedOn" label="Llegó el" type="date" max={today} value={v.arrivedOn} onChange={(e) => set("arrivedOn", e.target.value)} />
          </div>
        ) : null}
      </div>

      {paddocks.length && !editing ? (
        <SelectField id="paddockId" name="paddockId" label="Potrero" value={v.paddockId} onChange={(e) => set("paddockId", e.target.value)}>
          <option value="">Sin potrero</option>
          {paddocks.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
      ) : null}

      {owners.length ? (
        <SelectField id="ownerId" name="ownerId" label="Propietario" value={v.ownerId ?? ""} onChange={(e) => set("ownerId", e.target.value)}>
          <option value="">Del campo (sin asignar)</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </SelectField>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-sm font-semibold">
          Notas
        </label>
        <textarea id="notes" name="notes" rows={2} value={v.notes} onChange={(e) => set("notes", e.target.value)} className="rounded-xl border border-line-strong bg-field px-4 py-3 text-base" />
      </div>

      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}

      <div className="sticky bottom-24 flex gap-2.5 pt-2">
        {!editing ? (
          <Button type="submit" name="then" value="otro" kind="secondary" disabled={pending} className="flex-1 shadow-lg">
            Guardar y otro
          </Button>
        ) : null}
        <Button type="submit" name="then" value="ver" disabled={pending} className="flex-1 shadow-lg">
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
      {!editing && info.mode !== "lote" ? (
        <Link href={`/c/${slug}/animales/varios?e=${v.species}`} className="self-center py-2 text-[15px] font-semibold text-brand">
          Cargar varios por caravana
        </Link>
      ) : null}
    </form>
  );
}
