import type { CSSProperties } from "react";
import { getFarmAccess } from "@/lib/farms";
import { BottomNav } from "@/components/bottom-nav";
import { getActiveSpecies } from "@/lib/farm-species";

/** Todo lo de un campo: aplica su marca y muestra la barra de abajo. */
export default async function FarmLayout({ children, params }: LayoutProps<"/c/[slug]">) {
  const { slug } = await params;
  const { farm } = await getFarmAccess(slug);
  const hasAnimals = (await getActiveSpecies(farm.id)).length > 0;
  const style = { "--brand": farm.colorPrimary, "--accent": farm.colorAccent } as CSSProperties;
  return (
    <div style={style} className="flex min-h-full flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pt-5 pb-28">{children}</div>
      <BottomNav slug={slug} hasAnimals={hasAnimals} />
    </div>
  );
}
