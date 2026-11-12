"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Registra el service worker (app instalable y uso sin señal). */
export function ServiceWorker() {
  const path = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Si no se puede registrar, la app sigue funcionando con conexión.
    });
  }, []);

  // En la pantalla de entrar no queda ninguna sesión: se borran las pantallas guardadas.
  useEffect(() => {
    if (!path.startsWith("/entrar") || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: "clear-pages" })).catch(() => {});
  }, [path]);

  return null;
}
