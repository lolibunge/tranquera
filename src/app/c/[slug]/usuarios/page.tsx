import type { Metadata } from "next";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { getFarmAccess } from "@/lib/farms";
import { can, ROLE_LABEL, ROLES } from "@/lib/roles";
import { BackLink, Card, PageTitle, SectionTitle, StatusPill } from "@/components/ui";
import { InviteForm, MemberRow, RevokeInvitation } from "./forms";

export const metadata: Metadata = { title: "Equipo" };

const DAY = new Intl.DateTimeFormat("es-UY", { day: "numeric", month: "long", timeZone: "America/Montevideo" });

export default async function TeamPage({ params }: PageProps<"/c/[slug]/usuarios">) {
  const { slug } = await params;
  const { farm, role, user } = await getFarmAccess(slug);
  const manage = can(role, "usuarios");
  const manageOwners = can(role, "dueños");

  const members = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.memberships.role })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(eq(schema.memberships.farmId, farm.id))
    .orderBy(asc(schema.users.name));

  const pending = manage
    ? await db
        .select({ id: schema.invitations.id, email: schema.invitations.email, role: schema.invitations.role, expiresAt: schema.invitations.expiresAt })
        .from(schema.invitations)
        .where(and(eq(schema.invitations.farmId, farm.id), isNull(schema.invitations.acceptedAt), gt(schema.invitations.expiresAt, new Date())))
        .orderBy(asc(schema.invitations.email))
    : [];

  const assignable = ROLES.filter((r) => r !== "dueno" || manageOwners).map((r) => ({ value: r, label: ROLE_LABEL[r] }));

  return (
    <div className="flex flex-col gap-6">
      <BackLink href={`/c/${slug}/mas`} />
      <PageTitle sub={manage ? "Invitá a quienes trabajan en el campo y elegí qué puede hacer cada uno." : undefined}>Equipo</PageTitle>

      {manage ? (
        <Card className="flex flex-col gap-4">
          <SectionTitle>Invitar</SectionTitle>
          <InviteForm slug={slug} roles={assignable} />
        </Card>
      ) : null}

      <section className="flex flex-col gap-3">
        <SectionTitle>En el campo</SectionTitle>
        <ul className="flex flex-col gap-2.5">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              slug={slug}
              member={{ ...m, roleLabel: ROLE_LABEL[m.role] }}
              isMe={m.id === user.id}
              editable={manage && m.id !== user.id && (m.role !== "dueno" || manageOwners)}
              roles={assignable}
            />
          ))}
        </ul>
      </section>

      {pending.length ? (
        <section className="flex flex-col gap-3">
          <SectionTitle>Invitaciones pendientes</SectionTitle>
          <ul className="flex flex-col gap-2.5">
            {pending.map((inv) => (
              <li key={inv.id}>
                <Card className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-[15px] font-semibold">{inv.email}</span>
                    <span className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
                      {ROLE_LABEL[inv.role]}
                      <StatusPill tone="warn">Vence el {DAY.format(inv.expiresAt)}</StatusPill>
                    </span>
                  </div>
                  <RevokeInvitation slug={slug} invitationId={inv.id} />
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
