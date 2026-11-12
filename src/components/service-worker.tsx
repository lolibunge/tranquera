"use client";

import { useEffect } from "react";

/** Registra el service worker: deja la app instalable y con pantalla sin señal. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Si no se puede registrar, la app sigue funcionando con conexión.
    });
  }, []);
  return null;
}
