"use client";

import { useActionState, useState } from "react";
import { Button, Card, Field, Notice, SelectField } from "@/components/ui";
import { ROLE_HELP, type Role } from "@/lib/roles";
import { changeRole, inviteMember, removeMember, revokeInvitation, type ActionState } from "../actions";

type RoleOption = { value: Role; label: string };

export function InviteForm({ slug, roles }: { slug: string; roles: RoleOption[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(inviteMember, {});
  const [role, setRole] = useState<Role>("operario");
  const [copied, setCopied] = useState(false);

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <form action={action} className="flex flex-col gap-4" key={state.at}>
      <input type="hidden" name="slug" value={slug} />
      <Field id="invite-email" name="email" type="email" inputMode="email" autoComplete="off" label="Mail" required />
      <div className="flex flex-col gap-1.5">
        <SelectField id="invite-role" name="role" label="Rol" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {roles.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </SelectField>
        <p className="text-[13px] text-muted">{ROLE_HELP[role]}</p>
      </div>
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      {state.link ? (
        <div className="flex flex-col gap-2">
          <input readOnly value={state.link} aria-label="Enlace de invitación" className="h-11 rounded-xl border border-line bg-field px-3 text-sm text-ink-2" onFocus={(e) => e.currentTarget.select()} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => copy(state.link!)} className="h-11 rounded-xl border border-line-strong bg-surface px-4 text-[15px] font-semibold">
              {copied ? "Copiado" : "Copiar enlace"}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Te invito a nuestro campo en Tranquera: ${state.link}`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center rounded-xl border border-line-strong bg-surface px-4 text-[15px] font-semibold"
            >
              Mandar por WhatsApp
            </a>
          </div>
        </div>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Invitando…" : "Invitar"}
      </Button>
    </form>
  );
}

type Member = { id: string; name: string; email: string; role: Role; roleLabel: string };

export function MemberRow({
  slug,
  member,
  isMe,
  editable,
  roles,
}: {
  slug: string;
  member: Member;
  isMe: boolean;
  editable: boolean;
  roles: RoleOption[];
}) {
  const [open, setOpen] = useState(false);
  const [roleState, roleAction, rolePending] = useActionState<ActionState, FormData>(changeRole, {});
  const [removeState, removeAction, removePending] = useActionState<ActionState, FormData>(removeMember, {});
  const error = roleState.error ?? removeState.error;

  return (
    <li>
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] font-semibold">
              {member.name}
              {isMe ? <span className="font-normal text-muted"> (vos)</span> : null}
            </span>
            <span className="truncate text-[13px] text-muted">
              {member.roleLabel} · {member.email}
            </span>
          </div>
          {editable ? (
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="h-11 shrink-0 rounded-xl px-3 text-[15px] font-semibold text-brand hover:bg-brand-soft">
              {open ? "Cerrar" : "Cambiar"}
            </button>
          ) : null}
        </div>
        {editable && open ? (
          <div className="flex flex-col gap-3 border-t border-chip pt-3">
            <form action={roleAction} className="flex items-end gap-2">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="userId" value={member.id} />
              <div className="flex-1">
                <SelectField id={`role-${member.id}`} name="role" label="Rol" defaultValue={member.role}>
                  {roles.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </SelectField>
              </div>
              <Button type="submit" kind="secondary" disabled={rolePending}>
                Guardar
              </Button>
            </form>
            <form
              action={removeAction}
              onSubmit={(e) => {
                if (!confirm(`¿Sacar a ${member.name} del campo?`)) e.preventDefault();
              }}
            >
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="userId" value={member.id} />
              <Button type="submit" kind="danger" disabled={removePending} className="w-full">
                Sacar del campo
              </Button>
            </form>
          </div>
        ) : null}
        {error ? <Notice tone="bad">{error}</Notice> : null}
        {roleState.ok && !error ? <Notice tone="ok">{roleState.ok}</Notice> : null}
      </Card>
    </li>
  );
}

export function RevokeInvitation({ slug, invitationId }: { slug: string; invitationId: string }) {
  const [, action, pending] = useActionState<ActionState, FormData>(revokeInvitation, {});
  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="invitationId" value={invitationId} />
      <button type="submit" disabled={pending} className="h-11 shrink-0 rounded-xl px-3 text-[15px] font-semibold text-bad-fg hover:bg-bad-bg">
        Cancelar
      </button>
    </form>
  );
}
