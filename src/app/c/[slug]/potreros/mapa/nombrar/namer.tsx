"use client";

import { createElement, startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Notice } from "@/components/ui";
import type { FarmMap } from "@/lib/svg-map";
import { labelFor } from "@/lib/svg-geometry";
import { nameShapeAction, type PaddockState } from "../../actions";

/**
 * Editor para nombrar el mapa: se toca una división, se escribe el nombre
 * (o se elige un potrero existente) y se pasa sola a la siguiente sin nombre.
 */
export function MapNamer({ slug, map, paddocks }: { slug: string; map: FarmMap; paddocks: string[] }) {
  const router = useRouter();
  const [shapes, setShapes] = useState(map.shapes);
  const firstPending = () => shapes.findIndex((s) => !s.name && !s.background);
  const [selected, setSelected] = useState<number>(() => map.shapes.findIndex((s) => !s.name && !s.background));
  const [name, setName] = useState("");
  const [state, action, pending] = useActionState<PaddockState, FormData>(nameShapeAction, {});
  const input = useRef<HTMLInputElement>(null);
  const lastAt = useRef(0);

  const vb = map.viewBox.split(/[\s,]+/).map(Number);
  const fontSize = Math.max(vb[2], vb[3]) / 40;
  const named = shapes.filter((s) => s.name).length;
  const background = shapes.filter((s) => s.background).length;
  const pendingCount = shapes.length - named - background;

  // Al guardar bien: actualiza la forma en pantalla y salta a la siguiente sin nombre.
  useEffect(() => {
    if (!state.ok || !state.at || state.at === lastAt.current) return;
    lastAt.current = state.at;
    router.refresh();
  }, [state, router]);

  function choose(i: number) {
    setSelected(i);
    setName(shapes[i].name ?? "");
    setTimeout(() => input.current?.focus(), 0);
  }

  function submit(form: FormData, bg: boolean) {
    const updated = shapes.map((s, i) => (i === selected ? { ...s, name: bg ? null : name.trim(), background: bg || undefined } : s));
    setShapes(updated);
    form.set("background", bg ? "1" : "0");
    startTransition(() => action(form));
    const next = updated.findIndex((s, i) => i !== selected && !s.name && !s.background);
    setSelected(next);
    setName("");
    if (next >= 0) setTimeout(() => input.current?.focus(), 0);
  }

  const current = selected >= 0 ? shapes[selected] : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-semibold">
        {named} con nombre · {background} de fondo · {pendingCount} sin nombre
      </p>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface p-2">
        <svg viewBox={map.viewBox} className="h-auto max-h-[55vh] w-full touch-manipulation" role="group" aria-label="Mapa para nombrar">
          {shapes.map((shape, i) => {
            const isSel = i === selected;
            const fill = isSel ? "var(--accent)" : shape.background ? "#d6ccbf" : shape.name ? "var(--brand)" : "#fdf0d5";
            const opacity = isSel ? 0.75 : shape.background ? 0.35 : shape.name ? 0.35 : 0.9;
            return (
              <g key={i} onClick={() => choose(i)} className="cursor-pointer">
                {createElement(shape.tag, {
                  ...shape.attrs,
                  transform: shape.transform || undefined,
                  fill,
                  fillOpacity: opacity,
                  stroke: isSel ? "#231a14" : "#6b5d52",
                  strokeWidth: isSel ? 2.5 : 1,
                  vectorEffect: "non-scaling-stroke",
                })}
              </g>
            );
          })}
          {shapes.map((shape, i) => {
            if (!shape.name) return null;
            const l = labelFor(shape, shape.name, fontSize);
            if (!l) return null;
            return (
              <g key={`t${i}`} transform={shape.transform || undefined} pointerEvents="none">
                <text x={l.x} y={l.y} textAnchor="middle" fontSize={l.size} fontWeight={600} fill="#231a14" stroke="#fffdf9" strokeWidth={l.size / 5} paintOrder="stroke">
                  {shape.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-xs text-muted">Amarillo: sin nombre · marrón: potrero · gris: fondo. Tocá una división para cambiarla.</p>

      {current ? (
        <form
          action={(fd) => submit(fd, false)}
          className="sticky bottom-24 flex flex-col gap-3 rounded-2xl border-2 border-accent bg-surface p-4 shadow-lg"
        >
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="index" value={selected} />
          <label htmlFor="shape-name" className="text-sm font-semibold">
            {current.name ? "Cambiar nombre" : "Nombre de esta división"}
          </label>
          <input
            ref={input}
            id="shape-name"
            name="name"
            list="potreros-existentes"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            placeholder="Potrero 3"
            className="h-13 rounded-xl border border-line-strong bg-field px-4 text-base"
          />
          <datalist id="potreros-existentes">
            {paddocks.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              kind="secondary"
              disabled={pending}
              onClick={() => {
                const fd = new FormData();
                fd.set("slug", slug);
                fd.set("index", String(selected));
                fd.set("name", "");
                submit(fd, true);
              }}
            >
              No es potrero
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              Guardar
            </Button>
          </div>
          {firstPending() === -1 ? null : (
            <button type="button" onClick={() => setSelected(-1)} className="text-sm font-semibold text-muted">
              Cerrar
            </button>
          )}
        </form>
      ) : pendingCount === 0 ? (
        <Notice tone="ok">Listo: todas las divisiones tienen nombre o están marcadas como fondo.</Notice>
      ) : (
        <Button type="button" kind="secondary" onClick={() => choose(firstPending())}>
          Seguir con la próxima sin nombre
        </Button>
      )}
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
    </div>
  );
}
