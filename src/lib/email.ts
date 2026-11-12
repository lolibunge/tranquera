import "server-only";
import { headers } from "next/headers";
import { Resend } from "resend";

/**
 * Dirección pública de la app, para armar los enlaces de los mails.
 * APP_URL manda; si no está, se usa el dominio con el que se abrió la app.
 */
export async function appUrl() {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}

export function emailEnabled() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

type Mail = { to: string; subject: string; text: string; html: string };

/**
 * Manda un mail con Resend. Sin RESEND_API_KEY (desarrollo) lo deja en la consola
 * del servidor y devuelve false, así la pantalla puede avisar.
 */
export async function sendMail(mail: Mail) {
  if (!emailEnabled()) {
    console.info(`[mail sin enviar] Para: ${mail.to} · ${mail.subject}\n${mail.text}`);
    return false;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  if (error) {
    console.error("[mail] Resend falló:", error);
    return false;
  }
  return true;
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function buttonMail(intro: string, label: string, url: string, outro: string) {
  return `<div style="font-family:Inter,Arial,sans-serif;color:#231a14;max-width:480px">
<p style="font-size:16px;line-height:1.5">${escapeHtml(intro)}</p>
<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#7a4a2a;color:#fff;text-decoration:none;font-weight:600;padding:14px 22px;border-radius:12px">${escapeHtml(label)}</a></p>
<p style="font-size:13px;color:#6b5d52">${escapeHtml(outro)}</p>
<p style="font-size:13px;color:#6b5d52">Tranquera · gestión de campo</p>
</div>`;
}
