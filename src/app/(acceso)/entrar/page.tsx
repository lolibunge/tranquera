import type { Metadata } from "next";
import Link from "next/link";
import { redirectIfSignedIn, safeNext } from "@/lib/auth";
import { Notice } from "@/components/ui";
import { SignInForms } from "./forms";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage({ searchParams }: PageProps<"/entrar">) {
  const params = await searchParams;
  const next = safeNext(params.volver);
  await redirectIfSignedIn(next);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-[26px] font-bold leading-tight">Entrar</h1>
      {params.enlace === "vencido" ? (
        <Notice tone="warn">Ese enlace ya se usó o venció. Pedí otro o entrá con tu contraseña.</Notice>
      ) : null}
      <SignInForms next={next} />
      <p className="text-[15px] text-ink-2">
        ¿Primera vez?{" "}
        <Link href={`/registro${next !== "/campos" ? `?volver=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand underline-offset-4 hover:underline">
          Crear una cuenta
        </Link>
      </p>
    </div>
  );
}
