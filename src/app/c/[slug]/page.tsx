import type { Metadata } from "next";
import { getFarmAccess } from "@/lib/farms";
import { can } from "@/lib/roles";
import { ButtonLink, Card, FarmMark, SectionTitle } from "@/components/ui";

export async function generateMetadata({ params }: PageProps<"/c/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { farm } = await getFarmAccess(slug);
  return { title: farm.name };
}

const DATE = new Intl.DateTimeFormat("es-UY", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Montevideo" });

export default async function FarmHome({ params }: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const { farm, role } = await getFarmAccess(slug);
  const today = DATE.format(new Date());
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <FarmMark name={farm.name} logo={farm.logo} />
        <div className="flex flex-col">
          <h1 className="text-base font-semibold">{farm.name}</h1>
          <p className="text-[13px] text-muted first-letter:uppercase">{today}</p>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <SectionTitle>Para atender</SectionTitle>
        <Card className="flex flex-col gap-2">
          <p className="text-base font-semibold">Todavía no hay nada pendiente</p>
          <p className="text-sm leading-relaxed text-ink-2">
            Acá van a aparecer los vencimientos de sanidad, las campañas oficiales y lo que haya que hacer en el campo,
            a medida que se carguen los animales.
          </p>
        </Card>
      </section>

      {can(role, "configurar") ? (
        <section className="flex flex-col gap-3">
          <SectionTitle>Para empezar</SectionTitle>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <ButtonLink href={`/c/${slug}/marca`} kind="secondary">Poner logo y colores</ButtonLink>
            <ButtonLink href={`/c/${slug}/usuarios`} kind="secondary">Invitar al equipo</ButtonLink>
            <ButtonLink href={`/c/${slug}/configuracion`} kind="secondary">Datos del campo</ButtonLink>
          </div>
        </section>
      ) : null}
    </div>
  );
}
