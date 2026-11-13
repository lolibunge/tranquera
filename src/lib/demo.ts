import "server-only";
import { and, eq, inArray, like, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { addDays, todayISO } from "./dates";

/**
 * Datos de prueba de las seis especies: vacunos (UY9000…), ovinos (UY9100…), cabras (UY9200…),
 * chanchos (UY9300…), y caballos, lotes y aves con nombre terminado en "(prueba)".
 * Sanidad en los tres estados y jornadas empezadas. Se reconoce todo por eso y se borra solo eso.
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
const DEMO_SHEARING = "Comparsa Prueba";

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
    like(schema.animals.tagVisual, `${PREFIX_GOAT}%`),
    like(schema.animals.tagVisual, `${PREFIX_PIG}%`),
    like(schema.animals.name, "%(prueba)"),
  );
}

/** Cabras y chanchos con caravana UY9200… / UY9300…; caballos, lotes y aves por nombre "(prueba)". */
const PREFIX_GOAT = "UY9200";
const PREFIX_PIG = "UY9300";

type Extra = {
  species: string;
  category: string;
  sex: string;
  name?: string;
  tag?: string;
  lot?: number;
  breed: string;
  birth: string;
  origin?: "nacido" | "comprado";
  from?: string;
  paddock?: number;
};

function extras(today: string): Extra[] {
  const y = Number(today.slice(0, 4));
  const goats: Extra[] = Array.from({ length: 8 }, (_, i) => ({
    species: "caprino",
    category: i < 6 ? "cabra" : i === 6 ? "chivo" : "cabrita",
    sex: i < 6 || i === 7 ? "hembra" : "macho",
    tag: `${PREFIX_GOAT}${String(i + 1).padStart(4, "0")}`,
    breed: i % 3 === 0 ? "Anglo Nubian" : "Saanen",
    birth: `${y - 2 - (i % 3)}-0${(i % 4) + 6}-1${i}`,
    paddock: 2,
  }));
  const sows: Extra[] = Array.from({ length: 4 }, (_, i) => ({
    species: "porcino",
    category: "cerda",
    sex: "hembra",
    tag: `${PREFIX_PIG}${String(i + 1).padStart(4, "0")}`,
    breed: i < 2 ? "Pampa Rocha" : "Large White",
    birth: `${y - 2}-0${i + 3}-15`,
  }));
  return [
    { species: "caballo", category: "caballo", sex: "castrado", name: "Moro (prueba)", breed: "Criollo", birth: `${y - 12}-10-01`, paddock: 1 },
    { species: "caballo", category: "caballo", sex: "castrado", name: "Zaino (prueba)", breed: "Criollo", birth: `${y - 9}-09-15`, paddock: 1 },
    { species: "caballo", category: "yegua", sex: "hembra", name: "Tordilla (prueba)", breed: "Criollo", birth: `${y - 7}-11-20`, paddock: 1 },
    { species: "caballo", category: "yegua", sex: "hembra", name: "Picaza (prueba)", breed: "Cuarto de Milla", birth: `${y - 6}-10-05`, origin: "comprado", from: "Haras Prueba", paddock: 1 },
    { species: "caballo", category: "padrillo", sex: "macho", name: "Lucero (prueba)", breed: "Criollo", birth: `${y - 8}-10-10`, origin: "comprado", from: "Cabaña Prueba", paddock: 1 },
    { species: "caballo", category: "potrillo", sex: "macho", name: "Chispa (prueba)", breed: "Criollo", birth: addDays(today, -50), paddock: 1 },
    ...goats,
    { species: "caprino", category: "cabrito", sex: "macho", name: "Cabritos (prueba)", lot: 9, breed: "Saanen", birth: addDays(today, -40), paddock: 2 },
    ...sows,
    { species: "porcino", category: "padrillo", sex: "macho", tag: `${PREFIX_PIG}0005`, breed: "Duroc", birth: `${y - 3}-05-02`, origin: "comprado", from: "Criadero Prueba" },
    { species: "porcino", category: "lechon", sex: "macho", name: "Lechones (prueba)", lot: 22, breed: "Cruza", birth: addDays(today, -25) },
    { species: "porcino", category: "capon", sex: "castrado", name: "Capones engorde (prueba)", lot: 10, breed: "Cruza", birth: addDays(today, -150) },
    { species: "ave", category: "gallina", sex: "hembra", name: "Ponedoras (prueba)", lot: 120, breed: "Rhode Island Red", birth: addDays(today, -300), origin: "comprado", from: "Granja Prueba" },
    { species: "ave", category: "pollo", sex: "macho", name: "Parrilleros (prueba)", lot: 200, breed: "Cobb", birth: addDays(today, -28), origin: "comprado", from: "Granja Prueba" },
    { species: "ave", category: "gallo", sex: "macho", name: "Gallos (prueba)", lot: 4, breed: "Campera", birth: addDays(today, -500) },
  ];
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Potreros propios del campo (no de prueba), los del mapa primero, repartidos a lo largo
 * de la lista para que los animales no queden todos juntos.
 */
async function realPaddocks(tx: Tx, farmId: string) {
  const rows = await tx
    .select({ id: schema.paddocks.id, name: schema.paddocks.name, mapped: schema.paddocks.svgId })
    .from(schema.paddocks)
    .where(and(eq(schema.paddocks.farmId, farmId), eq(schema.paddocks.active, true)));
  const own = rows.filter((r) => !r.name.endsWith("(prueba)"));
  const pool = own.filter((r) => r.mapped).length >= 5 ? own.filter((r) => r.mapped) : own;
  if (pool.length < 5) return [];
  pool.sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }));
  const step = pool.length / 5;
  return Array.from({ length: 5 }, (_, i) => pool[Math.floor(i * step)].id);
}

