"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Item = { href: string; label: string; icon: ReactNode; match: (path: string) => boolean };

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/**
 * Barra de abajo. En la etapa 0 solo hay Inicio y Más; los módulos que elija
 * cada campo (Animales, Sanidad, Potreros) se suman acá en las próximas etapas.
 */
export function BottomNav({ slug }: { slug: string }) {
  const path = usePathname();
  const base = `/c/${slug}`;
  const items: Item[] = [
    {
      href: base,
      label: "Inicio",
      match: (p) => p === base,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
          <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
        </svg>
      ),
    },
    {
      href: `${base}/mas`,
      label: "Más",
      match: (p) => p !== base,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
        </svg>
      ),
    },
  ];
  return (
    <nav aria-label="Secciones" className="fixed inset-x-0 bottom-0 border-t border-line bg-surface pb-[max(env(safe-area-inset-bottom),12px)]">
      <ul className="mx-auto grid max-w-2xl" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = item.match(path);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 pt-2 pb-1 text-xs font-semibold ${active ? "text-brand" : "text-muted"}`}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
