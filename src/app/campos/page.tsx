import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listMyFarms } from "@/lib/farms";
import { ROLE_LABEL } from "@/lib/roles";
import { ButtonLink, FarmMark, PageTitle } from "@/components/ui";
import { TranqueraMark } from "@/components/brand";
import { signOut } from "../(acceso)/actions";

export const metadata: Metadata = { title: "Mis campos" };

export default async function FarmsPage({ searchParams }: PageProps<"/campos">) {
  const user = await requireUser("/campos");
  const farms = await listMyFarms(user.id);
  const params = await searchParams;
  // Con un solo campo se entra directo, salvo que se pida la lista.
  if (farms.length === 1 && params.todos === undefined) redirect(`/c/${farms[0].slug}`);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-8">
      <div className="flex items-center justify-between">
        <TranqueraMark />
        <form action={signOut}>
          <button type="submit" className="h-11 rounded-xl px-3 text-[15px] font-semibold text-muted hover:bg-chip">
            Salir
          </button>
        </form>
      </div>
      <PageTitle sub={`Hola, ${user.name.split(" ")[0]}.`}>{farms.length ? "Elegí un campo" : "Tu primer campo"}</PageTitle>

      {farms.length ? (
        <ul className="flex flex-col gap-2.5">
          {farms.map((farm) => (
            <li key={farm.id}>
              <Link
                href={`/c/${farm.slug}`}
                className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 hover:border-line-strong"
                style={{ ["--brand" as string]: farm.colorPrimary }}
              >
                <FarmMark name={farm.name} logo={farm.logo} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-base font-semibold">{farm.name}</span>
                  <span className="text-[13px] text-muted">{ROLE_LABEL[farm.role]}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[15px] leading-relaxed text-ink-2">
          Creá tu campo para empezar. Si alguien te invitó a su campo, abrí el enlace que te llegó por mail.
        </p>
      )}

      <ButtonLink href="/campos/nuevo" kind={farms.length ? "secondary" : "primary"}>
        Crear un campo
      </ButtonLink>
    </main>
  );
}
