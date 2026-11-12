import "server-only";
import { and, eq, inArray, like, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { addDays, todayISO } from "./dates";

/**
 * Datos de prueba: 11 vacunos con caravanas UY 9000…, sanidad en los tres estados
 * y una jornada de manga empezada. Todo se reconoce por la caravana UY9000, el RFID
 * 85800009… o el nombre "La Pinta (prueba)", y se borra solo eso.
 */

const PREFIX_VISUAL = "UY9000";
const PREFIX_SHEEP = "UY9100";
const DEMO_PADDOCKS = [
  { name: "Potrero 1 (prueba)", hectares: 45, kind: "natural" },
  { name: "Potrero 2 (prueba)", hectares: 30, kind: "pradera" },
  { name: "Bajo (prueba)", hectares: 60, kind: "natural" },
  { name: "Verdeo (prueba)", hectares: 15, kind: "verdeo" },
];
const PREFIX_RFID = "85800009";
const DEMO_NAME = "La Pinta (prueba)";
const DEMO_PRODUCT = "Aftosa Prueba";

type Demo = {
  tag?: string;
  rfid?: string;
  name?: string;
  category: string;
  sex: string;
  birth?: string;
  breed?: string;
  origin?: "nacido" | "comprado";
  from?: string;
  arrived?: string;
};

const ANIMALS: Demo[] = [
  { tag: "UY90000001", rfid: "858000090000001", category: "vaca", sex: "hembra", birth: "2019-09-10", breed: "Hereford", origin: "nacido" },
  { tag: "UY90000002", rfid: "858000090000002", category: "vaca", sex: "hembra", birth: "2020-08-22", breed: "Hereford", origin: "nacido" },
  { tag: "UY90000003", category: "vaca", sex: "hembra", birth: "2018-10-05", breed: "Aberdeen Angus", origin: "comprado", from: "Escritorio Rural Prueba", arrived: "2024-03-15" },
  { tag: "UY90000004", category: "vaquillona", sex: "hembra", birth: "2024-09-01", breed: "Braford", origin: "nacido" },
  { tag: "UY90000005", category: "toro", sex: "macho", birth: "2017-11-12", breed: "Hereford", origin: "comprado", from: "Cabaña Prueba", arrived: "2023-04-20" },
  { name: DEMO_NAME, category: "vaca", sex: "hembra", breed: "Cruza" },
  { tag: "UY90000006", category: "ternero", sex: "macho", breed: "Hereford", birth: "2026-08-15", origin: "nacido" },
  { tag: "UY90000007", category: "ternero", sex: "macho", breed: "Hereford", birth: "2026-08-20", origin: "nacido" },
  { tag: "UY90000008", category: "ternera", sex: "hembra", breed: "Hereford", birth: "2026-08-25", origin: "nacido" },
  { rfid: "858000090000009", category: "ternero", sex: "macho", breed: "Hereford", birth: "2026-09-01", origin: "nacido" },
  { tag: "UY90000010", category: "ternera", sex: "hembra", breed: "Hereford", birth: "2026-09-03", origin: "nacido" },
];

function isDemo() {
  return or(
    like(schema.animals.tagVisual, `${PREFIX_VISUAL}%`),
    like(schema.animals.tagVisual, `${PREFIX_SHEEP}%`),
    like(schema.animals.tagRfid, `${PREFIX_RFID}%`),
    eq(schema.animals.name, DEMO_NAME),
  );
}

/** Mapa de prueba: cuatro potreros dibujados a mano. viewBox propio para reconocerlo al borrar. */
const DEMO_MAP_VIEWBOX = "0 0 400 301";
const DEMO_MAP = {
  viewBox: DEMO_MAP_VIEWBOX,
  shapes: [
    { tag: "polygon", attrs: { points: "10,10 210,10 190,140 10,150" }, transform: "", name: "Potrero 1 (prueba)" },
    { tag: "polygon", attrs: { points: "210,10 390,10 390,130 190,140" }, transform: "", name: "Potrero 2 (prueba)" },
    { tag: "polygon", attrs: { points: "10,150 190,140 220,290 10,290" }, transform: "", name: "Bajo (prueba)" },
    { tag: "polygon", attrs: { points: "190,140 390,130 390,290 220,290" }, transform: "", name: "Verdeo (prueba)" },
  ],
};

const SHEEP: { category: string; sex: string; n: number }[] = [
  { category: "oveja", sex: "hembra", n: 12 },
  { category: "borrega", sex: "hembra", n: 4 },
  { category: "carnero", sex: "macho", n: 2 },
  { category: "capon", sex: "castrado", n: 2 },
];

export async function loadDemo(farmId: string, userId: string) {
  const today = todayISO();
  return db.transaction(async (tx) => {
    // Vacunos prendidos (sin tocar otras especies ni orientaciones que ya tenga).
    await tx
      .insert(schema.farmSpecies)
      .values({ farmId, speciesKey: "vacuno", active: true, orientations: ["cria"], sells: 1 })
      .onConflictDoUpdate({ target: [schema.farmSpecies.farmId, schema.farmSpecies.speciesKey], set: { active: true, updatedAt: new Date() } });

    await tx
      .insert(schema.farmSpecies)
      .values({ farmId, speciesKey: "ovino", active: true, orientations: ["lana", "cria"], sells: 1 })
      .onConflictDoUpdate({ target: [schema.farmSpecies.farmId, schema.farmSpecies.speciesKey], set: { active: true, updatedAt: new Date() } });

    const existing = await tx.select({ id: schema.animals.id }).from(schema.animals).where(and(eq(schema.animals.farmId, farmId), isDemo()));
    if (existing.length) return { created: 0, already: true };

    // Potreros de prueba (si ya existen con ese nombre, se reusan).
    const paddockIds: string[] = [];
    for (const p of DEMO_PADDOCKS) {
      const [row] = await tx
        .insert(schema.paddocks)
        .values({ farmId, name: p.name, hectares: p.hectares, kind: p.kind })
        .onConflictDoUpdate({ target: [schema.paddocks.farmId, schema.paddocks.name], set: { active: true, updatedAt: new Date() } })
        .returning({ id: schema.paddocks.id });
      paddockIds.push(row.id);
    }

    const rows = await tx
      .insert(schema.animals)
      .values(
        ANIMALS.map((a) => ({
          farmId,
          species: "vacuno",
          category: a.category,
          sex: a.sex,
          name: a.name ?? null,
          tagVisual: a.tag ?? null,
          tagRfid: a.rfid ?? null,
          birthDate: a.birth ?? null,
          breed: a.breed ?? null,
          origin: a.origin ?? null,
          originDetail: a.from ?? null,
          arrivedOn: a.arrived ?? null,
          createdBy: userId,
        })),
      )
      .returning({ id: schema.animals.id, tag: schema.animals.tagVisual, category: schema.animals.category });
    const id = (tag: string) => rows.find((r) => r.tag === tag)!.id;

    // 20 ovinos para probar la esquila.
    let n = 0;
    const sheep = await tx
      .insert(schema.animals)
      .values(
        SHEEP.flatMap((g) =>
          Array.from({ length: g.n }, () => {
            n++;
            return {
              farmId,
              species: "ovino",
              category: g.category,
              sex: g.sex,
              tagVisual: `${PREFIX_SHEEP}${String(n).padStart(4, "0")}`,
              breed: "Corriedale",
              origin: "nacido" as const,
              createdBy: userId,
            };
          }),
        ),
      )
      .returning({ id: schema.animals.id });

    // Vacas y toro en el Potrero 1, terneros en el 2, ovinos en el Bajo; el Verdeo descansa.
    const place = async (ids: string[], paddockId: string, daysAgo: number) => {
      const date = addDays(today, -daysAgo);
      const batchId = crypto.randomUUID();
      await tx.insert(schema.movements).values(ids.map((animalId) => ({ farmId, animalId, toPaddockId: paddockId, date, batchId, createdBy: userId })));
      await tx.update(schema.animals).set({ paddockId }).where(inArray(schema.animals.id, ids));
    };
    const adults = rows.filter((r) => !["ternero", "ternera"].includes(r.category ?? "")).map((r) => r.id);
    const calves = rows.filter((r) => !adults.includes(r.id)).map((r) => r.id);
    await place(adults, paddockIds[0], 12);
    await place(calves, paddockIds[1], 5);
    await place(sheep.map((s) => s.id), paddockIds[2], 20);
    // El verdeo tuvo animales y está en descanso hace 9 días.
    const rest = crypto.randomUUID();
    await tx.insert(schema.movements).values([
      { farmId, animalId: calves[0], fromPaddockId: paddockIds[3], toPaddockId: paddockIds[1], date: addDays(today, -9), batchId: rest, createdBy: userId },
    ]);

    // Mapa de prueba, solo si el campo no tiene uno propio.
    const [hasMap] = await tx.select({ farmId: schema.farmMaps.farmId }).from(schema.farmMaps).where(eq(schema.farmMaps.farmId, farmId)).limit(1);
    if (!hasMap) {
      await tx.insert(schema.farmMaps).values({ farmId, svg: JSON.stringify(DEMO_MAP) });
      for (const [i, p] of DEMO_PADDOCKS.entries()) await tx.update(schema.paddocks).set({ svgId: p.name }).where(eq(schema.paddocks.id, paddockIds[i]));
    }

    // Lluvias de los últimos días.
    await tx
      .insert(schema.weatherLogs)
      .values([
        { farmId, date: addDays(today, -6), rainMm: 18, createdBy: userId, note: "Dato de prueba" },
        { farmId, date: addDays(today, -2), rainMm: 7.5, createdBy: userId, note: "Dato de prueba" },
      ])
      .onConflictDoNothing();

    // Un vencido, uno por vencer, uno al día y uno sin próxima fecha (fechas relativas a hoy).
    await tx.insert(schema.healthEvents).values([
      { farmId, animalId: id("UY90000001"), control: "vacuna_clostridiosis", label: "Vacuna clostridiosis", product: "Clostridial Prueba", date: addDays(today, -376), nextDueDate: addDays(today, -11), createdBy: userId },
      { farmId, animalId: id("UY90000002"), control: "bano_garrapata", label: "Baño o garrapaticida", product: "Garrapaticida Prueba", date: addDays(today, -18), nextDueDate: addDays(today, 3), createdBy: userId },
      { farmId, animalId: id("UY90000003"), control: "vacuna_carbunco", label: "Vacuna carbunco", product: "Carbunco Prueba", date: addDays(today, -247), nextDueDate: addDays(today, 118), createdBy: userId },
      { farmId, animalId: id("UY90000004"), control: "otro:curación de herida", label: "Curación de herida", date: today, notes: "Pata trasera derecha", createdBy: userId },
    ]);

    // Jornada de aftosa abierta con dos terneros ya registrados.
    const [session] = await tx
      .insert(schema.healthSessions)
      .values({ farmId, species: "vacuno", control: "vacuna_aftosa", label: "Vacuna aftosa", product: DEMO_PRODUCT, batch: "P-001", dose: "2 ml", vet: "Dr. Prueba", date: today, createdBy: userId })
      .returning({ id: schema.healthSessions.id });
    await tx.insert(schema.healthEvents).values(
      ["UY90000006", "UY90000007"].map((tag) => ({
        farmId,
        animalId: id(tag),
        sessionId: session.id,
        control: "vacuna_aftosa",
        label: "Vacuna aftosa",
        product: DEMO_PRODUCT,
        batch: "P-001",
        dose: "2 ml",
        vet: "Dr. Prueba",
        date: today,
        createdBy: userId,
      })),
    );
    return { created: rows.length + sheep.length, already: false };
  });
}

export async function clearDemo(farmId: string) {
  return db.transaction(async (tx) => {
    const demo = await tx.select({ id: schema.animals.id, saleId: schema.animals.saleId }).from(schema.animals).where(and(eq(schema.animals.farmId, farmId), isDemo()));
    const ids = demo.map((r) => r.id);
    const saleIds = [...new Set(demo.map((r) => r.saleId).filter(Boolean) as string[])];
    if (saleIds.length) await tx.delete(schema.sales).where(and(eq(schema.sales.farmId, farmId), inArray(schema.sales.id, saleIds)));
    if (ids.length) await tx.delete(schema.animals).where(inArray(schema.animals.id, ids)); // la sanidad se borra en cascada
    await tx.delete(schema.healthSessions).where(and(eq(schema.healthSessions.farmId, farmId), eq(schema.healthSessions.product, DEMO_PRODUCT)));
    await tx.delete(schema.paddocks).where(and(eq(schema.paddocks.farmId, farmId), inArray(schema.paddocks.name, DEMO_PADDOCKS.map((p) => p.name))));
    await tx.delete(schema.weatherLogs).where(and(eq(schema.weatherLogs.farmId, farmId), eq(schema.weatherLogs.note, "Dato de prueba")));
    await tx.delete(schema.farmMaps).where(and(eq(schema.farmMaps.farmId, farmId), like(schema.farmMaps.svg, `%"viewBox":"${DEMO_MAP_VIEWBOX}"%`)));
    return ids.length;
  });
}

export async function hasDemo(farmId: string) {
  const [row] = await db.select({ id: schema.animals.id }).from(schema.animals).where(and(eq(schema.animals.farmId, farmId), isDemo())).limit(1);
  return Boolean(row);
}
