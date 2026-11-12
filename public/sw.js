/*
  Service worker de Tranquera.
  - Archivos estáticos (_next/static, íconos): primero la copia guardada.
  - Pantallas de un campo (/c/...): primero la red; si no hay señal, la última
    copia guardada. Así se puede abrir una jornada de manga sin señal.
  - Lo que se carga sin señal va a una cola en IndexedDB (ver offline-queue.ts).
*/
const STATIC = "tq-static-v2";
const PAGES = "tq-pages-v2";
const OFFLINE_URL = "/sin-senal";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((cache) => cache.addAll([OFFLINE_URL, "/icon.svg"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== STATIC && k !== PAGES).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  // Al salir de la cuenta se borran las pantallas guardadas (pueden tener datos del campo).
  if (event.data && event.data.type === "clear-pages") event.waitUntil(caches.delete(PAGES));
});

function networkFirst(request) {
  return fetch(request)
    .then((response) => {
      if (response.ok && response.type === "basic") {
        const copy = response.clone();
        caches.open(PAGES).then((cache) => cache.put(request, copy));
      }
      return response;
    })
    .catch(() =>
      caches.match(request, { ignoreVary: true }).then((hit) => {
        if (hit) return hit;
        if (request.mode === "navigate") return caches.match(OFFLINE_URL);
        return Response.error();
      }),
    );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.endsWith(".svg")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(STATIC).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  if (url.pathname.startsWith("/c/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});
