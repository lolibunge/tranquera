import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { CATALOG, categoryOf, formatTag, isSpeciesKey } from "./catalogo";
import type { PickAnimal } from "@/components/animal-picker";

/** Animales activos de las especies prendidas, listos para el AnimalPicker. */
export async function pickerAnimals(farmId: string, species: string[]): Promise<(PickAnimal & { ownerId: string | null })[]> {
  const rows = await db
    .select()
    .from(schema.animals)
    .where(and(eq(schema.animals.farmId, farmId), eq(schema.animals.status, "activo")))
    .orderBy(asc(sql`coalesce(${schema.animals.tagVisual}, ${schema.animals.name})`))
    .limit(5000);
  return rows
    .filter((a) => isSpeciesKey(a.species) && species.includes(a.species))
    .map((a) => ({
      id: a.id,
      species: a.species,
      tagVisual: a.tagVisual,
      tagRfid: a.tagRfid,
      paddockId: a.paddockId,
      ownerId: a.ownerId,
      heads: a.headCount,
      title: a.isLot ? (a.name ?? "Lote") : a.tagVisual ? formatTag(a.tagVisual) : (a.name ?? formatTag(a.tagRfid)),
      sub: isSpeciesKey(a.species) ? (a.isLot ? `Lote · ${a.headCount} cab.` : (categoryOf(a.species, a.category)?.label ?? CATALOG[a.species].label)) : "",
    }));
}
