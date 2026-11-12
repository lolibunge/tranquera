import type { Metadata } from "next";
import { getFarmAccess } from "@/lib/farms";
import { can } from "@/lib/roles";
import { getActiveSpecies } from "@/lib/farm-species";
import { FarmMark, SectionTitle } from "@/components/ui";
import { SetupChecklist } from "./setup-checklist";
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

      {can(role, "configurar") ? <SetupChecklist slug={slug} farm={farm} hasSpecies={hasSpecies} /> : null}
    </div>
  );
}
