import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFarmAccess } from "@/lib/farms";
import { can } from "@/lib/roles";
import { BackLink, PageTitle } from "@/components/ui";
import { ProfileForm } from "./form";

export const metadata: Metadata = { title: "Cómo es tu campo" };

export default async function ProfilePage({ params }: PageProps<"/c/[slug]/perfil">) {
  const { slug } = await params;
  const { farm, role } = await getFarmAccess(slug);
  if (!can(role, "configurar")) notFound();
  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/c/${slug}/mas`} label="Volver" />
      <PageTitle sub="Dos preguntas para que Tranquera muestre solo lo que usa tu campo. Se pueden cambiar cuando quieras.">Cómo es tu campo</PageTitle>
      <ProfileForm slug={slug} hasBoarders={farm.hasBoarders} hasPartners={farm.hasPartners} />
    </div>
  );
}
