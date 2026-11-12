import type { Metadata } from "next";
import { getFarmAccess } from "@/lib/farms";
import { can } from "@/lib/roles";
import { getActiveSpecies } from "@/lib/farm-species";
import { ButtonLink, FarmMark, SectionTitle } from "@/components/ui";
import { AttendList } from "@/components/attend-list";

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
  const species = await getActiveSpecies(farm.id);
  const hasSpecies = species.length > 0;
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
        <AttendList slug={slug} farmId={farm.id} activeSpecies={species.map((x) => x.key)} />
      </section>

      {can(role, "configurar") ? (
        <section className="flex flex-col gap-3">
          <SectionTitle>Para empezar</SectionTitle>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {!hasSpecies ? (
              <ButtonLink href={`/c/${slug}/especies?desde=inicio`} className="sm:col-span-2">Elegir las especies del campo</ButtonLink>
            ) : null}
            <ButtonLink href={`/c/${slug}/marca`} kind="secondary">Poner logo y colores</ButtonLink>
            <ButtonLink href={`/c/${slug}/usuarios`} kind="secondary">Invitar al equipo</ButtonLink>
            <ButtonLink href={`/c/${slug}/configuracion`} kind="secondary">Datos del campo</ButtonLink>
          </div>
        </section>
      ) : null}
    </div>
  );
}
