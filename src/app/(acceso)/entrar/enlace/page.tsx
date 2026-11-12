import type { Metadata } from "next";
import { safeNext } from "@/lib/auth";
import { Button, Notice } from "@/components/ui";
import { enterWithLink } from "../../actions";

export const metadata: Metadata = { title: "Entrar con enlace" };

/** El enlace del mail abre esta página; recién al tocar el botón se usa el token. */
export default async function LinkPage({ searchParams }: PageProps<"/entrar/enlace">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  if (!token) {
    return <Notice tone="warn">Al enlace le falta información. Pedí uno nuevo desde la pantalla de entrar.</Notice>;
  }
  return (
    <form action={enterWithLink} className="flex flex-col gap-5">
      <h1 className="font-display text-[26px] font-bold leading-tight">Entrar a Tranquera</h1>
      <p className="text-[15px] text-ink-2">Tocá el botón para terminar de entrar en este dispositivo.</p>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="next" value={safeNext(params.volver)} />
      <Button type="submit">Entrar</Button>
    </form>
  );
}
