import type { Metadata } from "next";
import Link from "next/link";
import { redirectIfSignedIn, safeNext } from "@/lib/auth";
import { SignUpForm } from "./form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function SignUpPage({ searchParams }: PageProps<"/registro">) {
  const params = await searchParams;
  const next = safeNext(params.volver);
  await redirectIfSignedIn(next);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] font-bold leading-tight">Crear cuenta</h1>
        <p className="text-[15px] text-ink-2">Con tu cuenta podés crear tu campo o entrar a los campos donde te inviten.</p>
      </div>
      <SignUpForm next={next} />
      <p className="text-[15px] text-ink-2">
        ¿Ya tenés cuenta?{" "}
        <Link href="/entrar" className="font-semibold text-brand underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
