import "server-only";
import postgres from "postgres";
import { and, eq, sql as dsql } from "drizzle-orm";
import { db, schema } from "@/db";
import { CATALOG, isSpeciesKey, type SpeciesKey } from "@/lib/catalogo";
import { todayISO } from "@/lib/dates";

/**
 * Importador desde campo-admin (Farm-Bot v3).
 *
 * - La base de origen se abre SOLO para leer: la conexión arranca con
 *   default_transaction_read_only y cada lectura va dentro de BEGIN READ ONLY.
 * - Cada fila de origen queda en archivo_origen tal cual (aunque no tenga lugar en Tranquera).
 * - Es idempotente: si una fila ya está en el archivo, no se vuelve a crear.
 */

export const SOURCE = "campo-admin";

/** Nombre de la variable de entorno con la conexión de solo lectura para este campo. */
export function sourceEnvName(slug: string) {
  return `ORIGEN_${slug.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
}

type Row = Record<string, unknown>;
type Currency = "USD" | "UYU";
export type ImportOptions = {
  expensesCurrency: Currency;
  ownersCurrency: Currency;
  healthCurrency: Currency;
};

/** Qué pasa con cada tabla de origen. */
const PLAN: Record<string, { label: string; target: string | null }> = {
  farm_settings: { label: "Datos del campo y mapa", target: "Datos del campo, marca y mapa" },
  owners: { label: "Propietarios", target: "Propietarios" },
  paddocks: { label: "Potreros", target: "Potreros" },
  horses: { label: "Animales", target: "Animales" },
  grazing_events: { label: "Pastoreo por animal", target: "Movimientos" },
  horse_groups: { label: "Tropillas o grupos", target: "Grupos" },
  horse_group_membership_periods: { label: "Pertenencia a grupos", target: "Grupos (historial)" },
  horse_group_membership_history: { label: "Historial de grupos (anterior)", target: "Grupos (historial)" },
  horse_group_memberships: { label: "Grupos actuales", target: "Grupos (historial)" },
  deworming_events: { label: "Desparasitaciones", target: "Sanidad" },
  farrier_events: { label: "Herrajes y desvasados", target: "Sanidad" },
  horse_health_events: { label: "Veterinaria y otros", target: "Sanidad" },
  treatment_plans: { label: "Planes de tratamiento", target: "Sanidad (cada dosis)" },
  treatment_logs: { label: "Dosis de tratamientos", target: "Sanidad" },
  feed_items: { label: "Insumos de alimentación", target: "Stock de insumos" },
  stock_events: { label: "Movimientos de stock", target: "Stock de insumos" },
  rain_registry: { label: "Lluvias", target: "Clima" },
  frost_registry: { label: "Heladas", target: "Clima" },
  general_expenses: { label: "Gastos generales", target: "Gastos" },
  owner_feed_purchases: { label: "Compras de ración a cuenta del dueño", target: "Gastos (imputados al dueño)" },
  farm_visits: { label: "Agenda y visitas", target: "Tareas del calendario" },
  pasture_measurements: { label: "Mediciones de pasto", target: "Mediciones de pasto" },
  paddock_work_events: { label: "Laboreos", target: "Laboreos" },
  owner_billing_rates: { label: "Tarifas de pensión por caballo", target: "Pensión (tarifas)" },
  owner_ledger_entries: { label: "Cuenta de propietarios (cargos y pagos)", target: "Cuenta del propietario" },
  feed_events: { label: "Raciones dadas", target: null },
  horse_feed_plan_items: { label: "Plan de ración", target: null },
  horse_feed_slot_entries: { label: "Raciones marcadas por turno", target: null },
  paddock_shared_grazing: { label: "Pastoreo por grupo", target: null },
  movement_batches: { label: "Tandas de movimientos", target: null },
  expense_split_drafts: { label: "Borradores de reparto de gastos", target: null },
  admin_module_settings: { label: "Módulos prendidos", target: null },
};

function openSource(url: string) {
  return postgres(url, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 15,
    connection: { default_transaction_read_only: true, application_name: "tranquera-importador" },
    // Las columnas DATE llegan como texto AAAA-MM-DD: sin corrimientos por zona horaria.
    types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
  });
}

type SourceData = { tables: string[]; rows: Record<string, Row[]> };

/** Lee todas las tablas del esquema public de origen, dentro de una transacción de solo lectura. */
export async function readSource(url: string): Promise<SourceData> {
  const src = openSource(url);
  try {
    return await src.begin("read only", async (tx) => {
      const tables = (
        await tx<{ table_name: string }[]>`
          select table_name from information_schema.tables
          where table_schema = 'public' and table_type = 'BASE TABLE'
          order by table_name`
      ).map((r) => r.table_name);
      const rows: Record<string, Row[]> = {};
      for (const t of tables) {
        rows[t] = (await tx.unsafe(`select * from "${t.replace(/"/g, '""')}"`)) as unknown as Row[];
      }
      return { tables, rows };
    });
  } finally {
    await src.end({ timeout: 5 });
  }
}

