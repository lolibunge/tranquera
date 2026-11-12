"use client";

import { useActionState } from "react";
import { Button, Card, Notice } from "@/components/ui";
import { clearDemoData, loadDemoData, type ActionState } from "../actions";

/** Solo para dueños: carga o borra vacunos de prueba (caravanas UY 9000…). */
export function DemoData({ slug, hasDemo }: { slug: string; hasDemo: boolean }) {
  const [loadState, load, loading] = useActionState<ActionState, FormData>(loadDemoData, {});
  const [clearState, clear, clearing] = useActionState<ActionState, FormData>(clearDemoData, {});
  const state = (loadState.at ?? 0) > (clearState.at ?? 0) || loadState.error ? loadState : clearState;
  return (
    <Card className="flex flex-col gap-3">
      <p className="text-base font-semibold">Datos de prueba</p>
      <p className="text-sm leading-snug text-ink-2">
        11 vacunos (UY 9000…), 20 ovinos (UY 9100…) y un lote de 15 corderos, 4 potreros con mapa, sanidad vencida, por vencer y al día, ecografías, pesadas, esquila del año pasado, lluvias, y una jornada de aftosa y otra de esquila empezadas. Borrar quita solo eso.
      </p>
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        {!hasDemo ? (
          <form action={load} className="flex-1">
            <input type="hidden" name="slug" value={slug} />
            <Button type="submit" kind="secondary" disabled={loading} className="w-full">
              {loading ? "Cargando…" : "Cargar datos de prueba"}
            </Button>
          </form>
        ) : (
          <form
            action={clear}
            className="flex-1"
            onSubmit={(e) => {
              if (!confirm("¿Borrar los vacunos de prueba (UY 9000…) y su sanidad?")) e.preventDefault();
            }}
          >
            <input type="hidden" name="slug" value={slug} />
            <Button type="submit" kind="danger" disabled={clearing} className="w-full">
              {clearing ? "Borrando…" : "Borrar datos de prueba"}
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}
