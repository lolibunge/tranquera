"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, type MouseEvent } from "react";

/**
 * Recorrido dentro de la app, para que la flecha de volver lleve a la pantalla
 * de donde se vino (y no a una fija). Se guarda en sessionStorage, por pestaña.
 */
const KEY = "tq-recorrido";
const MAX = 40;

/** Pantallas de paso (formularios): al volver se saltean. */
function isTransient(url: string) {
  const [path, query = ""] = url.split("?");
  return (
    /\/(nuevo|nueva|editar|varios|activar|entrar)$/.test(path) ||
    /\/sanidad\/manga$/.test(path) ||
    /\/mover$/.test(path) ||
    /\/potreros\/mapa(\/nombrar)?$/.test(path) ||
    /(^|&)elegir=1/.test(query)
  );
}

function read(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function write(stack: string[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(stack.slice(-MAX)));
  } catch {
    /* sin almacenamiento: la flecha usa su destino fijo */
  }
}
const pathOf = (url: string) => url.split("?")[0];

function Tracker() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    const url = search ? `${pathname}?${search}` : pathname;
    const stack = read();
    const top = stack[stack.length - 1];
    if (top === url) return;
    // Volver a una pantalla anterior del recorrido: se recorta hasta ahí.
    const at = stack.lastIndexOf(url);
    if (at !== -1) write(stack.slice(0, at + 1));
    else if (top && pathOf(top) === pathOf(url)) write([...stack.slice(0, -1), url]); // misma pantalla, otros filtros
    else write([...stack, url]);
  }, [pathname, search]);
  return null;
}

export function NavHistory() {
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}

/** La pantalla anterior real (salteando formularios), o null si no hay. */
function previous(current: string) {
  const stack = read();
  let i = stack.length - 1;
  while (i >= 0 && pathOf(stack[i]) === pathOf(current)) i--;
  while (i >= 0 && (isTransient(stack[i]) || pathOf(stack[i]) === pathOf(current))) i--;
  return i >= 0 ? stack[i] : null;
}

export function BackLink({ href, label = "Volver" }: { href: string; label?: string }) {
  const router = useRouter();
  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const prev = previous(window.location.pathname + window.location.search);
    if (prev) {
      e.preventDefault();
      router.push(prev);
    }
  }
  return (
    <Link href={href} onClick={onClick} aria-label={label} className="flex size-11 items-center justify-center rounded-xl border border-line bg-surface text-ink">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </Link>
  );
}