/** Conecta y cuenta filas, sin traer todo (para mostrar el estado). */
export async function probeSource(url: string) {
  const src = openSource(url);
  try {
    return await src.begin("read only", async (tx) => {
      const [ro] = await tx<{ ro: string }[]>`show transaction_read_only`;
      const tables = await tx<{ table_name: string }[]>`
        select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`;
      const counts: { table: string; rows: number }[] = [];
      for (const { table_name } of tables) {
        const [c] = (await tx.unsafe(`select count(*)::int as n from "${table_name.replace(/"/g, '""')}"`)) as unknown as { n: number }[];
        counts.push({ table: table_name, rows: c.n });
      }
      const writable = await tx<{ t: string }[]>`
        select c.relname as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege(c.oid, 'INSERT') limit 1`;
      return { readOnly: ro.ro === "on", roleCanWrite: writable.length > 0, counts };
    });
  } finally {
    await src.end({ timeout: 5 });
  }
}

export function planFor(table: string) {
  return PLAN[table] ?? { label: table, target: null };
}

// ---------- conversiones ----------

const str = (v: unknown) => (v === null || v === undefined ? null : String(v).trim() || null);
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
function day(v: unknown): string | null {
  if (!v) return null;
  // Fecha y hora (timestamptz): el día en hora de Uruguay.
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : todayISO(v);
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}
const json = (r: Row) => JSON.stringify(r, (_k, v) => (typeof v === "bigint" ? v.toString() : v));

const SEX: Record<string, string> = { hembra: "hembra", macho: "macho", castrado: "castrado", mare: "hembra", filly: "hembra", stallion: "macho", colt: "macho", gelding: "castrado" };
const TRAINING: Record<string, string> = { "breaking in": "en_doma", "in training": "domado" };
const FROST: Record<string, string> = { light: "leve", moderate: "moderada", heavy: "fuerte" };
const WORK: Record<string, string> = { soil_prep: "laboreo", seeding: "siembra", fertilizer: "fertilizacion", spraying: "herbicida", ready_check: "otro", other: "otro" };
const EXPENSE: Array<[RegExp, string]> = [
  [/sanid|vet|vacun|remedi|desparas/i, "sanidad"],
  [/raci|fardo|alimen|pastur|semill|forraj/i, "alimentacion"],
  [/sueld|jornal|peon|peón|personal/i, "personal"],
  [/combust|gasoil|nafta/i, "combustible"],
  [/alambr|aguad|manten|repar|herram/i, "mantenimiento"],
  [/flete|guía|guia/i, "fletes"],
  [/bps|contribu|impuest|dicose/i, "impuestos"],
  [/arrend/i, "arrendamiento"],
];
const expenseCategory = (raw: string | null) => (raw ? (EXPENSE.find(([re]) => re.test(raw))?.[1] ?? "otros") : "otros");
const HEALTH_LABEL: Record<string, string> = {
  veterinaria: "Veterinaria",
  vet: "Veterinaria",
  control: "Control",
  vacuna: "Vacuna",
  tratamiento: "Tratamiento",
  medicacion: "Medicación",
  lesion: "Lesión",
  otro: "Otro",
};

export type ImportReport = {
  tables: { table: string; label: string; target: string | null; source: number; archived: number; created: number; linked: number }[];
  warnings: string[];
  dryRun: boolean;
};

/**
 * Corre la importación. Con dryRun no escribe nada en Tranquera: todo pasa dentro de una
 * transacción que se deshace al final, y devuelve el mismo informe.
 */
