"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type Box = { x: number; y: number; w: number; h: number };

/**
 * SVG con zoom y arrastre: rueda o pellizco para acercar, arrastrar para moverse,
 * botones + / − / ver todo. children recibe el zoom actual (para achicar textos).
 * Un arrastre no cuenta como toque: no abre el potrero que quedó abajo.
 */
export function PanZoomSvg({
  viewBox,
  label,
  className = "",
  children,
}: {
  viewBox: string;
  label: string;
  className?: string;
  children: (zoom: number) => ReactNode;
}) {
  // Si cambia el mapa, quien lo usa le pasa otra key y el zoom vuelve a empezar.
  const full = useMemo(() => parse(viewBox), [viewBox]);
  const [box, setBox] = useState<Box>(full);
  const svg = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(0);
  const pinch = useRef<{ dist: number; box: Box; cx: number; cy: number } | null>(null);

  const zoom = full.w / box.w;

  /** Pasa de píxeles de pantalla a coordenadas del mapa. */
  const toMap = useCallback(
    (clientX: number, clientY: number, b: Box = box) => {
      const r = svg.current!.getBoundingClientRect();
      // preserveAspectRatio "xMidYMid meet": se centra y se escala por el lado que limita.
      const scale = Math.min(r.width / b.w, r.height / b.h);
      const offX = (r.width - b.w * scale) / 2;
      const offY = (r.height - b.h * scale) / 2;
      return { x: b.x + (clientX - r.left - offX) / scale, y: b.y + (clientY - r.top - offY) / scale, scale };
    },
    [box],
  );

  const clamp = useCallback((b: Box): Box => {
    const f = full;
    const w = Math.min(f.w, Math.max(f.w / 12, b.w));
    const h = (w / b.w) * b.h;
    // Se puede mover hasta que el borde del campo llegue a la mitad de la pantalla.
    const x = Math.min(f.x + f.w - w / 2, Math.max(f.x - w / 2, b.x));
    const y = Math.min(f.y + f.h - h / 2, Math.max(f.y - h / 2, b.y));
    return { x, y, w, h };
  }, [full]);

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      setBox((b) => {
        const w = b.w / factor;
        const h = b.h / factor;
        return clamp({ x: cx - ((cx - b.x) * w) / b.w, y: cy - ((cy - b.y) * h) / b.h, w, h });
      });
    },
    [clamp],
  );

  // Rueda del mouse (se registra a mano para poder evitar que la página haga scroll).
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toMap(e.clientX, e.clientY);
      zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, p.x, p.y);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [toMap, zoomAt]);

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = 0;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const mid = toMap((a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), box, cx: mid.x, cy: mid.y };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, now);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const factor = Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.dist;
      const start = pinch.current.box;
      const w = start.w / factor;
      const h = start.h / factor;
      const { cx, cy } = pinch.current;
      setBox(clamp({ x: cx - ((cx - start.x) * w) / start.w, y: cy - ((cy - start.y) * h) / start.h, w, h }));
      moved.current += 10;
      return;
    }
    const dx = now.x - prev.x;
    const dy = now.y - prev.y;
    moved.current += Math.abs(dx) + Math.abs(dy);
    if (moved.current < 4) return;
    if (!svg.current?.hasPointerCapture(e.pointerId)) svg.current?.setPointerCapture(e.pointerId);
    const { scale } = toMap(0, 0);
    setBox((b) => clamp({ ...b, x: b.x - dx / scale, y: b.y - dy / scale }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const center = () => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });

  return (
    <div className="relative">
      <svg
        ref={svg}
        viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
        role="img"
        aria-label={label}
        className={`h-auto w-full touch-none select-none ${zoom > 1 ? "cursor-grab active:cursor-grabbing" : ""} ${className}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        // Si fue un arrastre, el click no abre nada.
        onClickCapture={(e) => {
          if (moved.current >= 4) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {children(zoom)}
      </svg>
      <div className="absolute top-2 right-2 flex flex-col overflow-hidden rounded-xl border border-line bg-surface/95 shadow-sm">
        <button type="button" aria-label="Acercar" onClick={() => zoomAt(1.5, center().x, center().y)} className="flex size-10 items-center justify-center text-xl font-semibold hover:bg-chip">
          +
        </button>
        <button type="button" aria-label="Alejar" onClick={() => zoomAt(1 / 1.5, center().x, center().y)} className="flex size-10 items-center justify-center border-t border-line text-xl font-semibold hover:bg-chip">
          −
        </button>
        <button type="button" aria-label="Ver todo el campo" onClick={() => setBox(full)} className="flex size-10 items-center justify-center border-t border-line hover:bg-chip" disabled={zoom <= 1.01}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function parse(viewBox: string): Box {
  const [x, y, w, h] = viewBox.split(/[\s,]+/).map(Number);
  return { x: x || 0, y: y || 0, w: w || 100, h: h || 100 };
}