const DEMO_SUPPLIES = [
  { name: "Vacuna aftosa (prueba)", category: "medicamentos", unit: "dosis", minimum: 50, stock: 60, used: 20 },
  { name: "Antiparasitario (prueba)", category: "medicamentos", unit: "ml", minimum: 100, stock: 450, used: 0 },
  { name: "Ración 18% (prueba)", category: "alimento", unit: "bolsa", minimum: 5, stock: 12, used: 0 },
  { name: "Fardos de alfalfa (prueba)", category: "alimento", unit: "fardo", minimum: 20, stock: 14, used: 0 },
  { name: "Sal mineral (prueba)", category: "sales", unit: "kg", minimum: 25, stock: 25, used: 25 },
  { name: "Gasoil (prueba)", category: "combustible", unit: "l", minimum: 100, stock: 380, used: 0 },
];

/** Insumos de prueba: uno bajo el mínimo, uno sin stock, el resto alcanza. Si ya están, no hace nada. */
async function loadSupplies(tx: Tx, farmId: string, userId: string, today: string, sessionId?: string) {
  for (const d of DEMO_SUPPLIES) {
    const [row] = await tx
      .insert(schema.supplies)
      .values({ farmId, name: d.name, category: d.category, unit: d.unit, minimum: d.minimum })
      .onConflictDoNothing()
      .returning({ id: schema.supplies.id });
    if (!row) continue;
    await tx.insert(schema.supplyMoves).values({ farmId, supplyId: row.id, date: addDays(today, -40), quantity: d.stock, unitCost: "1.5", currency: "USD", note: "Compra de prueba", createdBy: userId });
    if (d.used) {
      await tx.insert(schema.supplyMoves).values({
        farmId,
        supplyId: row.id,
        date: today,
        quantity: -d.used,
        note: sessionId && d.category === "medicamentos" ? null : "Consumo de prueba",
        sessionId: sessionId && d.category === "medicamentos" ? sessionId : null,
        createdBy: userId,
      });
    }
  }
}

/**
 * Propietarios de prueba: un socio con las cabras, un tercero con los caballos en pensión y
 * un pozo común (campo 60 % / socio 40 %) con los terneros. Más algunos gastos del mes.
 */
