import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFarmAccess } from "@/lib/farms";
import { can } from "@/lib/roles";
import { BackLink, PageTitle } from "@/components/ui";
import { PaddockForm } from "../paddock-form";

export const metadata: Metadata = { title: "Nuevo potrero" };

export default async function NewPaddockPage({ params }: PageProps<"/c/[slug]/potreros/nuevo">) {
  const { slug } = await params;
  const { role } = await getFarmAccess(slug);
  if (!can(role, "configurar")) notFound();
  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/c/${slug}/potreros`} label="Volver" />
      <PageTitle>Nuevo potrero</PageTitle>
      <PaddockForm slug={slug} />
    </div>
  );
}
