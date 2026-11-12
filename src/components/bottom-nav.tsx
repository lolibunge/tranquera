"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Item = { href: string; label: string; icon: ReactNode; match: (path: string) => boolean };

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/**
 * Barra de abajo. Animales y Sanidad aparecen cuando el campo tiene alguna especie prendida;
 * Potreros se suma en la etapa 2.
 */
export function BottomNav({ slug, hasAnimals }: { slug: string; hasAnimals: boolean }) {
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
    ...(hasAnimals
      ? [
          {
            href: `${base}/animales`,
            label: "Animales",
            match: (p: string) => p.startsWith(`${base}/animales`),
            icon: (
              <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
                <path d="M4 6h16M4 12h16M4 18h10" />
              </svg>
            ),
          },
          {
            href: `${base}/sanidad`,
            label: "Sanidad",
            match: (p: string) => p.startsWith(`${base}/sanidad`),
            icon: (
              <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
                <path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z" />
              </svg>
            ),
          },
        ]
      : []),
    {
      href: `${base}/mas`,
      label: "Más",
      match: (p) => p.startsWith(`${base}/mas`) || ["configuracion", "marca", "usuarios", "especies"].some((s) => p.startsWith(`${base}/${s}`)),
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
