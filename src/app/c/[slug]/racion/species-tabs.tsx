import Link from "next/link";
import { CATALOG, isSpeciesKey } from "@/lib/catalogo";

/** Pestañas por especie (solo si hay más de una). */
export function SpeciesTabs({ href, species, current }: { href: (key: string) => string; species: string[]; current: string }) {
  if (species.length < 2) return null;
  return (
    <div role="tablist" aria-label="Especie" className="flex gap-2 overflow-x-auto pb-1">
      {species.map((k) => (
        <Link
          key={k}
          role="tab"
          aria-selected={k === current}
          href={href(k)}
          className={`shrink-0 rounded-full px-4 py-2 text-[15px] font-semibold ${k === current ? "bg-brand text-white" : "bg-chip"}`}
        >
          {isSpeciesKey(k) ? CATALOG[k].plural : k}
        </Link>
      ))}
    </div>
  );
}
