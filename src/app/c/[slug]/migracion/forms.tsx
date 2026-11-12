"use client";

import { useActionState } from "react";
import { Button, Notice, SelectField } from "@/components/ui";
import { importAction, probeAction, type ImportState, type ProbeState } from "./actions";

export function ProbeForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<ProbeState, FormData>(probeAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <Button type="submit" kind="secondary" disabled={pending}>
        {pending ? "Conectando…" : "Probar la conexión"}
      </Button>
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.probe ? (
        <div className="flex flex-col gap-3">
          <Notice tone={state.probe.roleCanWrite ? "warn" : "ok"}>
            Conectado en modo solo lectura.
            {state.probe.roleCanWrite
              ? " Igual, el usuario de la variable tiene permiso para escribir: conviene usar uno de solo lectura (Tranquera nunca escribe en la base vieja)."
              : " El usuario no puede escribir en la base vieja."}
          </Notice>
          <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface text-[14px]">
            {state.probe.counts
              .filter((c) => c.rows > 0)
              .map((c) => (
                <li key={c.table} className="flex items-center justify-between gap-3 border-b border-chip px-4 py-2 last:border-b-0">
                  <span className="flex flex-col">
                    <span className="font-semibold">{c.label}</span>
                    <span className="text-[12px] text-muted">{c.target ? `→ ${c.target}` : "→ solo archivo"}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{c.rows.toLocaleString("es-UY")}</span>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}

function Currency({ id, label }: { id: string; label: string }) {
  return (
    <SelectField id={id} name={id} label={label} defaultValue="UYU">
      <option value="UYU">Pesos ($)</option>
      <option value="USD">Dólares (US$)</option>
    </SelectField>
  );
}

export function ImportForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importAction, {});
  const r = state.report;
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      <p className="text-sm leading-relaxed text-ink-2">
        En campo-admin los montos no tienen moneda. Elegí la que corresponde a cada grupo; después cada gasto se puede revisar.
      </p>
      <Currency id="expensesCurrency" label="Gastos generales" />
      <Currency id="ownersCurrency" label="Pensiones y compras a cuenta de los dueños" />
      <Currency id="healthCurrency" label="Costos de sanidad y herrero" />

      <Button type="submit" name="mode" value="ensayo" kind="secondary" disabled={pending}>
        {pending ? "Trabajando…" : "Hacer el ensayo (no cambia nada)"}
      </Button>

      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {r ? (
        <div className="flex flex-col gap-3">
          <Notice tone={r.dryRun ? "info" : "ok"}>
            {r.dryRun ? "Ensayo: así quedaría. Todavía no se guardó nada." : "Importación terminada. Abajo está la verificación."}
          </Notice>
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[20rem] text-[13px]">
              <thead className="bg-ground text-left text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">Qué</th>
                  <th className="px-2 py-2 text-right font-semibold">Origen</th>
                  <th className="px-2 py-2 text-right font-semibold">{r.dryRun ? "Se crean" : "Creados"}</th>
                  <th className="px-3 py-2 text-right font-semibold">Guardado</th>
                </tr>
              </thead>
              <tbody>
                {r.tables
                  .filter((t) => t.source > 0)
                  .map((t) => (
                    <tr key={t.table} className="border-t border-chip">
                      <td className="px-3 py-2">
                        <span className="font-semibold">{t.label}</span>
                        <span className="block text-[11px] text-muted">{t.target ? `→ ${t.target}` : "solo archivo"}</span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{t.source}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{t.target ? t.created : "—"}</td>
                      <td className={`px-3 py-2 text-right font-semibold tabular-nums ${t.archived === t.source ? "text-ok-fg" : "text-bad-fg"}`}>{t.archived}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {r.warnings.map((w) => (
            <Notice key={w} tone="warn">
              {w}
            </Notice>
          ))}
          {r.dryRun ? (
            <>
              <label className="flex items-start gap-3 text-[15px]">
                <input type="checkbox" name="confirm" className="mt-1 size-5 accent-brand" />
                Revisé el ensayo y quiero importar. Se puede repetir: lo ya importado no se duplica.
              </label>
              <Button type="submit" name="mode" value="importar" disabled={pending}>
                {pending ? "Importando…" : "Importar a Tranquera"}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
