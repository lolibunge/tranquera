"use client";

/**
 * Cola local del celular (IndexedDB). Lo que se carga en el campo se guarda acá
 * primero y se envía a /api/sync cuando hay señal. Sobrevive a cerrar la app.
 */

export type QueuedOp = { slug: string; clientId: string; kind: string; payload: Record<string, unknown>; createdAt: number; error?: string };

const DB_NAME = "tranquera";
const STORE = "cola";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "clientId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(op: QueuedOp) {
  await tx("readwrite", (s) => s.put(op));
  notify();
}

export async function removeFromQueue(clientId: string) {
  await tx("readwrite", (s) => s.delete(clientId));
  notify();
}

export async function pending(slug?: string): Promise<QueuedOp[]> {
  const all = (await tx<QueuedOp[]>("readonly", (s) => s.getAll())) ?? [];
  return all.filter((o) => !slug || o.slug === slug).sort((a, b) => a.createdAt - b.createdAt);
}

export async function clearQueue() {
  await tx("readwrite", (s) => s.clear());
  notify();
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
export function onQueueChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let flushing: Promise<void> | null = null;
let again = false;

/**
 * Envía lo pendiente de un campo. Si se llama mientras ya está enviando, vuelve
 * a pasar al terminar, así no queda nada esperando el próximo intento.
 * Lo que el servidor rechaza queda marcado con el error.
 */
export function flush(slug: string): Promise<void> {
  if (flushing) {
    again = true;
    return flushing;
  }
  // Promise.resolve().then: el trabajo arranca después de guardar `flushing`;
  // si no, una salida inmediata lo limpiaría antes de asignarlo y quedaría trabado.
  flushing = Promise.resolve().then(async () => {
    try {
      do {
        again = false;
        if (typeof navigator !== "undefined" && !navigator.onLine) return;
        const ops = (await pending(slug)).filter((o) => !o.error);
        if (!ops.length) return;
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug, ops: ops.map((o) => ({ kind: o.kind, clientId: o.clientId, ...o.payload })) }),
        });
        if (!res.ok) return; // sin sesión o error: se reintenta después
        const { results } = (await res.json()) as { results: { clientId: string; ok: boolean; error?: string; retry?: boolean }[] };
        for (const r of results) {
          if (r.ok) await removeFromQueue(r.clientId);
          else if (!r.retry) {
            const op = ops.find((o) => o.clientId === r.clientId);
            if (op) await tx("readwrite", (s) => s.put({ ...op, error: r.error ?? "No se pudo guardar." }));
          }
        }
        notify();
      } while (again);
    } catch {
      // Sin red o servidor caído: queda en la cola.
    } finally {
      flushing = null;
    }
  });
  return flushing;
}
