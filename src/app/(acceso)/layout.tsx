import { TranqueraMark } from "@/components/brand";

/** Pantallas de entrada: centradas, sin barra de navegación. */
export default function AccessLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-5 py-10">
      <div className="flex items-center gap-3">
        <TranqueraMark />
        <div>
          <p className="font-display text-xl font-bold leading-none">Tranquera</p>
          <p className="text-sm text-muted">gestión de campo</p>
        </div>
      </div>
      {children}
    </main>
  );
}
