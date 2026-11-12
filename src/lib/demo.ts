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
  return or(like(schema.animals.tagVisual, `${PREFIX_VISUAL}%`), like(schema.animals.tagRfid, `${PREFIX_RFID}%`), eq(schema.animals.name, DEMO_NAME));
}

export async function loadDemo(farmId: string, userId: string) {
  const today = todayISO();
  return db.transaction(async (tx) => {
    // Vacunos prendidos (sin tocar otras especies ni orientaciones que ya tenga).
    await tx
      .insert(schema.farmSpecies)
      .values({ farmId, speciesKey: "vacuno", active: true, orientations: ["cria"], sells: 1 })
      .onConflictDoUpdate({ target: [schema.farmSpecies.farmId, schema.farmSpecies.speciesKey], set: { active: true, updatedAt: new Date() } });

    const existing = await tx.select({ id: schema.animals.id }).from(schema.animals).where(and(eq(schema.animals.farmId, farmId), isDemo()));
    if (existing.length) return { created: 0, already: true };

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
      .returning({ id: schema.animals.id, tag: schema.animals.tagVisual });
    const id = (tag: string) => rows.find((r) => r.tag === tag)!.id;

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
    return { created: rows.length, already: false };
  });
}

export async function clearDemo(farmId: string) {
  return db.transaction(async (tx) => {
    const ids = (await tx.select({ id: schema.animals.id }).from(schema.animals).where(and(eq(schema.animals.farmId, farmId), isDemo()))).map((r) => r.id);
    if (ids.length) await tx.delete(schema.animals).where(inArray(schema.animals.id, ids)); // la sanidad se borra en cascada
    await tx.delete(schema.healthSessions).where(and(eq(schema.healthSessions.farmId, farmId), eq(schema.healthSessions.product, DEMO_PRODUCT)));
    return ids.length;
  });
}

export async function hasDemo(farmId: string) {
  const [row] = await db.select({ id: schema.animals.id }).from(schema.animals).where(and(eq(schema.animals.farmId, farmId), isDemo())).limit(1);
  return Boolean(row);
}
