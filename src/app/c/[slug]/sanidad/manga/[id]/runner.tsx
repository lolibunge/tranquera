"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Notice } from "@/components/ui";
import { SyncStatus } from "@/components/sync-status";
import { tagMatches } from "@/lib/catalogo";
import { enqueue, flush, pending, removeFromQueue } from "@/lib/offline-queue";
import { closeSession } from "../../actions";

type Animal = { id: string; tagVisual: string | null; tagRfid: string | null; title: string; sub: string };
type Props = {
  slug: string;
  sessionId: string;
  closed: boolean;
  canWrite: boolean;
  animals: Animal[];
  recorded: { animalId: string; clientId: string | null }[];
  newAnimalHref: string;
};

type Last =
  | { kind: "ok"; animal: Animal; clientId: string }
  | { kind: "repeat"; animal: Animal }
  | { kind: "missing"; read: string }
  | { kind: "many"; read: string; count: number };

/**
 * Pantalla de la manga: el bastón escribe la caravana y manda Enter.
 * Busca en el padrón que ya está en el celular, así funciona sin señal;
 * cada registro va a la cola local y se sube solo.
 */
export function MangaRunner({ slug, sessionId, closed, canWrite, animals, recorded: initial, newAnimalHref }: Props) {
  const [done, setDone] = useState<Map<string, string | null>>(() => new Map(initial.map((r) => [r.animalId, r.clientId])));
  const [read, setRead] = useState("");
  const [last, setLast] = useState<Last | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const byId = useMemo(() => new Map(animals.map((a) => [a.id, a])), [animals]);

  // Suma lo que quedó en la cola del celular (por si se recargó la página sin señal).
  useEffect(() => {
    pending(slug)
      .then((ops) => {
        setDone((prev) => {
          const next = new Map(prev);
          for (const op of ops) {
            if (op.kind === "manga" && op.payload.sessionId === sessionId) next.set(String(op.payload.animalId), op.clientId);
            if (op.kind === "undo") {
              for (const [animalId, clientId] of next) if (clientId === op.clientId) next.delete(animalId);
            }
          }
          return next;
        });
      })
      .catch(() => {});
    input.current?.focus();
  }, [slug, sessionId]);

  async function register(value: string) {
    const text = value.trim();
    if (!text) return;
    setRead("");
    const matches = animals.filter((a) => tagMatches(text, a.tagVisual, a.tagRfid));
    if (!matches.length) return setLast({ kind: "missing", read: text });
    if (matches.length > 1) return setLast({ kind: "many", read: text, count: matches.length });
    const animal = matches[0];
    if (done.has(animal.id)) return setLast({ kind: "repeat", animal });
    const clientId = crypto.randomUUID();
    setDone((prev) => new Map(prev).set(animal.id, clientId));
    setLast({ kind: "ok", animal, clientId });
    navigator.vibrate?.(60);
    await enqueue({ slug, clientId, kind: "manga", payload: { sessionId, animalId: animal.id }, createdAt: Date.now() });
    flush(slug);
  }

  async function undo(animal: Animal, clientId: string) {
    setDone((prev) => {
      const next = new Map(prev);
      next.delete(animal.id);
      return next;
    });
    setLast(null);
    const queued = (await pending(slug)).some((o) => o.clientId === clientId && o.kind === "manga");
    if (queued) await removeFromQueue(clientId);
    else await enqueue({ slug, clientId, kind: "undo", payload: {}, createdAt: Date.now() });
    flush(slug);
    input.current?.focus();
  }

  const total = animals.length;
  const count = [...done.keys()].filter((id) => byId.has(id)).length;
  const missing = animals.filter((a) => !done.has(a.id));
  const writable = canWrite && !closed;

  return (
    <div className="flex flex-col gap-4">
      <SyncStatus slug={slug} />

      {last?.kind === "ok" ? (
        <div className="flex flex-col items-center gap-1.5 rounded-3xl border-2 border-ok-dot bg-ok-bg p-5 text-center" role="status">
          <span className="flex size-12 items-center justify-center rounded-full bg-ok-dot text-white" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5 9-10" />
            </svg>
          </span>
          <p className="mt-1 font-display text-[26px] font-bold tabular-nums">{last.animal.title}</p>
          <p className="text-[15px] font-semibold text-ok-fg">{last.animal.sub ? `${last.animal.sub} · ` : ""}registrado</p>
          <button type="button" onClick={() => undo(last.animal, last.clientId)} className="mt-1 h-10 rounded-xl border border-ok-dot/40 bg-surface px-4 text-sm font-semibold text-ok-fg">
            Deshacer
          </button>
        </div>
      ) : last?.kind === "repeat" ? (
        <Notice tone="warn">
          <strong className="tabular-nums">{last.animal.title}</strong> ya estaba registrado en esta jornada.
        </Notice>
      ) : last?.kind === "missing" ? (
        <Notice tone="bad">
          <strong className="tabular-nums">{last.read}</strong> no está en el padrón.{" "}
          <Link href={`${newAnimalHref}&caravana=${encodeURIComponent(last.read)}`} className="font-semibold underline">
            Darlo de alta
          </Link>
        </Notice>
      ) : last?.kind === "many" ? (
        <Notice tone="warn">
          {last.count} caravanas terminan en <strong>{last.read}</strong>. Escribí más números.
        </Notice>
      ) : null}

      {writable ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            register(read);
          }}
          className="flex flex-col gap-2 rounded-3xl border-2 border-dashed border-line-strong bg-field p-4"
        >
          <label htmlFor="lectura" className="text-center text-base font-semibold">
            Pasá el bastón por el siguiente
          </label>
          <div className="flex gap-2">
            <input
              ref={input}
              id="lectura"
              value={read}
              onChange={(e) => setRead(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="done"
              placeholder="o escribí los últimos números"
              className="h-13 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-4 text-center text-lg tabular-nums"
            />
            <Button type="submit" className="shrink-0">
              OK
            </Button>
          </div>
        </form>
      ) : closed ? (
        <Notice tone="info">Esta jornada está cerrada.</Notice>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-[15px] font-semibold">
          Van {count} de {total}
        </p>
        {missing.length ? (
          <button type="button" onClick={() => setShowMissing((v) => !v)} className="text-sm font-semibold text-brand">
            {showMissing ? "Ocultar los que faltan" : "Ver los que faltan"}
          </button>
        ) : null}
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full bg-brand transition-[width]" style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
      </div>

      {showMissing ? (
        <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
          {missing.slice(0, 200).map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 border-b border-chip px-4 py-2.5 last:border-b-0">
              <span className="flex flex-col">
                <span className="text-[15px] font-semibold tabular-nums">{a.title}</span>
                {a.sub ? <span className="text-[13px] text-muted">{a.sub}</span> : null}
              </span>
              {writable ? (
                <button type="button" onClick={() => register(a.tagVisual ?? a.tagRfid ?? "")} disabled={!a.tagVisual && !a.tagRfid} className="h-10 rounded-xl border border-line-strong px-3 text-sm font-semibold disabled:opacity-40">
                  Registrar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {writable ? (
        <form action={closeSession} className="pt-2">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="id" value={sessionId} />
          <Button type="submit" kind="secondary" className="w-full">
            Terminar jornada
          </Button>
          <p className="mt-2 text-center text-[13px] text-muted">Para terminar hace falta señal. Lo registrado ya queda guardado aunque no la termines.</p>
        </form>
      ) : null}
    </div>
  );
}