export async function runImport(farmId: string, userId: string, data: SourceData, opts: ImportOptions, dryRun: boolean): Promise<ImportReport> {
  const ROLLBACK = Symbol("rollback");
  let report: ImportReport | null = null;
  try {
    await db.transaction(async (tx) => {
      report = await importInto(tx, farmId, userId, data, opts, dryRun);
      if (dryRun) throw ROLLBACK;
    });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }
  return report!;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function importInto(tx: Tx, farmId: string, userId: string, data: SourceData, opts: ImportOptions, dryRun: boolean): Promise<ImportReport> {
  const today = todayISO();
  const warnings: string[] = [];
  const stats = new Map<string, { created: number; linked: number }>();
  const stat = (t: string) => {
    if (!stats.has(t)) stats.set(t, { created: 0, linked: 0 });
    return stats.get(t)!;
  };
  const rows = (t: string) => data.rows[t] ?? [];

  // Lo ya importado antes: tabla:id → destino.
  const prior = await tx
    .select({ table: schema.importArchive.table, sourceId: schema.importArchive.sourceId, targetId: schema.importArchive.targetId })
    .from(schema.importArchive)
    .where(and(eq(schema.importArchive.farmId, farmId), eq(schema.importArchive.source, SOURCE)));
  // Solo cuenta como hecho lo que ya tiene destino: lo que quedó solo en el archivo
  // se vuelve a intentar (por ejemplo, cuando Tranquera suma una función nueva).
  const done = new Map(prior.filter((p) => p.targetId).map((p) => [`${p.table}:${p.sourceId}`, p.targetId]));
  const archived = new Set(prior.map((p) => `${p.table}:${p.sourceId}`));
  const pending: (typeof schema.importArchive.$inferInsert)[] = [];
  const relinked: { table: string; sourceId: string; targetTable: string; targetId: string }[] = [];
  const archive = (table: string, r: Row, targetTable: string | null, targetId: string | null) => {
    const sourceId = String(r.id ?? r.module_key ?? json(r).slice(0, 200));
    const key = `${table}:${sourceId}`;
    const wasDone = done.has(key);
    if (targetId) done.set(key, targetId);
    if (archived.has(key)) {
      if (targetId && targetTable && !wasDone) relinked.push({ table, sourceId, targetTable, targetId });
      return;
    }
    archived.add(key);
    pending.push({ farmId, source: SOURCE, table, sourceId, data: json(r), targetTable, targetId });
  };
  const target = (table: string, id: unknown) => (id === null || id === undefined ? null : (done.get(`${table}:${String(id)}`) ?? null));
  const isNew = (table: string, id: unknown) => !done.has(`${table}:${String(id)}`);

  // ---- Datos del campo y mapa ----
  const [farm] = await tx.select().from(schema.farms).where(eq(schema.farms.id, farmId)).limit(1);
  for (const r of rows("farm_settings")) {
    if (isNew("farm_settings", r.id)) {
      await tx
        .update(schema.farms)
        .set({
          locationText: farm.locationText ?? str(r.location_text),
          hectares: farm.hectares ?? num(r.total_hectares),
          latitude: farm.latitude ?? num(r.weather_latitude),
          longitude: farm.longitude ?? num(r.weather_longitude),
          logo: farm.logo ?? str(r.brand_logo),
          updatedAt: new Date(),
        })
        .where(eq(schema.farms.id, farmId));
      stat("farm_settings").created++;
    }
    archive("farm_settings", r, "campos", farmId);
  }

  // ---- Propietarios ----
  const rates = rows("owner_billing_rates");
  for (const r of rows("owners")) {
    let id = target("owners", r.id);
    if (!id) {
      const name = str(r.name) ?? `Propietario ${r.id}`;
      const own = name.toLowerCase() === farm.name.toLowerCase();
      const fee = rates
        .filter((x) => String(x.owner_id) === String(r.id) && !x.valid_to)
        .reduce((n, x) => n + (num(x.rate_per_month) ?? 0), 0);
      // El dueño "campo" se une al que ya exista en Tranquera (hay uno solo por campo).
      const [existing] = await tx
        .select({ id: schema.owners.id })
        .from(schema.owners)
        .where(
          and(
            eq(schema.owners.farmId, farmId),
            eq(schema.owners.active, true),
            own ? dsql`(lower(${schema.owners.name}) = lower(${name}) or ${schema.owners.kind} = 'campo')` : dsql`lower(${schema.owners.name}) = lower(${name})`,
          ),
        )
        .limit(1);
      if (existing) {
        id = existing.id;
        stat("owners").linked++;
      } else {
        const [row] = await tx
          .insert(schema.owners)
          .values({
            farmId,
            name,
            kind: own ? "campo" : "tercero",
            phone: str(r.phone),
            monthlyFee: !own && fee > 0 && !rows("owner_billing_rates").length ? fee.toFixed(2) : null,
            currency: opts.ownersCurrency,
            notes: [str(r.email), str(r.notes)].filter(Boolean).join(" · ") || null,
          })
          .returning({ id: schema.owners.id });
        id = row.id;
        stat("owners").created++;
      }
    }
    archive("owners", r, "propietarios", id);
  }

  // ---- Potreros (por nombre; primero todos, después el padre) ----
  const existingPaddocks = await tx.select({ id: schema.paddocks.id, name: schema.paddocks.name }).from(schema.paddocks).where(eq(schema.paddocks.farmId, farmId));
  for (const r of rows("paddocks")) {
    let id = target("paddocks", r.id);
    if (!id) {
      const name = str(r.name) ?? `Potrero ${r.id}`;
      const match = existingPaddocks.find((p) => p.name.toLowerCase() === name.toLowerCase());
      const values = {
        hectares: num(r.size_ha),
        zone: str(r.zone),
        restSince: day(r.manual_rest_started_on),
        notes: [str(r.notes), str(r.location_type) && r.location_type !== "paddock" ? `Tipo en campo-admin: ${r.location_type}` : null].filter(Boolean).join(" · ") || null,
      };
      if (match) {
        await tx
          .update(schema.paddocks)
          .set({
            hectares: dsql`coalesce(${schema.paddocks.hectares}, ${values.hectares})`,
            zone: dsql`coalesce(${schema.paddocks.zone}, ${values.zone})`,
            restSince: dsql`coalesce(${schema.paddocks.restSince}, ${values.restSince}::date)`,
            notes: dsql`coalesce(${schema.paddocks.notes}, ${values.notes})`,
            updatedAt: new Date(),
          })
          .where(eq(schema.paddocks.id, match.id));
        id = match.id;
        stat("paddocks").linked++;
      } else {
        const [row] = await tx
          .insert(schema.paddocks)
          .values({ farmId, name, ...values, active: r.active !== false })
          .returning({ id: schema.paddocks.id });
        existingPaddocks.push({ id: row.id, name });
        id = row.id;
        stat("paddocks").created++;
      }
    }
    archive("paddocks", r, "potreros", id);
  }
  for (const r of rows("paddocks")) {
    const id = target("paddocks", r.id);
    const parent = target("paddocks", r.parent_paddock_id);
    if (id && parent && parent !== id) {
      await tx.update(schema.paddocks).set({ parentId: parent }).where(and(eq(schema.paddocks.id, id), dsql`${schema.paddocks.parentId} is null`));
    }
  }

  // Mapa: solo si el campo no tiene uno.
  const settings = rows("farm_settings")[0];
  const mapConfig = settings?.paddock_map_config ? (typeof settings.paddock_map_config === "string" ? JSON.parse(settings.paddock_map_config) : settings.paddock_map_config) : null;
  if (mapConfig?.view_box && Array.isArray(mapConfig.shapes) && mapConfig.shapes.length) {
    const [hasMap] = await tx.select({ id: schema.farmMaps.farmId }).from(schema.farmMaps).where(eq(schema.farmMaps.farmId, farmId)).limit(1);
    if (!hasMap) {
      const shapes = [
        ...(mapConfig.boundary_d ? [{ tag: "path", attrs: { d: String(mapConfig.boundary_d) }, transform: "", name: "", background: true }] : []),
        ...mapConfig.shapes
          .filter((s: Row) => s?.d && s?.name)
          .map((s: Row) => ({ tag: "path", attrs: { d: String(s.d) }, transform: "", name: String(s.name).trim() })),
      ];
      await tx.insert(schema.farmMaps).values({ farmId, svg: JSON.stringify({ viewBox: String(mapConfig.view_box), shapes }) });
      for (const s of shapes.filter((x) => x.name)) {
        await tx
          .update(schema.paddocks)
          .set({ svgId: s.name })
          .where(and(eq(schema.paddocks.farmId, farmId), dsql`lower(${schema.paddocks.name}) = lower(${s.name})`));
      }
      stat("farm_settings").created++;
    }
  }

  // ---- Animales ----
  const speciesSeen = new Set<SpeciesKey>();
  const unknownSpecies = new Set<string>();
  for (const r of rows("horses")) {
    let id = target("horses", r.id);
    const speciesRaw = (str(r.species) ?? "caballo").toLowerCase();
    if (!isSpeciesKey(speciesRaw)) {
      unknownSpecies.add(speciesRaw);
      archive("horses", r, null, null);
      continue;
    }
    speciesSeen.add(speciesRaw);
    if (!id) {
      const extra = [
        str(r.activity) ? `Actividad: ${r.activity}` : null,
        str(r.purpose) && r.purpose !== "placer" ? `Uso: ${r.purpose}` : null,
        str(r.lot_tags) ? `Caravanas del lote: ${r.lot_tags}` : null,
        day(r.identified_on) ? `Identificado el ${day(r.identified_on)}` : null,
        str(r.training_status) && !TRAINING[String(r.training_status)] ? `Doma: ${r.training_status}` : null,
      ].filter(Boolean);
      const isLot = r.is_lot === true;
      const [row] = await tx
        .insert(schema.animals)
        .values({
          farmId,
          species: speciesRaw,
          category: str(r.category),
          sex: SEX[String(r.sex ?? "").toLowerCase()] ?? null,
          name: str(r.name),
          tagVisual: str(r.tag_visual) ?? str(r.tag_number),
          birthDate: day(r.date_of_birth),
          breed: str(r.breed),
          color: str(r.color),
          training: TRAINING[String(r.training_status ?? "")] ?? null,
          origin: r.origin === "nacido" || r.origin === "comprado" ? (r.origin as string) : null,
          originDetail: str(r.origin_detail),
          arrivedOn: day(r.arrived_on),
          isLot,
          headCount: isLot ? Math.max(1, num(r.head_count) ?? 1) : 1,
          ownerId: target("owners", r.owner_id),
          notes: extra.length ? extra.join(" · ") : null,
          createdBy: userId,
        })
        .returning({ id: schema.animals.id });
      id = row.id;
      stat("horses").created++;
    }
    archive("horses", r, "animales", id);
  }
  if (unknownSpecies.size) warnings.push(`Animales de especies que Tranquera no maneja (${[...unknownSpecies].join(", ")}): quedaron solo en el archivo.`);
  for (const sp of speciesSeen) {
    await tx
      .insert(schema.farmSpecies)
      .values({ farmId, speciesKey: sp, active: true, orientations: sp === "caballo" ? ["pension"] : [], sells: 1 })
      .onConflictDoUpdate({ target: [schema.farmSpecies.farmId, schema.farmSpecies.speciesKey], set: { active: true, updatedAt: new Date() } });
  }
  const animal = (id: unknown) => target("horses", id);

  // ---- Pastoreo → movimientos y potrero actual ----
  const byHorse = new Map<string, Row[]>();
  for (const r of rows("grazing_events")) {
    const key = String(r.horse_id);
    byHorse.set(key, [...(byHorse.get(key) ?? []), r]);
  }
  for (const [horseId, events] of byHorse) {
    const animalId = animal(horseId);
    events.sort((a, b) => String(day(a.entered_at)).localeCompare(String(day(b.entered_at))) || Number(a.id) - Number(b.id));
    let current: string | null = null;
    let changed = false;
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      const paddockId = target("paddocks", e.paddock_id);
      if (!animalId || !paddockId) {
        archive("grazing_events", e, null, null);
        continue;
      }
      const prev = events[i - 1];
      const next = events[i + 1];
      const entered = day(e.entered_at)!;
      const exited = day(e.exited_at);
      if (isNew("grazing_events", e.id)) {
        const prevPaddock = prev ? target("paddocks", prev.paddock_id) : null;
        const fromPrev = prev && day(prev.exited_at) && day(prev.exited_at)! <= entered && day(prev.exited_at)! >= addDaysLocal(entered, -1) ? prevPaddock : null;
        const batchId = crypto.randomUUID();
        const [mv] = await tx
          .insert(schema.movements)
          .values({ farmId, animalId, fromPaddockId: fromPrev, toPaddockId: paddockId, date: entered, batchId, note: str(e.entry_notes), createdBy: userId })
          .returning({ id: schema.movements.id });
        // Salida sin otra entrada inmediata: queda sin potrero.
        const nextEntered = next ? day(next.entered_at) : null;
        if (exited && !(nextEntered && nextEntered <= addDaysLocal(exited, 1))) {
          await tx.insert(schema.movements).values({ farmId, animalId, fromPaddockId: paddockId, toPaddockId: null, date: exited, batchId: crypto.randomUUID(), note: str(e.exit_notes), createdBy: userId });
        }
        stat("grazing_events").created++;
        changed = true;
        archive("grazing_events", e, "movimientos", mv.id);
      } else archive("grazing_events", e, null, null);
      current = exited ? null : paddockId;
    }
    // Solo si hubo pastoreo nuevo: si ya se importó antes, lo que se movió en Tranquera manda.
    if (animalId && changed) await tx.update(schema.animals).set({ paddockId: current }).where(eq(schema.animals.id, animalId));
  }

  // ---- Grupos ----
  for (const r of rows("horse_groups")) {
    let id = target("horse_groups", r.id);
    if (!id) {
      const name = str(r.name) ?? `Grupo ${r.id}`;
      const [existing] = await tx.select({ id: schema.herds.id }).from(schema.herds).where(and(eq(schema.herds.farmId, farmId), dsql`lower(${schema.herds.name}) = lower(${name})`)).limit(1);
      if (existing) {
        id = existing.id;
        stat("horse_groups").linked++;
      } else {
        const [row] = await tx.insert(schema.herds).values({ farmId, name, notes: str(r.notes), active: r.active !== false }).returning({ id: schema.herds.id });
        id = row.id;
        stat("horse_groups").created++;
      }
    }
    archive("horse_groups", r, "grupos", id);
  }
  // Historial: períodos (lo más completo); si no hay, el historial viejo; si no, la pertenencia actual.
  const periodSources: [string, (r: Row) => { from: string | null; to: string | null }][] = [
    ["horse_group_membership_periods", (r) => ({ from: day(r.started_at), to: day(r.ended_at) })],
    ["horse_group_membership_history", (r) => ({ from: day(r.started_at), to: day(r.ended_at) })],
    ["horse_group_memberships", (r) => ({ from: day(r.created_at) ?? today, to: null })],
  ];
  const usedPeriods = periodSources.find(([t]) => rows(t).length)?.[0];
  for (const [t, dates] of periodSources) {
    for (const r of rows(t)) {
      if (t !== usedPeriods || !isNew(t, r.id)) {
        archive(t, r, null, null);
        continue;
      }
      const herdId = target("horse_groups", r.group_id);
      const animalId = animal(r.horse_id);
      const { from, to } = dates(r);
      if (!herdId || !animalId || !from) {
        archive(t, r, null, null);
        continue;
      }
      const [row] = await tx.insert(schema.herdMembers).values({ farmId, herdId, animalId, from, to }).returning({ id: schema.herdMembers.id });
      stat(t).created++;
      archive(t, r, "grupo_miembros", row.id);
    }
  }

  // ---- Sanidad ----
  const health = async (table: string, r: Row, v: Partial<typeof schema.healthEvents.$inferInsert> & { control: string; label: string }) => {
    const animalId = animal(r.horse_id);
    const date = day(r.event_date);
    if (!isNew(table, r.id)) return archive(table, r, null, null);
    if (!animalId || !date) return archive(table, r, null, null);
    const cost = num(r.cost_amount);
    const [row] = await tx
      .insert(schema.healthEvents)
      .values({ farmId, animalId, date, ...v, cost: cost !== null ? cost.toFixed(2) : null, currency: cost !== null ? opts.healthCurrency : null, createdBy: userId })
      .returning({ id: schema.healthEvents.id });
    stat(table).created++;
    archive(table, r, "sanidad", row.id);
  };
  for (const r of rows("deworming_events"))
    await health("deworming_events", r, {
      control: "desparasitacion",
      label: "Desparasitación",
      product: str(r.product_name),
      nextDueDate: day(r.next_due_date),
      notes: day(r.second_dose_date) ? `Segunda dosis: ${day(r.second_dose_date)}` : null,
    });
  for (const r of rows("farrier_events"))
    await health("farrier_events", r, {
      control: "herraje",
      label: "Herraje o desvasado",
      product: str(r.service_type),
      nextDueDate: day(r.next_due_date),
      notes: str(r.notes),
    });
  for (const r of rows("horse_health_events")) {
    const type = (str(r.event_type) ?? "otro").toLowerCase();
    const label = str(r.description)?.slice(0, 80) ?? HEALTH_LABEL[type] ?? type;
    await health("horse_health_events", r, {
      control: `otro:${type.slice(0, 50)}`,
      label,
      notes: [str(r.description) && str(r.description)!.length > 80 ? str(r.description) : null, str(r.notes)].filter(Boolean).join(" · ") || null,
    });
  }
  // Tratamientos: cada dosis dada va a sanidad; el plan queda en el archivo (y en la nota).
  const plans = new Map(rows("treatment_plans").map((p) => [String(p.id), p]));
  const logged = new Set(rows("treatment_logs").map((l) => String(l.treatment_plan_id)));
  for (const l of rows("treatment_logs")) {
    const p = plans.get(String(l.treatment_plan_id));
    if (!p) {
      archive("treatment_logs", l, null, null);
      continue;
    }
    await health("treatment_logs", { ...l, horse_id: p.horse_id, event_date: day(l.administered_at) }, {
      control: "otro:tratamiento",
      label: `Tratamiento: ${str(p.medication) ?? "sin nombre"}`.slice(0, 80),
      dose: str(p.dosage),
      notes: [str(p.frequency) ? `Frecuencia: ${p.frequency}` : null, num(p.duration_days) ? `${p.duration_days} días` : null, str(l.notes)].filter(Boolean).join(" · ") || null,
    });
  }
  for (const p of rows("treatment_plans")) {
    if (logged.has(String(p.id))) {
      archive("treatment_plans", p, null, null);
      continue;
    }
    await health("treatment_plans", { ...p, event_date: p.start_date }, {
      control: "otro:tratamiento",
      label: `Tratamiento: ${str(p.medication) ?? "sin nombre"}`.slice(0, 80),
      dose: str(p.dosage),
      notes: [str(p.frequency) ? `Frecuencia: ${p.frequency}` : null, num(p.duration_days) ? `${p.duration_days} días` : null, "Plan sin dosis registradas"].filter(Boolean).join(" · "),
    });
  }

  // ---- Insumos y stock: el saldo final queda igual al de campo-admin ----
  for (const r of rows("feed_items")) {
    let id = target("feed_items", r.id);
    const name = str(r.name) ?? `Insumo ${r.id}`;
    if (!id) {
      const [existing] = await tx.select({ id: schema.supplies.id }).from(schema.supplies).where(and(eq(schema.supplies.farmId, farmId), dsql`lower(${schema.supplies.name}) = lower(${name})`)).limit(1);
      if (existing) {
        id = existing.id;
        stat("feed_items").linked++;
      } else {
        const [row] = await tx.insert(schema.supplies).values({ farmId, name, category: "alimento", unit: str(r.unit) ?? "kg" }).returning({ id: schema.supplies.id });
        id = row.id;
        stat("feed_items").created++;
      }
      // Movimientos de stock del item.
      let total = 0;
      for (const e of rows("stock_events").filter((x) => String(x.feed_item_id) === String(r.id))) {
        const q = Math.abs(num(e.quantity) ?? 0);
        const type = String(e.event_type ?? "").toLowerCase();
        const signed = /add|in|entr|compra|purchase|restock/.test(type) ? q : -q;
        total += signed;
        const [mv] = await tx
          .insert(schema.supplyMoves)
          .values({ farmId, supplyId: id, date: day(e.event_date) ?? today, quantity: signed, note: str(e.notes) ?? `campo-admin: ${type || "movimiento"}`, createdBy: userId })
          .returning({ id: schema.supplyMoves.id });
        stat("stock_events").created++;
        archive("stock_events", e, "insumos_movimientos", mv.id);
      }
      const current = num(r.current_stock) ?? 0;
      if (Math.abs(current - total) > 0.001) {
        await tx.insert(schema.supplyMoves).values({ farmId, supplyId: id, date: today, quantity: current - total, note: "Ajuste al importar (saldo de campo-admin)", createdBy: userId });
      }
    }
    archive("feed_items", r, "insumos", id);
  }
  for (const e of rows("stock_events")) archive("stock_events", e, null, null);

  // ---- Clima ----
  const weather = new Map<string, { rain: number | null; tmin: number | null; tmax: number | null; frost: string | null; notes: string[] }>();
  for (const r of rows("rain_registry")) {
    const d = day(r.event_date);
    if (!d) continue;
    const w = weather.get(d) ?? { rain: null, tmin: null, tmax: null, frost: null, notes: [] };
    w.rain = num(r.rain_mm);
    w.tmin = num(r.min_temp_c);
    w.tmax = num(r.max_temp_c);
    if (str(r.notes)) w.notes.push(str(r.notes)!);
    weather.set(d, w);
  }
  for (const r of rows("frost_registry")) {
    const d = day(r.event_date);
    if (!d) continue;
    const w = weather.get(d) ?? { rain: null, tmin: null, tmax: null, frost: null, notes: [] };
    w.frost = FROST[String(r.intensity)] ?? "leve";
    if (str(r.notes)) w.notes.push(str(r.notes)!);
    weather.set(d, w);
  }
  const existingDays = new Set(
    (await tx.select({ date: schema.weatherLogs.date }).from(schema.weatherLogs).where(eq(schema.weatherLogs.farmId, farmId))).map((x) => x.date),
  );
  const weatherIds = new Map<string, string>();
  for (const [d, w] of weather) {
    if (existingDays.has(d)) continue;
    const [row] = await tx
      .insert(schema.weatherLogs)
      .values({ farmId, date: d, rainMm: w.rain, frost: Boolean(w.frost), frostIntensity: w.frost, tempMin: w.tmin, tempMax: w.tmax, note: w.notes.join(" · ") || null, createdBy: userId })
      .returning({ id: schema.weatherLogs.id });
    weatherIds.set(d, row.id);
  }
  for (const t of ["rain_registry", "frost_registry"]) {
    for (const r of rows(t)) {
      const id = weatherIds.get(day(r.event_date) ?? "");
      if (id && isNew(t, r.id)) stat(t).created++;
      archive(t, r, id ? "registros_clima" : null, id ?? null);
    }
  }

  // ---- Gastos ----
  for (const r of rows("general_expenses")) {
    const amount = num(r.amount);
    if (!isNew("general_expenses", r.id) || !amount || amount <= 0) {
      archive("general_expenses", r, null, null);
      continue;
    }
    const [row] = await tx
      .insert(schema.expenses)
      .values({
        farmId,
        date: day(r.expense_date) ?? today,
        concept: (str(r.description) ?? "Gasto").slice(0, 120),
        category: expenseCategory(str(r.category) ?? str(r.description)),
        amount: amount.toFixed(2),
        currency: opts.expensesCurrency,
        notes: [str(r.category) ? `Categoría en campo-admin: ${r.category}` : null, str(r.notes)].filter(Boolean).join(" · ") || null,
        createdBy: userId,
      })
      .returning({ id: schema.expenses.id });
    stat("general_expenses").created++;
    archive("general_expenses", r, "gastos", row.id);
  }
  for (const r of rows("owner_feed_purchases")) {
    const amount = num(r.amount);
    if (!isNew("owner_feed_purchases", r.id) || !amount || amount <= 0) {
      archive("owner_feed_purchases", r, null, null);
      continue;
    }
    const [row] = await tx
      .insert(schema.expenses)
      .values({
        farmId,
        date: day(r.purchase_date) ?? today,
        concept: `${str(r.product_name) ?? "Ración"}${str(r.quantity_label) ? ` (${r.quantity_label})` : ""}`.slice(0, 120),
        category: "alimentacion",
        amount: amount.toFixed(2),
        currency: opts.ownersCurrency,
        ownerId: target("owners", r.owner_id),
        notes: str(r.notes),
        createdBy: userId,
      })
      .returning({ id: schema.expenses.id });
    stat("owner_feed_purchases").created++;
    archive("owner_feed_purchases", r, "gastos", row.id);
  }

  // ---- Pensión y cuenta corriente ----
  for (const r of rows("owner_billing_rates")) {
    const ownerId = target("owners", r.owner_id);
    const from = day(r.valid_from);
    const monthly = num(r.rate_per_month);
    if (!isNew("owner_billing_rates", r.id) || !ownerId || !from || monthly === null) {
      archive("owner_billing_rates", r, null, null);
      continue;
    }
    const [row] = await tx
      .insert(schema.boardRates)
      .values({ farmId, ownerId, animalId: animal(r.horse_id), monthly: monthly.toFixed(2), currency: opts.ownersCurrency, from, to: day(r.valid_to), notes: str(r.notes) })
      .returning({ id: schema.boardRates.id });
    stat("owner_billing_rates").created++;
    archive("owner_billing_rates", r, "tarifas", row.id);
  }
  for (const r of rows("owner_ledger_entries")) {
    const ownerId = target("owners", r.owner_id);
    const amount = num(r.amount);
    if (!isNew("owner_ledger_entries", r.id) || !ownerId || amount === null || amount === 0) {
      archive("owner_ledger_entries", r, null, null);
      continue;
    }
    const pago = String(r.entry_type) === "payment";
    const [row] = await tx
      .insert(schema.ledger)
      .values({
        farmId,
        ownerId,
        kind: pago ? "pago" : "cargo",
        date: day(r.entry_date) ?? today,
        amount: Math.abs(amount).toFixed(2),
        currency: opts.ownersCurrency,
        concept: (str(r.description) ?? (pago ? "Pago" : "Cargo")).slice(0, 120),
        notes: str(r.notes),
        createdBy: userId,
      })
      .returning({ id: schema.ledger.id });
    stat("owner_ledger_entries").created++;
    archive("owner_ledger_entries", r, "cuenta_movimientos", row.id);
  }

  // ---- Agenda → tareas ----
  const VISIT: Record<string, string> = { visit: "Visita", deworming: "Desparasitada", farrier: "Desvasada / herrado", vet: "Veterinaria", note: "Nota" };
  for (const r of rows("farm_visits")) {
    const date = day(r.event_date);
    if (!isNew("farm_visits", r.id) || !date) {
      archive("farm_visits", r, null, null);
      continue;
    }
    const animalId = animal(r.horse_id);
    const [an] = animalId ? await tx.select({ name: schema.animals.name, tag: schema.animals.tagVisual }).from(schema.animals).where(eq(schema.animals.id, animalId)).limit(1) : [];
    const doneStatus = /done|complet|hech|listo/i.test(String(r.status ?? ""));
    const [row] = await tx
      .insert(schema.tasks)
      .values({
        farmId,
        date,
        title: (str(r.title) ?? VISIT[String(r.category)] ?? "Tarea").slice(0, 120),
        notes: [VISIT[String(r.category)] && str(r.title) ? VISIT[String(r.category)] : null, an ? `Animal: ${an.name ?? an.tag}` : null, str(r.farm_name), str(r.notes)].filter(Boolean).join(" · ") || null,
        doneAt: doneStatus ? new Date(`${date}T12:00:00Z`) : null,
        createdBy: userId,
      })
      .returning({ id: schema.tasks.id });
    stat("farm_visits").created++;
    archive("farm_visits", r, "tareas", row.id);
  }

  // ---- Pasto y laboreos ----
  for (const r of rows("pasture_measurements")) {
    const paddockId = target("paddocks", r.paddock_id);
    const kg = num(r.kg_dm_per_ha);
    const date = day(r.measured_on);
    if (!isNew("pasture_measurements", r.id) || !paddockId || kg === null || !date) {
      archive("pasture_measurements", r, null, null);
      continue;
    }
    const [row] = await tx
      .insert(schema.pastureReadings)
      .values({
        farmId,
        paddockId,
        date,
        kgDmHa: kg,
        detail: JSON.stringify({ muestras: r.sample_grams ?? [], area_m2: num(r.frame_area_m2), modo: r.weigh_mode === "dry" ? "seco" : "verde", ms_pct: num(r.dry_matter_pct), altura: str(r.cut_height) }),
        notes: [str(r.notes), str(r.created_by)].filter(Boolean).join(" · ") || null,
        createdBy: userId,
      })
      .returning({ id: schema.pastureReadings.id });
    stat("pasture_measurements").created++;
    archive("pasture_measurements", r, "mediciones_pasto", row.id);
  }
  for (const r of rows("paddock_work_events")) {
    const paddockId = target("paddocks", r.paddock_id);
    const date = day(r.event_date);
    if (!isNew("paddock_work_events", r.id) || !paddockId || !date) {
      archive("paddock_work_events", r, null, null);
      continue;
    }
    const type = String(r.event_type ?? "other");
    const [row] = await tx
      .insert(schema.fieldWorks)
      .values({
        farmId,
        paddockId,
        kind: WORK[type] ?? "otro",
        date,
        readyOn: day(r.ready_to_graze_on) ?? (num(r.ready_after_days) ? addDaysLocal(date, num(r.ready_after_days)!) : null),
        doneBy: str(r.performed_by),
        notes: [type === "ready_check" ? "Chequeo de ingreso" : null, !WORK[type] ? `Tipo: ${type}` : null, str(r.notes)].filter(Boolean).join(" · ") || null,
        createdBy: userId,
      })
      .returning({ id: schema.fieldWorks.id });
    stat("paddock_work_events").created++;
    archive("paddock_work_events", r, "laboreos", row.id);
  }

  // ---- Todo lo demás: al archivo ----
  for (const t of data.tables) for (const r of rows(t)) archive(t, r, null, null);
  for (let i = 0; i < pending.length; i += 500) {
    await tx.insert(schema.importArchive).values(pending.slice(i, i + 500)).onConflictDoNothing();
  }
  for (const r of relinked) {
    await tx
      .update(schema.importArchive)
      .set({ targetTable: r.targetTable, targetId: r.targetId })
      .where(
        and(
          eq(schema.importArchive.farmId, farmId),
          eq(schema.importArchive.source, SOURCE),
          eq(schema.importArchive.table, r.table),
          eq(schema.importArchive.sourceId, r.sourceId),
        ),
      );
  }

  // ---- Informe ----
  const archivedCounts = await tx
    .select({ table: schema.importArchive.table, n: dsql<number>`count(*)::int`, linked: dsql<number>`count(${schema.importArchive.targetId})::int` })
    .from(schema.importArchive)
    .where(and(eq(schema.importArchive.farmId, farmId), eq(schema.importArchive.source, SOURCE)))
    .groupBy(schema.importArchive.table);
  const tables = data.tables
    .map((t) => {
      const p = planFor(t);
      const a = archivedCounts.find((x) => x.table === t);
      return { table: t, label: p.label, target: p.target, source: rows(t).length, archived: a?.n ?? 0, created: stats.get(t)?.created ?? 0, linked: a?.linked ?? 0 };
    })
    .sort((a, b) => Number(b.target !== null) - Number(a.target !== null) || a.label.localeCompare(b.label, "es"));
  const missing = tables.filter((t) => t.archived < t.source);
  if (missing.length) warnings.push(`No quedaron archivadas todas las filas de: ${missing.map((m) => m.label).join(", ")}.`);
  for (const t of ["horse_feed_plan_items"]) {
    if (rows(t).length) warnings.push(`${planFor(t).label}: ${rows(t).length} registros quedan guardados en el archivo; se pueden activar más adelante.`);
  }
  return { tables, warnings, dryRun };
}

function addDaysLocal(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const SPECIES_LABEL = (k: string) => (isSpeciesKey(k) ? CATALOG[k].plural : k);