async function loadOwners(tx: Tx, farmId: string, userId: string, today: string) {
  const make = async (name: string, kind: string, extra: { monthlyFee?: string } = {}) => {
    const [row] = await tx.insert(schema.owners).values({ farmId, name, kind, ...extra }).onConflictDoNothing().returning({ id: schema.owners.id });
    return row?.id ?? null;
  };
  const [hasFarm] = await tx
    .select({ id: schema.owners.id })
    .from(schema.owners)
    .where(and(eq(schema.owners.farmId, farmId), eq(schema.owners.kind, "campo"), eq(schema.owners.active, true)))
    .limit(1);
  const farmOwner = hasFarm?.id ?? (await make("El campo (prueba)", "campo"));
  const partner = await make("Socio Pérez (prueba)", "socio");
  const boarder = await make("Pensión Rodríguez (prueba)", "tercero", { monthlyFee: "300.00" });
  const pool = await make("Pozo terneros (prueba)", "pozo");
  if (!partner || !boarder || !pool || !farmOwner) return; // ya estaban
  await tx.update(schema.farms).set({ hasBoarders: true, hasPartners: true }).where(eq(schema.farms.id, farmId));

  await tx.insert(schema.ownerShares).values([
    { poolId: pool, partnerId: farmOwner, percent: 60 },
    { poolId: pool, partnerId: partner, percent: 40 },
  ]);
  const demo = await tx
    .select({ id: schema.animals.id, species: schema.animals.species, category: schema.animals.category })
    .from(schema.animals)
    .where(and(eq(schema.animals.farmId, farmId), isDemo(), eq(schema.animals.status, "activo")));
  const set = async (ids: string[], ownerId: string) => {
    if (ids.length) await tx.update(schema.animals).set({ ownerId }).where(inArray(schema.animals.id, ids));
  };
  await set(demo.filter((a) => a.species === "caprino").map((a) => a.id), partner);
  await set(demo.filter((a) => a.species === "caballo").map((a) => a.id), boarder);
  await set(demo.filter((a) => a.species === "vacuno" && ["ternero", "ternera"].includes(a.category ?? "")).map((a) => a.id), pool);

  // Pensión de los caballos de Rodríguez: tarifa por caballo, un mes cobrado y pagado a medias.
  const horses = demo.filter((a) => a.species === "caballo");
  const start = addDays(today, -120);
  const rates = await tx
    .insert(schema.boardRates)
    .values(horses.map((h) => ({ farmId, ownerId: boarder, animalId: h.id, monthly: "50.00", currency: "USD", from: start })))
    .returning({ id: schema.boardRates.id });
  const lastMonth = addDays(`${today.slice(0, 7)}-01`, -1);
  await tx.insert(schema.ledger).values([
    ...rates.map((r, i) => ({
      farmId,
      ownerId: boarder,
      kind: "cargo",
      date: lastMonth,
      amount: "50.00",
      currency: "USD",
      concept: `Pensión del mes pasado · caballo ${i + 1}`,
      period: lastMonth.slice(0, 7),
      rateId: r.id,
      createdBy: userId,
    })),
    { farmId, ownerId: boarder, kind: "pago", date: addDays(today, -4), amount: "200.00", currency: "USD", concept: "Transferencia", createdBy: userId },
  ]);

  // Ración diaria de los caballos de pensión (si están los insumos de prueba).
  const feeds = await tx
    .select({ id: schema.supplies.id, name: schema.supplies.name })
    .from(schema.supplies)
    .where(and(eq(schema.supplies.farmId, farmId), inArray(schema.supplies.name, ["Ración 18% (prueba)", "Fardos de alfalfa (prueba)"])));
  const ration = feeds.find((f) => f.name.startsWith("Ración"));
  const hay = feeds.find((f) => f.name.startsWith("Fardos"));
  if (ration && hay && horses.length) {
    await tx.insert(schema.feedPlans).values(
      horses.flatMap((h) => [
        { farmId, animalId: h.id, supplyId: ration.id, slot: "manana", quantity: 0.1 },
        { farmId, animalId: h.id, supplyId: ration.id, slot: "noche", quantity: 0.1 },
        { farmId, animalId: h.id, supplyId: hay.id, slot: "tarde", quantity: 0.25 },
      ]),
    );
  }

  await tx.insert(schema.expenses).values([
    { farmId, date: addDays(today, -10), concept: "Sueldo peón (prueba)", category: "personal", amount: "850.00", currency: "USD", createdBy: userId },
    { farmId, date: addDays(today, -8), concept: "Gasoil (prueba)", category: "combustible", amount: "9800.00", currency: "UYU", supplier: "Estación Prueba", paidBy: "Loli", createdBy: userId },
    { farmId, date: addDays(today, -5), concept: "Ración terneros (prueba)", category: "alimentacion", amount: "420.00", currency: "USD", ownerId: pool, createdBy: userId },
    { farmId, date: addDays(today, -3), concept: "Veterinario cabras (prueba)", category: "sanidad", amount: "120.00", currency: "USD", ownerId: partner, createdBy: userId },
  ]);
}

