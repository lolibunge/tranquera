/*
  Service worker de Tranquera (etapa 0).
  - Guarda la "cáscara" de la app (estilos, scripts) para que abra rápido.
  - Si no hay señal y la página no está guardada, muestra /sin-senal.
  La carga de datos sin conexión (cola que se sincroniza sola) llega en la etapa 1.
*/
const VERSION = "tq-v1";
const OFFLINE_URL = "/sin-senal";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll([OFFLINE_URL, "/icon.svg"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Archivos estáticos con hash: primero la copia guardada.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.endsWith(".svg")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  // Páginas: siempre la red (datos al día); sin señal, la pantalla de aviso.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});
