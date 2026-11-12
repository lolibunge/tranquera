"use client";

import { SelectField } from "./ui";
import { CATALOG, isHealthControl, type SpeciesKey } from "@/lib/catalogo";

/** Lista de trabajos de una especie, en dos grupos: Sanidad y Manejo y reproducción. */
export function ControlSelect({
  species,
  value,
  onChange,
  label = "Qué se hace",
}: {
  species: SpeciesKey;
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const controls = CATALOG[species].controls;
  const health = controls.filter(isHealthControl);
  const work = controls.filter((c) => !isHealthControl(c));
  return (
    <SelectField id="control" name="control" label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <optgroup label="Sanidad">
        {health.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </optgroup>
      {work.length ? (
        <optgroup label="Manejo y reproducción">
          {work.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </optgroup>
      ) : null}
      <option value="otro">Otro…</option>
    </SelectField>
  );
}
