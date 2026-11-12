import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { findOpenInvitation } from "@/lib/invitations";
import { ROLE_HELP, ROLE_LABEL } from "@/lib/roles";
import { ButtonLink, Notice } from "@/components/ui";
import { signOut } from "../../actions";
import { AcceptForm } from "./form";

export const metadata: Metadata = { title: "Invitación" };

export default async function InvitationPage({ params }: PageProps<"/invitacion/[token]">) {
  const { token } = await params;
  const invitation = await findOpenInvitation(token);
  if (!invitation) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-display text-[26px] font-bold leading-tight">Invitación</h1>
        <Notice tone="warn">La invitación ya se usó, se canceló o venció. Pedile a quien te invitó que te mande una nueva.</Notice>
        <ButtonLink href="/entrar" kind="secondary">Ir a entrar</ButtonLink>
      </div>
    );
  }

  const user = await getCurrentUser();
  const [existing] = user
    ? []
    : await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, invitation.email)).limit(1);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] font-bold leading-tight">Te invitaron a {invitation.farmName}</h1>
        <p className="text-[15px] text-ink-2">
          Como <strong>{ROLE_LABEL[invitation.role]}</strong>: {ROLE_HELP[invitation.role].toLowerCase()}
        </p>
      </div>

      {user && user.email !== invitation.email ? (
        <>
          <Notice tone="warn">
            Esta invitación es para {invitation.email} y entraste como {user.email}.
          </Notice>
          <form action={signOut}>
            <button type="submit" className="h-13 w-full rounded-xl border border-line-strong bg-surface text-base font-semibold">
              Salir y entrar con el otro mail
            </button>
          </form>
        </>
      ) : user ? (
        <AcceptForm token={token} mode="join" />
      ) : existing ? (
        <>
          <p className="text-[15px] text-ink-2">Ya tenés cuenta con {invitation.email}. Entrá y volvés a esta pantalla para aceptar.</p>
          <ButtonLink href={`/entrar?volver=${encodeURIComponent(`/invitacion/${token}`)}`}>Entrar</ButtonLink>
        </>
      ) : (
        <>
          <p className="text-[15px] text-ink-2">
            Creá tu cuenta con <strong>{invitation.email}</strong> para entrar.
          </p>
          <AcceptForm token={token} mode="create" />
          <p className="text-sm text-muted">
            ¿No es tu mail? <Link href="/entrar" className="font-semibold text-brand">Ir a entrar</Link>
          </p>
        </>
      )}
    </div>
  );
}
