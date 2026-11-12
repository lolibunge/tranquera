import type { Metadata } from "next";
import { TranqueraMark } from "@/components/brand";

export const metadata: Metadata = { title: "Sin señal" };

/** Se guarda en el teléfono y se muestra cuando no hay conexión. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-5 py-10">
      <TranqueraMark />
      <h1 className="font-display text-[26px] font-bold leading-tight">Sin señal</h1>
      <p className="text-[15px] leading-relaxed text-ink-2">
        No hay conexión en este momento. Cuando vuelva la señal, recargá la página y seguís donde estabas.
      </p>
    </main>
  );
}
