import type { Metadata } from "next";
import Link from "next/link";
import { ActivateForm } from "./form";

export const metadata: Metadata = { title: "Activar cuenta" };

export default async function ActivatePage({ searchParams }: PageProps<"/activar">) {
  const sp = await searchParams;
  const phone = typeof sp.cel === "string" ? sp.cel.slice(0, 20) : "";
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] font-bold leading-tight">Activar cuenta</h1>
        <p className="text-[15px] text-ink-2">
          Poné tu celular y el código que te dieron. Elegís tu contraseña y entrás. Sirve también si te olvidaste la contraseña.
        </p>
      </div>
      <ActivateForm phone={phone} />
      <p className="text-[15px] text-ink-2">
        ¿Ya activaste?{" "}
        <Link href="/entrar" className="font-semibold text-brand underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
