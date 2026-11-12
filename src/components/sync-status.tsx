"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { flush, onQueueChange, pending, type QueuedOp } from "@/lib/offline-queue";
import { Notice } from "./ui";

/** Aviso de lo que quedó guardado en el celular sin subir; intenta subirlo solo. */
export function SyncStatus({ slug }: { slug: string }) {
  const [ops, setOps] = useState<QueuedOp[]>([]);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

  useEffect(() => {
    let alive = true;
    const refresh = () => pending(slug).then((list) => alive && setOps(list)).catch(() => {});
    const tryFlush = () => flush(slug).then(refresh);
    refresh();
    tryFlush();
    const off = onQueueChange(refresh);
    window.addEventListener("online", tryFlush);
    const timer = setInterval(tryFlush, 30_000);
    return () => {
      alive = false;
      off();
      window.removeEventListener("online", tryFlush);
      clearInterval(timer);
    };
  }, [slug]);

  const failed = ops.filter((o) => o.error);
  const waiting = ops.length - failed.length;
  if (!ops.length && online) return null;
  return (
    <div className="flex flex-col gap-2">
      {!online || waiting ? (
        <Notice tone="info">
          {!online ? "Sin señal. " : ""}
          {waiting
            ? `${waiting} ${waiting === 1 ? "registro guardado" : "registros guardados"} en el celular: se suben solos cuando vuelva la conexión.`
            : "Lo que cargues queda guardado en el celular."}
        </Notice>
      ) : null}
      {failed.length ? (
        <Notice tone="bad">
          {failed.length} {failed.length === 1 ? "registro no se pudo guardar" : "registros no se pudieron guardar"}: {failed[0].error}
        </Notice>
      ) : null}
    </div>
  );
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}
