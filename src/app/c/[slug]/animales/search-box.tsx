"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Búsqueda por caravana o nombre. Funciona también con el bastón lector
 * (escribe la lectura y manda Enter) y busca sola al dejar de escribir.
 */
export function SearchBox({
  defaultValue,
  species,
  category,
  showInactive,
}: {
  defaultValue: string;
  species: string;
  category: string | null;
  showInactive: boolean;
}) {
  const router = useRouter();
  const path = usePathname();
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => go(value), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function go(q: string) {
    const params = new URLSearchParams({ e: species });
    if (category) params.set("cat", category);
    if (showInactive) params.set("ver", "bajas");
    if (q.trim()) params.set("q", q.trim());
    router.replace(`${path}?${params.toString()}`, { scroll: false });
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
      }}
      className="flex gap-2"
    >
      <label htmlFor="buscar" className="sr-only">
        Buscar por caravana o nombre
      </label>
      <input
        ref={inputRef}
        id="buscar"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Caravana o nombre"
        autoComplete="off"
        className="h-12 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3.5 text-base"
      />
      <button
        type="button"
        onClick={() => {
          setValue("");
          inputRef.current?.focus();
        }}
        aria-label="Leer caravana con el bastón"
        title="Tocá y pasá el bastón por la caravana"
        className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-line-strong bg-surface text-ink"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" />
        </svg>
      </button>
    </form>
  );
}
