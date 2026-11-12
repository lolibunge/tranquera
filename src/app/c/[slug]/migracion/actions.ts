"use server";

import { revalidatePath } from "next/cache";
import { getFarmAccess } from "@/lib/farms";
import { can } from "@/lib/roles";
import { probeSource, readSource, runImport, sourceEnvName, planFor, type ImportReport } from "@/lib/importer/campo-admin";

export type ProbeState = { error?: string; probe?: { readOnly: boolean; roleCanWrite: boolean; counts: { table: string; label: string; target: string | null; rows: number }[] } };
export type ImportState = { error?: string; report?: ImportReport; at?: number };

async function guard(slug: string) {
  const access = await getFarmAccess(slug);
  if (!can(access.role, "dueños")) return { error: "Solo un dueño puede migrar datos." } as const;
  const url = process.env[sourceEnvName(access.farm.slug)];
  if (!url) return { error: `Falta la variable ${sourceEnvName(access.farm.slug)} en Vercel.` } as const;
  return { access, url } as const;
}

function describe(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (/password|authentication/i.test(msg)) return "No se pudo entrar a la base de origen: revisá el usuario y la clave de la variable.";
  if (/ENOTFOUND|getaddrinfo|ECONNREFUSED|timeout/i.test(msg)) return "No se pudo conectar con la base de origen. Revisá la dirección de la variable.";
  return `Error al leer o importar: ${msg.slice(0, 200)}`;
}

export async function probeAction(_prev: ProbeState, f: FormData): Promise<ProbeState> {
  const g = await guard(String(f.get("slug") ?? ""));
  if ("error" in g) return { error: g.error };
  try {
    const p = await probeSource(g.url);
    return { probe: { ...p, counts: p.counts.map((c) => ({ ...c, ...planFor(c.table) })) } };
  } catch (e) {
    return { error: describe(e) };
  }
}

export async function importAction(_prev: ImportState, f: FormData): Promise<ImportState> {
  const g = await guard(String(f.get("slug") ?? ""));
  if ("error" in g) return { error: g.error };
  const dryRun = f.get("mode") !== "importar";
  if (!dryRun && f.get("confirm") !== "on") return { error: "Marcá que revisaste el ensayo antes de importar." };
  const cur = (k: string) => (f.get(k) === "USD" ? "USD" : "UYU");
  try {
    const data = await readSource(g.url);
    const report = await runImport(
      g.access.farm.id,
      g.access.user.id,
      data,
      { expensesCurrency: cur("expensesCurrency"), ownersCurrency: cur("ownersCurrency"), healthCurrency: cur("healthCurrency") },
      dryRun,
    );
    if (!dryRun) revalidatePath(`/c/${g.access.farm.slug}`, "layout");
    return { report, at: Date.now() };
  } catch (e) {
    return { error: describe(e) };
  }
}
