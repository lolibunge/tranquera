"use client";

import { useActionState, useState, type CSSProperties } from "react";
import { Button, FarmMark, Notice } from "@/components/ui";
import { PALETTES, contrastWithWhite } from "@/lib/color";
import { saveBrand, type ActionState } from "../actions";

type Props = { slug: string; name: string; logo: string | null; primary: string; accent: string };

export function BrandForm({ slug, name, logo, primary: initialPrimary, accent: initialAccent }: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveBrand, {});
  const [primary, setPrimary] = useState(initialPrimary);
  const [accent, setAccent] = useState(initialAccent);
  const [preview, setPreview] = useState<string | null>(logo);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const tooLight = contrastWithWhite(primary) < 4.5;

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setFileError(null);
    if (!file) return;
    if (file.size > 300 * 1024) {
      setFileError("Pesa más de 300 KB. Probá con una versión más chica.");
      event.target.value = "";
      return;
    }
    setRemoveLogo(false);
    setPreview(URL.createObjectURL(file));
  }

  const previewStyle = { "--brand": primary, "--accent": accent } as CSSProperties;

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="removeLogo" value={removeLogo ? "1" : "0"} />

      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold">Logo</h2>
        <div className="flex items-center gap-4">
          <FarmMark name={name} logo={removeLogo ? null : preview} size={64} />
          <div className="flex flex-col gap-2">
            <label className="inline-flex h-11 cursor-pointer items-center rounded-xl border border-line-strong bg-surface px-4 text-[15px] font-semibold hover:bg-chip">
              Elegir imagen
              <input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={onFile} className="sr-only" />
            </label>
            {preview && !removeLogo ? (
              <button type="button" onClick={() => setRemoveLogo(true)} className="self-start text-sm font-semibold text-bad-fg">
                Quitar logo
              </button>
            ) : null}
          </div>
        </div>
        <p className="text-[13px] text-muted">PNG, JPG, WEBP o SVG de hasta 300 KB. Sin logo se muestran las iniciales.</p>
        {fileError ? <Notice tone="bad">{fileError}</Notice> : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold">Colores</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {PALETTES.map((p) => {
            const active = p.primary === primary && p.accent === accent;
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setPrimary(p.primary);
                  setAccent(p.accent);
                }}
                className={`flex min-h-13 items-center gap-2 rounded-xl border bg-surface px-3 text-left text-sm font-semibold ${active ? "border-ink ring-2 ring-ink/10" : "border-line"}`}
              >
                <span className="size-5 rounded-md" style={{ background: p.primary }} aria-hidden="true" />
                <span className="size-5 rounded-md" style={{ background: p.accent }} aria-hidden="true" />
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Principal
            <input type="color" name="primary" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-13 w-full cursor-pointer rounded-xl border border-line-strong bg-field p-1" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Acento
            <input type="color" name="accent" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-13 w-full cursor-pointer rounded-xl border border-line-strong bg-field p-1" />
          </label>
        </div>
        {tooLight ? <Notice tone="warn">El color principal es muy claro: el texto blanco de los botones no se leería al sol.</Notice> : null}
      </section>

      <section style={previewStyle} className="flex flex-col gap-3 rounded-2xl border border-line bg-ground p-4" aria-label="Vista previa">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">Vista previa</p>
        <div className="flex items-center gap-3">
          <FarmMark name={name} logo={removeLogo ? null : preview} />
          <span className="text-base font-semibold">{name}</span>
        </div>
        <span className="h-13 rounded-xl bg-brand px-5 text-base font-semibold leading-13 text-white">Registrar vacuna</span>
        <div className="flex gap-2">
          <span className="rounded-full bg-brand px-3 py-1.5 text-sm font-semibold text-white">Vacunos</span>
          <span className="rounded-full bg-chip px-3 py-1.5 text-sm font-semibold">Caballos</span>
          <span className="rounded-full px-3 py-1.5 text-sm font-semibold text-white" style={{ background: accent }}>Acento</span>
        </div>
      </section>

      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      <Button type="submit" disabled={pending || tooLight}>
        {pending ? "Guardando…" : "Guardar marca"}
      </Button>
    </form>
  );
}