const EXTRA_SPECIES: { key: string; orientations: string[] }[] = [
  { key: "caballo", orientations: ["trabajo"] },
  { key: "caprino", orientations: ["leche"] },
  { key: "porcino", orientations: ["ciclo_completo"] },
  { key: "ave", orientations: ["ponedoras"] },
];

/** Carga los caballos, cabras, chanchos y aves de prueba de las especies que todavía no tienen. */
async function loadExtras(tx: Tx, farmId: string, userId: string, today: string) {
  for (const sp of EXTRA_SPECIES) {
    await tx
      .insert(schema.farmSpecies)
      .values({ farmId, speciesKey: sp.key, active: true, orientations: sp.orientations, sells: 1 })
      .onConflictDoUpdate({ target: [schema.farmSpecies.farmId, schema.farmSpecies.speciesKey], set: { active: true, updatedAt: new Date() } });
  }
  const present = await tx
    .selectDistinct({ species: schema.animals.species })
    .from(schema.animals)
    .where(and(eq(schema.animals.farmId, farmId), isDemo(), inArray(schema.animals.species, EXTRA_SPECIES.map((s) => s.key))));
  const skip = new Set(present.map((p) => p.species));
  const list = extras(today).filter((a) => !skip.has(a.species));
  if (!list.length) return 0;

  const own = await realPaddocks(tx, farmId);
  const paddocks = await tx
    .select({ id: schema.paddocks.id, name: schema.paddocks.name })
    .from(schema.paddocks)
    .where(and(eq(schema.paddocks.farmId, farmId), inArray(schema.paddocks.name, DEMO_PADDOCKS.map((p) => p.name))));
  const paddockId = (i?: number) =>
    i === undefined ? null : own.length >= 5 ? own[i === 1 ? 4 : i] : (paddocks.find((p) => p.name === DEMO_PADDOCKS[i].name)?.id ?? null);

  const rows = await tx
    .insert(schema.animals)
    .values(
      list.map((a) => ({
        farmId,
        species: a.species,
        category: a.category,
        sex: a.sex,
        name: a.name ?? null,
        tagVisual: a.tag ?? null,
        isLot: Boolean(a.lot),
        headCount: a.lot ?? 1,
        breed: a.breed,
        birthDate: a.birth,
        origin: a.origin ?? "nacido",
        originDetail: a.from ?? null,
        arrivedOn: a.origin === "comprado" ? addDays(today, -200) : null,
        paddockId: paddockId(a.paddock),
        createdBy: userId,
      })),
    )
    .returning({ id: schema.animals.id, species: schema.animals.species, category: schema.animals.category, paddockId: schema.animals.paddockId });

  const placed = rows.filter((r) => r.paddockId);
  if (placed.length) {
    const batchId = crypto.randomUUID();
    await tx.insert(schema.movements).values(placed.map((r) => ({ farmId, animalId: r.id, toPaddockId: r.paddockId, date: addDays(today, -15), batchId, createdBy: userId })));
  }

  const ev = (animalId: string, control: string, label: string, daysAgo: number, extra: Partial<typeof schema.healthEvents.$inferInsert> = {}) => ({
    farmId,
    animalId,
    control,
    label,
    date: addDays(today, -daysAgo),
    createdBy: userId,
    ...extra,
  });
  const of = (species: string, cats?: string[]) => rows.filter((r) => r.species === species && (!cats || cats.includes(r.category ?? "")));
  const events = [
    // Caballos: AIE vencida en uno, por vencer en otro; herraje al día; influenza pronto.
    ...of("caballo", ["caballo", "yegua", "padrillo"]).map((h, i) =>
      ev(h.id, "aie", "Certificado anemia infecciosa", i === 0 ? 380 : i === 1 ? 357 : 200, { vet: "Dr. Prueba", result: "negativo", nextDueDate: addDays(today, i === 0 ? -15 : i === 1 ? 8 : 165) }),
    ),
    ...of("caballo", ["caballo", "yegua", "padrillo"]).map((h) => ev(h.id, "herraje", "Herraje o desvasado", 30, { nextDueDate: addDays(today, 15) })),
    ...of("caballo").map((h) => ev(h.id, "vacuna_influenza", "Vacuna influenza", 170, { product: "Influenza Prueba", nextDueDate: addDays(today, 10) })),
    // Cabras: clostridial al día, desparasitación vencida.
    ...of("caprino").map((g) => ev(g.id, "vacuna_clostridial", "Vacuna clostridial", 90, { product: "Clostridial Prueba", nextDueDate: addDays(today, 275) })),
    ...of("caprino", ["cabra", "chivo", "cabrita"]).map((g) => ev(g.id, "desparasitacion", "Desparasitación", 100, { product: "Antiparasitario Prueba", nextDueDate: addDays(today, -10) })),
    ...of("caprino", ["cabra"]).map((g, i) => ev(g.id, "ecografia", "Ecografía", 40, { vet: "Dr. Prueba", result: i === 0 ? "mellizos" : i === 5 ? "vacía" : "preñada" })),
    // Chanchos: servicio a las cerdas, desparasitación por vencer, pesada de capones.
    ...of("porcino", ["cerda"]).map((p) => ev(p.id, "servicio", "Servicio", 70, { product: "Padrillo Duroc" })),
    ...of("porcino").map((p) => ev(p.id, "desparasitacion", "Desparasitación", 85, { product: "Antiparasitario Prueba", nextDueDate: addDays(today, 5) })),
    ...of("porcino", ["capon"]).map((p) => ev(p.id, "pesada", "Pesada", 7, { result: "78" })),
    // Aves: Newcastle por vencer en ponedoras, al día en el resto.
    ...of("ave").map((b) => ev(b.id, "vacuna_newcastle", "Vacuna Newcastle", b.category === "gallina" ? 85 : 20, { product: "Newcastle Prueba", nextDueDate: addDays(today, b.category === "gallina" ? 5 : 70) })),
  ];
  if (events.length) await tx.insert(schema.healthEvents).values(events);
  return rows.length;
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

const SHEEP: { category: string; sex: string; n: number; born: number; breed: string }[] = [
  { category: "oveja", sex: "hembra", n: 12, born: 2021, breed: "Corriedale" },
  { category: "borrega", sex: "hembra", n: 4, born: 2025, breed: "Corriedale" },
  { category: "carnero", sex: "macho", n: 2, born: 2022, breed: "Merino Australiano" },
  { category: "capon", sex: "castrado", n: 2, born: 2024, breed: "Corriedale" },
];
const LOT_NAME = "Corderos 2026 (prueba)";

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

    const existing = await tx
      .select({ id: schema.animals.id })
      .from(schema.animals)
      .where(and(eq(schema.animals.farmId, farmId), isDemo(), inArray(schema.animals.species, ["vacuno", "ovino"])));
    if (existing.length) {
      await loadSupplies(tx, farmId, userId, today);
      const added = await loadExtras(tx, farmId, userId, today);
      await loadOwners(tx, farmId, userId, today);
      return { created: added, already: added === 0 };
    }

    // Si el campo ya tiene sus potreros (por ejemplo, del mapa), los animales se reparten ahí
    // para verlos en el mapa real. Si no, se crean potreros de prueba.
    const own = await realPaddocks(tx, farmId);
    const paddockIds: string[] = own.length >= 5 ? own.slice(0, 5) : [];
    for (const p of paddockIds.length ? [] : DEMO_PADDOCKS) {
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
              breed: g.breed,
              birthDate: `${g.born}-0${(n % 3) + 7}-1${n % 9}`,
              origin: g.category === "carnero" ? ("comprado" as const) : ("nacido" as const),
              originDetail: g.category === "carnero" ? "Cabaña Prueba" : null,
              arrivedOn: g.category === "carnero" ? "2024-02-20" : null,
              createdBy: userId,
            };
          }),
        ),
      )
      .returning({ id: schema.animals.id, tag: schema.animals.tagVisual, category: schema.animals.category });

    // Lote de corderos de la señalada (se cargan por lote, con cantidad).
    const [lot] = await tx
      .insert(schema.animals)
      .values({ farmId, species: "ovino", isLot: true, headCount: 15, name: LOT_NAME, category: "cordero", breed: "Corriedale", birthDate: addDays(today, -60), origin: "nacido", createdBy: userId })
      .returning({ id: schema.animals.id });

    // Historia de la majada (fechas relativas a hoy).
    const ewes = sheep.filter((x) => x.category === "oveja");
    const sheepEvent = (animalId: string, control: string, label: string, daysAgo: number, extra: Partial<typeof schema.healthEvents.$inferInsert> = {}) => ({
      farmId,
      animalId,
      control,
      label,
      date: addDays(today, -daysAgo),
      createdBy: userId,
      ...extra,
    });
    await tx.insert(schema.healthEvents).values([
      // Esquila del año pasado en todas: la próxima vence en 5 días ("vence pronto").
      ...sheep.map((x, i) =>
        sheepEvent(x.id, "esquila", "Esquila", 360, {
          product: "Comparsa Prueba",
          batch: "Esquila Tally-Hi",
          result: x.category === "carnero" ? "6.8" : x.category === "capon" ? "4.9" : String(3.6 + (i % 5) * 0.2),
          nextDueDate: addDays(today, 5),
        }),
      ),
      // Baño de sarna/piojo del año pasado: vencido.
      ...sheep.map((x) => sheepEvent(x.id, "bano_sarna", "Baño sarna o piojo", 380, { product: "Baño Prueba", nextDueDate: addDays(today, -15) })),
      // Vacuna clostridial: al día.
      ...sheep.map((x) => sheepEvent(x.id, "vacuna_clostridial", "Vacuna clostridial", 120, { product: "Clostridial Prueba", dose: "2 ml", nextDueDate: addDays(today, 245) })),
      // Ecografía de las ovejas.
      ...ewes.map((x, i) =>
        sheepEvent(x.id, "ecografia", "Ecografía", 75, { vet: "Dr. Prueba", result: i % 4 === 0 ? "mellizos" : i % 5 === 0 ? "vacía" : "preñada" }),
      ),
      // Pesada de capones y borregas.
      ...sheep
        .filter((x) => x.category === "capon" || x.category === "borrega")
        .map((x, i) => sheepEvent(x.id, "pesada", "Pesada", 20, { result: String(38 + i * 3) })),
      // Señalada y dosificación del lote de corderos.
      sheepEvent(lot.id, "senalada", "Señalada", 30, { notes: "15 corderos señalados" }),
      sheepEvent(lot.id, "desparasitacion", "Desparasitación", 30, { product: "Antiparasitario Prueba", nextDueDate: addDays(today, 60) }),
    ]);

    // Esquila de este año empezada: 3 ovejas ya esquiladas.
    const [shearing] = await tx
      .insert(schema.healthSessions)
      .values({
        farmId,
        species: "ovino",
        control: "esquila",
        label: "Esquila",
        product: DEMO_SHEARING,
        batch: "Esquila Tally-Hi",
        vet: "Capataz de comparsa",
        date: today,
        nextDueDate: addDays(today, 365),
        createdBy: userId,
      })
      .returning({ id: schema.healthSessions.id });
    await tx.insert(schema.healthEvents).values(
      ewes.slice(0, 3).map((x, i) => ({
        farmId,
        animalId: x.id,
        sessionId: shearing.id,
        control: "esquila",
        label: "Esquila",
        product: DEMO_SHEARING,
        batch: "Esquila Tally-Hi",
        date: today,
        nextDueDate: addDays(today, 365),
        result: String(3.9 + i * 0.3),
        createdBy: userId,
      })),
    );

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
    await place([...sheep.map((s) => s.id), lot.id], paddockIds[2], 20);
    // El verdeo tuvo animales y está en descanso hace 9 días.
    const rest = crypto.randomUUID();
    await tx.insert(schema.movements).values([
      { farmId, animalId: calves[0], fromPaddockId: paddockIds[3], toPaddockId: paddockIds[1], date: addDays(today, -9), batchId: rest, createdBy: userId },
    ]);

    // Mapa de prueba, solo si el campo no tiene uno propio.
    const [hasMap] = await tx.select({ farmId: schema.farmMaps.farmId }).from(schema.farmMaps).where(eq(schema.farmMaps.farmId, farmId)).limit(1);
    if (!hasMap && !own.length) {
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
    await loadSupplies(tx, farmId, userId, today, session.id);
    const added = await loadExtras(tx, farmId, userId, today);
    await loadOwners(tx, farmId, userId, today);
    return { created: rows.length + sheep.length + 1 + added, already: false };
  });
}

