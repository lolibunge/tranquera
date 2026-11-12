import "server-only";
import { cache } from "react";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { CATALOG, SPECIES_KEYS, isSpeciesKey, type SpeciesKey } from "./catalogo";

export type FarmSpecies = {
  key: SpeciesKey;
  active: boolean;
  orientations: string[];
  sells: boolean;
  count: number;
};

/** Todas las especies del catálogo con lo que eligió el campo y cuántos animales activos tiene. */
export const getFarmSpecies = cache(async (farmId: string): Promise<FarmSpecies[]> => {
  const [chosen, counts] = await Promise.all([
    db.select().from(schema.farmSpecies).where(eq(schema.farmSpecies.farmId, farmId)),
    db
      .select({ species: schema.animals.species, heads: sql<number>`coalesce(sum(${schema.animals.headCount}), 0)::int` })
      .from(schema.animals)
      .where(and(eq(schema.animals.farmId, farmId), eq(schema.animals.status, "activo")))
      .groupBy(schema.animals.species),
  ]);
  return SPECIES_KEYS.map((key) => {
    const row = chosen.find((c) => c.speciesKey === key);
    return {
      key,
      active: Boolean(row?.active),
      orientations: row?.orientations ?? [],
      sells: row ? row.sells === 1 : true,
      count: counts.find((c) => c.species === key)?.heads ?? 0,
    };
  });
});

export async function getActiveSpecies(farmId: string) {
  return (await getFarmSpecies(farmId)).filter((s) => s.active);
}

export async function isSpeciesActive(farmId: string, key: string): Promise<boolean> {
  if (!isSpeciesKey(key)) return false;
  const all = await getFarmSpecies(farmId);
  return Boolean(all.find((s) => s.key === key)?.active);
}

export { CATALOG };
