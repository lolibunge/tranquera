import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getFarmAccess } from "@/lib/farms";
import { can } from "@/lib/roles";
import { SOURCE, sourceEnvName } from "@/lib/importer/campo-admin";
import { BackLink, Card, PageTitle, SectionTitle } from "@/components/ui";
import { ImportForm, ProbeForm } from "./forms";

export const metadata: Metadata = { title: "Traer datos de campo-admin" };
export const maxDuration = 300;

export default async function MigrationPage({ params }: PageProps<"/c/[slug]/migracion">) {
  const { slug } = await params;
  const { farm, role } = await getFarmAccess(slug);
  if (!can(role, "dueños")) notFound();
  const envName = sourceEnvName(farm.slug);
  const configured = Boolean(process.env[envName]);
  const [prior] = await db
    .select({ n: sql<number>`count(*)::int`, last: sql<string | null>`max(${schema.importArchive.importedAt})::text` })
    .from(schema.importArchive)
    .where(and(eq(schema.importArchive.farmId, farm.id), eq(schema.importArchive.source, SOURCE)));

  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/c/${slug}/mas`} label="Volver" />
      <PageTitle sub="Copia los datos del sistema anterior a este campo. La base vieja solo se lee: no se cambia ni se borra nada.">Traer datos de campo-admin</PageTitle>

      {prior.n ? (
        <Card className="text-sm text-ink-2">
          Ya hay {prior.n.toLocaleString("es-UY")} registros importados
          {prior.last ? ` (última vez: ${new Date(prior.last).toLocaleString("es-UY", { timeZone: "America/Montevideo" })})` : ""}. Si importás de nuevo, solo se suma lo nuevo.
        </Card>
      ) : null}

      <Card className="flex flex-col gap-3">
        <SectionTitle>1. Conexión</SectionTitle>
        {configured ? (
          <ProbeForm slug={slug} />
        ) : (
          <div className="flex flex-col gap-2 text-sm leading-relaxed text-ink-2">
            <p>
              Falta la variable <code className="rounded bg-chip px-1.5 py-0.5 font-mono text-[13px]">{envName}</code> en Vercel (proyecto tranquera → Settings → Environment Variables), marcada como Sensitive.
            </p>
            <p>Su valor es la conexión a la base de campo-admin con un usuario de solo lectura. No la pegues en ningún chat.</p>
            <p>Después de guardarla, hay que volver a publicar (Redeploy) para que la app la vea.</p>
          </div>
        )}
      </Card>

      {configured ? (
        <Card className="flex flex-col gap-3">
          <SectionTitle>2. Ensayo e importación</SectionTitle>
          <ImportForm slug={slug} />
        </Card>
      ) : null}
    </div>
  );
}