export async function clearDemo(farmId: string) {
  return db.transaction(async (tx) => {
    const demo = await tx.select({ id: schema.animals.id, saleId: schema.animals.saleId }).from(schema.animals).where(and(eq(schema.animals.farmId, farmId), isDemo()));
    const ids = demo.map((r) => r.id);
    const saleIds = [...new Set(demo.map((r) => r.saleId).filter(Boolean) as string[])];
    if (saleIds.length) await tx.delete(schema.sales).where(and(eq(schema.sales.farmId, farmId), inArray(schema.sales.id, saleIds)));
    if (ids.length) await tx.delete(schema.animals).where(inArray(schema.animals.id, ids)); // la sanidad se borra en cascada
    await tx
      .delete(schema.healthSessions)
      .where(and(eq(schema.healthSessions.farmId, farmId), inArray(schema.healthSessions.product, [DEMO_PRODUCT, DEMO_SHEARING])));
    await tx.delete(schema.paddocks).where(and(eq(schema.paddocks.farmId, farmId), inArray(schema.paddocks.name, DEMO_PADDOCKS.map((p) => p.name))));
    await tx.delete(schema.expenses).where(and(eq(schema.expenses.farmId, farmId), like(schema.expenses.concept, "%(prueba)")));
    await tx.delete(schema.owners).where(and(eq(schema.owners.farmId, farmId), like(schema.owners.name, "%(prueba)")));
    await tx.delete(schema.supplies).where(and(eq(schema.supplies.farmId, farmId), like(schema.supplies.name, "%(prueba)")));
    await tx.delete(schema.weatherLogs).where(and(eq(schema.weatherLogs.farmId, farmId), eq(schema.weatherLogs.note, "Dato de prueba")));
    await tx.delete(schema.farmMaps).where(and(eq(schema.farmMaps.farmId, farmId), like(schema.farmMaps.svg, `%"viewBox":"${DEMO_MAP_VIEWBOX}"%`)));
    return ids.length;
  });
}

export async function hasDemo(farmId: string) {
  const [row] = await db.select({ id: schema.animals.id }).from(schema.animals).where(and(eq(schema.animals.farmId, farmId), isDemo())).limit(1);
  return Boolean(row);
}
