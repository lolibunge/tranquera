import { formatPhone } from "@/lib/phone";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { BackLink, Card, PageTitle, SectionTitle } from "@/components/ui";
import { NameForm, PasswordForm } from "./forms";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function AccountPage() {
  const user = await requireUser("/cuenta");
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-6">
      <BackLink href="/campos?todos" />
      <PageTitle sub={user.email ?? formatPhone(user.phone)}>Mi cuenta</PageTitle>
      <Card className="flex flex-col gap-4">
        <SectionTitle>Nombre</SectionTitle>
        <NameForm name={user.name} />
      </Card>
      <Card className="flex flex-col gap-4">
        <SectionTitle>{user.hasPassword ? "Cambiar contraseña" : "Poner contraseña"}</SectionTitle>
        <PasswordForm hasPassword={user.hasPassword} />
      </Card>
    </main>
  );
}
