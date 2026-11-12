import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Piezas base del estilo: botones de 52 px (se tocan con guantes), campos claros, avisos con texto. */

type ButtonKind = "primary" | "secondary" | "danger" | "ghost";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed";
const BUTTON_KIND: Record<ButtonKind, string> = {
  primary: "h-13 bg-brand text-white hover:bg-brand-strong",
  secondary: "h-13 border border-line-strong bg-surface text-ink hover:bg-chip",
  danger: "h-13 border border-bad-dot/40 bg-surface text-bad-fg hover:bg-bad-bg",
  ghost: "h-11 px-3 text-brand hover:bg-brand-soft",
};

export function Button({ kind = "primary", className = "", ...props }: ComponentProps<"button"> & { kind?: ButtonKind }) {
  return <button className={`${BUTTON_BASE} ${BUTTON_KIND[kind]} ${className}`} {...props} />;
}

export function ButtonLink({
  kind = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { kind?: ButtonKind }) {
  return <Link className={`${BUTTON_BASE} ${BUTTON_KIND[kind]} ${className}`} {...props} />;
}

export function Field({
  label,
  hint,
  id,
  className = "",
  ...props
}: ComponentProps<"input"> & { label: string; hint?: string; id: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        className="h-13 rounded-xl border border-line-strong bg-field px-4 text-base text-ink placeholder:text-muted/80 focus:border-brand"
        {...props}
      />
      {hint ? <p className="text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function SelectField({
  label,
  id,
  children,
  ...props
}: ComponentProps<"select"> & { label: string; id: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <select
        id={id}
        className="h-13 w-full min-w-0 rounded-xl border border-line-strong bg-field px-3 text-base text-ink focus:border-brand"
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-2xl border border-line bg-surface p-4 ${className}`} {...props} />;
}

type Tone = "ok" | "warn" | "bad" | "info";
const TONE: Record<Tone, string> = {
  ok: "bg-ok-bg text-ok-fg",
  warn: "bg-warn-bg text-warn-fg",
  bad: "bg-bad-bg text-bad-fg",
  info: "bg-info-bg text-info-fg",
};
const DOT: Record<Tone, string> = {
  ok: "bg-ok-dot",
  warn: "bg-warn-dot",
  bad: "bg-bad-dot",
  info: "bg-info-fg",
};

/** Estado con punto y texto: nunca solo color. */
export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[tone]}`}>
      <span className={`size-1.5 rounded-full ${DOT[tone]}`} aria-hidden="true" />
      {children}
    </span>
  );
}

export function Notice({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${TONE[tone]}`}>
      {children}
    </div>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="font-display text-[26px] leading-tight font-bold">{children}</h1>
      {sub ? <p className="text-[15px] leading-snug text-ink-2">{sub}</p> : null}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-lg font-bold">{children}</h2>;
}

export { BackLink } from "./nav-history";

export function FarmMark({ name, logo, size = 40 }: { name: string; logo?: string | null; size?: number }) {
  const initials =
    name
      .split(/\s+/)
      .filter((w) => w.length > 2 || /^[A-ZÁÉÍÓÚ]/.test(w))
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || name.slice(0, 2).toUpperCase();
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" width={size} height={size} className="rounded-xl bg-surface object-contain" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden="true"
      className="flex items-center justify-center rounded-xl bg-brand font-display font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </span>
  );
}
