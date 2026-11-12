import Link from "next/link";
import { createElement } from "react";
import type { FarmMap } from "@/lib/svg-map";
import { centerOf } from "@/lib/svg-geometry";
import type { PaddockSummary } from "@/lib/paddocks";

/**
 * Mapa del campo armado solo con la geometría guardada (nunca el SVG original).
 * Cada potrero se pinta según su estado y lleva a su ficha.
 */
export function FarmMapView({ map, paddocks, slug }: { map: FarmMap; paddocks: PaddockSummary[]; slug: string }) {
  const byName = new Map(paddocks.map((p) => [p.svgId?.toLowerCase() ?? p.name.toLowerCase(), p]));
  const vb = map.viewBox.split(/[\s,]+/).map(Number);
  const fontSize = Math.max(vb[2], vb[3]) / 32;
  const labeled = new Set<string>();
  return (
    <figure className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface p-2">
        <svg viewBox={map.viewBox} role="img" aria-label="Mapa de potreros" className="h-auto max-h-[60vh] w-full">
          {map.shapes.map((shape, i) => {
            const p = shape.name && !shape.background ? byName.get(shape.name.toLowerCase()) : undefined;
            const fill = !p ? "var(--chip)" : p.heads > 0 ? "var(--brand)" : p.restDays !== null ? "#2e7d3e" : "#d6ccbf";
            const opacity = !p ? 0.5 : p.heads > 0 ? 0.6 : p.restDays !== null ? 0.28 : 0.5;
            const el = createElement(shape.tag, {
              ...shape.attrs,
              transform: shape.transform || undefined,
              fill,
              fillOpacity: opacity,
              stroke: "#6b5d52",
              strokeWidth: 1,
              vectorEffect: "non-scaling-stroke",
            });
            if (!p) return <g key={i}>{el}</g>;
            const status = p.heads > 0 ? `${p.heads} cabezas` : p.restDays !== null ? `descansa hace ${p.restDays} días` : "vacío";
            // Un nombre por potrero (aunque tenga varias formas).
            const point = labeled.has(p.id) ? null : centerOf(shape);
            if (point) labeled.add(p.id);
            return (
              <Link key={i} href={`/c/${slug}/potreros/${p.id}`} aria-label={`${p.name}: ${status}`}>
                <title>{`${p.name} · ${status}`}</title>
                {el}
                {point ? (
                  <g transform={shape.transform || undefined} pointerEvents="none">
                    <text x={point[0]} y={point[1]} textAnchor="middle" fontSize={fontSize} fontWeight={600} fill="#231a14" stroke="#fffdf9" strokeWidth={fontSize / 5} paintOrder="stroke">
                      {p.name}
                    </text>
                    {p.heads > 0 ? (
                      <text x={point[0]} y={point[1] + fontSize * 1.2} textAnchor="middle" fontSize={fontSize * 0.85} fill="#231a14" stroke="#fffdf9" strokeWidth={fontSize / 5} paintOrder="stroke">
                        {p.heads} cab.
                      </text>
                    ) : null}
                  </g>
                ) : null}
              </Link>
            );
          })}
        </svg>
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-brand/60" aria-hidden="true" /> Con animales
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-ok-dot/30" aria-hidden="true" /> En descanso
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-line-strong/60" aria-hidden="true" /> Sin datos
        </span>
      </figcaption>
    </figure>
  );
}
