import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  date,
  doublePrecision,
  primaryKey,
  index,
  uniqueIndex,
  numeric,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/**
 * Roles dentro de un campo.
 * - dueno: todo, incluido borrar el campo y manejar otros dueños.
 * - encargado: todo lo del día a día y la configuración, menos dueños.
 * - operario: carga datos del campo (animales, sanidad, movimientos).
 * - veterinario: ve animales y carga sanidad.
 * - lector: solo mira.
 */
export const roleEnum = pgEnum("rol", [
  "dueno",
  "encargado",
  "operario",
  "veterinario",
  "lector",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable(
  "usuarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Mail o celular: al menos uno. Los empleados sin mail entran con celular.
    email: text("email"),
    phone: text("celular"),
    name: text("nombre").notNull(),
    passwordHash: text("password_hash"),
    ...timestamps,
  },
  (t) => [uniqueIndex("usuarios_email_unq").on(t.email), uniqueIndex("usuarios_celular_unq").on(t.phone)],
);

/**
 * Códigos para activar una cuenta sin mail (o poner contraseña nueva si se olvidó).
 * Los genera un dueño o encargado; se usan una vez y vencen. Se guarda solo el hash.
 */
export const accessCodes = pgTable(
  "codigos_acceso",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("usuario_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("codigo_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    failedAttempts: integer("intentos_fallidos").notNull().default(0),
    createdBy: uuid("creado_por").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("codigos_usuario_idx").on(t.userId)],
);

export const sessions = pgTable(
  "sesiones",
  {
    // sha256 del token que va en la cookie: si la base se filtra, las cookies no sirven.
    id: text("id").primaryKey(),
    userId: uuid("usuario_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sesiones_usuario_idx").on(t.userId)],
);

/** Enlaces para entrar por mail. Se guarda solo el hash del token. */
export const loginTokens = pgTable(
  "enlaces_acceso",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("enlaces_token_unq").on(t.tokenHash),
    index("enlaces_email_idx").on(t.email),
  ],
);

export const farms = pgTable(
  "campos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("nombre").notNull(),
    locationText: text("ubicacion"),
    latitude: doublePrecision("latitud"),
    longitude: doublePrecision("longitud"),
    hectares: doublePrecision("hectareas"),
    dicose: text("dicose"),
    // Marca: logo como data URL (png/jpg/webp/svg, chico) y dos colores.
    logo: text("logo"),
    colorPrimary: text("color_principal").notNull().default("#7a4a2a"),
    colorAccent: text("color_acento").notNull().default("#c9733d"),
    setupDoneAt: timestamp("asistente_completo", { withTimezone: true }),
    createdBy: uuid("creado_por").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("campos_slug_unq").on(t.slug)],
);

export const memberships = pgTable(
  "miembros",
  {
    farmId: uuid("campo_id")
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    userId: uuid("usuario_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("rol").notNull(),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.farmId, t.userId] }),
    index("miembros_usuario_idx").on(t.userId),
  ],
);

export const invitations = pgTable(
  "invitaciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmId: uuid("campo_id")
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: roleEnum("rol").notNull(),
    tokenHash: text("token_hash").notNull(),
    invitedBy: uuid("invitado_por").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("invitaciones_token_unq").on(t.tokenHash),
    index("invitaciones_campo_idx").on(t.farmId),
  ],
);

/**
 * Especies que tiene cada campo y con qué orientación.
 * El catálogo de especies (categorías, controles sugeridos) vive en src/lib/catalogo.
 * Esta tabla es lo que eligió cada campo: es lo que arma su admin.
 */
export const farmSpecies = pgTable(
  "campo_especies",
  {
    farmId: uuid("campo_id")
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    speciesKey: text("especie").notNull(),
    orientations: text("orientaciones").array().notNull().default([]),
    sells: integer("vende").notNull().default(1),
    // Apagar una especie la esconde; sus animales no se borran.
    active: boolean("activa").notNull().default(true),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.farmId, t.speciesKey] })],
);

export const animalStatusEnum = pgEnum("estado_animal", ["activo", "vendido", "muerto", "baja"]);

/**
 * Padrón. Un registro es un animal o, en especies que lo permiten, un lote con N cabezas.
 * client_id: lo genera el celular al cargar sin señal; evita duplicados al sincronizar.
 */
export const animals = pgTable(
  "animales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmId: uuid("campo_id")
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    species: text("especie").notNull(),
    category: text("categoria"),
    sex: text("sexo"),
    name: text("nombre"),
    tagVisual: text("caravana"),
    tagRfid: text("rfid"),
    birthDate: date("nacimiento"),
    breed: text("raza"),
    origin: text("origen"), // nacido | comprado
    originDetail: text("origen_detalle"),
    arrivedOn: date("ingreso"),
    isLot: boolean("es_lote").notNull().default(false),
    headCount: integer("cabezas").notNull().default(1),
    notes: text("notas"),
    status: animalStatusEnum("estado").notNull().default("activo"),
    statusDate: date("estado_fecha"),
    statusNote: text("estado_nota"),
    statusCause: text("estado_causa"),
    paddockId: uuid("potrero_id").references((): AnyPgColumn => paddocks.id, { onDelete: "set null" }),
    saleId: uuid("venta_id").references((): AnyPgColumn => sales.id, { onDelete: "set null" }),
    ownerId: uuid("propietario_id").references((): AnyPgColumn => owners.id, { onDelete: "set null" }),
    clientId: uuid("client_id"),
    createdBy: uuid("creado_por").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("animales_campo_especie_idx").on(t.farmId, t.species, t.status),
    uniqueIndex("animales_client_unq").on(t.clientId),
    index("animales_caravana_idx").on(t.farmId, t.tagVisual),
    index("animales_rfid_idx").on(t.farmId, t.tagRfid),
  ],
);

/** Jornada de manga: un control (ej. vacuna aftosa) aplicado a muchos animales seguidos. */
export const healthSessions = pgTable(
  "jornadas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmId: uuid("campo_id")
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    species: text("especie").notNull(),
    control: text("control").notNull(),
    label: text("titulo").notNull(),
    product: text("producto"),
    batch: text("serie"),
    dose: text("dosis"),
    date: date("fecha").notNull(),
    nextDueDate: date("proxima"),
    vet: text("veterinario"),
    notes: text("notas"),
    closedAt: timestamp("cerrada", { withTimezone: true }),
    clientId: uuid("client_id"),
    createdBy: uuid("creado_por").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("jornadas_campo_idx").on(t.farmId, t.date), uniqueIndex("jornadas_client_unq").on(t.clientId)],
);

/** Registro sanitario de un animal (o lote). Lleva su propia próxima fecha. */
export const healthEvents = pgTable(
  "sanidad",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmId: uuid("campo_id")
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    animalId: uuid("animal_id")
      .notNull()
      .references(() => animals.id, { onDelete: "cascade" }),
    sessionId: uuid("jornada_id").references(() => healthSessions.id, { onDelete: "set null" }),
    control: text("control").notNull(),
    label: text("titulo").notNull(),
    product: text("producto"),
    batch: text("serie"),
    dose: text("dosis"),
    date: date("fecha").notNull(),
    nextDueDate: date("proxima"),
    vet: text("veterinario"),
    notes: text("notas"),
    // Dato por animal: resultado del tacto, kilos de la pesada o de lana…
    result: text("resultado"),
    clientId: uuid("client_id"),
    createdBy: uuid("creado_por").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("sanidad_animal_idx").on(t.animalId, t.control, t.date),
    index("sanidad_campo_proxima_idx").on(t.farmId, t.nextDueDate),
    index("sanidad_jornada_idx").on(t.sessionId),
    uniqueIndex("sanidad_client_unq").on(t.clientId),
  ],
);

/**
 * Campañas sanitarias oficiales (MGAP): son las mismas para todos los campos.
 * Se cargan cada año con una migración; la app las muestra en "Para atender"
 * a los campos que tienen esa especie prendida.
 */
export const officialCampaigns = pgTable(
  "campanas_oficiales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    species: text("especie").notNull(),
    control: text("control").notNull(),
    title: text("titulo").notNull(),
    detail: text("detalle"),
    startsOn: date("desde").notNull(),
    endsOn: date("hasta").notNull(),
    sourceUrl: text("fuente"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("campanas_fechas_idx").on(t.species, t.endsOn)],
);

/** Potreros. svg_id enlaza con la forma del mapa subido (si hay). */
export const paddocks = pgTable(
  "potreros",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmId: uuid("campo_id")
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    name: text("nombre").notNull(),
    hectares: doublePrecision("hectareas"),
    kind: text("tipo"), // natural | pradera | verdeo | rastrojo | monte | otro
    svgId: text("svg_id"),
    notes: text("notas"),
    active: boolean("activo").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("potreros_campo_idx").on(t.farmId), uniqueIndex("potreros_nombre_unq").on(t.farmId, t.name)],
);

/** Mapa del campo: el SVG que sube el usuario, ya limpio. */
export const farmMaps = pgTable("mapas", {
  farmId: uuid("campo_id")
    .primaryKey()
    .references(() => farms.id, { onDelete: "cascade" }),
  svg: text("svg").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Movimientos: cada animal que cambia de potrero. batch agrupa los que se mueven juntos. */
export const movements = pgTable(
  "movimientos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmId: uuid("campo_id")
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    animalId: uuid("animal_id")
      .notNull()
      .references(() => animals.id, { onDelete: "cascade" }),
    fromPaddockId: uuid("desde_potrero_id").references(() => paddocks.id, { onDelete: "set null" }),
    toPaddockId: uuid("hacia_potrero_id").references(() => paddocks.id, { onDelete: "set null" }),
    date: date("fecha").notNull(),
    batchId: uuid("tanda_id").notNull(),
    note: text("nota"),
    createdBy: uuid("creado_por").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("mov_animal_idx").on(t.animalId, t.date),
    index("mov_desde_idx").on(t.fromPaddockId, t.date),
    index("mov_hacia_idx").on(t.toPaddockId, t.date),
    index("mov_tanda_idx").on(t.batchId),
  ],
);

/** Ventas: una tropa (varios animales) a un comprador. Por kilo o por cabeza. */
export const sales = pgTable(
  "ventas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmId: uuid("campo_id")
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    date: date("fecha").notNull(),
    buyer: text("comprador").notNull(),
    intermediary: text("intermediario"),
    guide: text("guia"),
    priceMode: text("modo_precio").notNull(), // kilo | cabeza
    heads: integer("cabezas").notNull(),
    kilos: numeric("kilos", { precision: 12, scale: 1 }),
    unitPrice: numeric("precio_unitario", { precision: 12, scale: 3 }),
    currency: text("moneda").notNull().default("USD"),
    gross: numeric("bruto", { precision: 14, scale: 2 }).notNull(),
    expenses: numeric("gastos", { precision: 14, scale: 2 }).notNull().default("0"),
    notes: text("notas"),
    ownerId: uuid("propietario_id").references((): AnyPgColumn => owners.id, { onDelete: "set null" }),
    createdBy: uuid("creado_por").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("ventas_campo_idx").on(t.farmId, t.date)],
);

/** Lluvias y heladas registradas en el campo (una fila por día). */
export const weatherLogs = pgTable(
  "registros_clima",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmId: uuid("campo_id")
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    date: date("fecha").notNull(),
    rainMm: doublePrecision("lluvia_mm"),
    frost: boolean("helada").notNull().default(false),
    note: text("nota"),
    createdBy: uuid("creado_por").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("clima_dia_unq").on(t.farmId, t.date)],
);

/** Insumos: alimento, sales, semillas, fertilizantes, medicamentos… */
export const supplies = pgTable(
  "insumos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmId: uuid("campo_id")
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    name: text("nombre").notNull(),
    category: text("categoria").notNull(), // alimento | sales | semillas | fertilizantes | medicamentos | combustible | otros
    unit: text("unidad").notNull(), // kg, l, dosis, bolsa, fardo, unidad
    minimum: doublePrecision("minimo"),
    notes: text("notas"),
    active: boolean("activo").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("insumos_nombre_unq").on(t.farmId, t.name)],
);

/** Movimientos de stock: entradas (compras) positivas, consumos negativos. */
export const supplyMoves = pgTable(
  "insumos_movimientos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmId: uuid("campo_id")
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    supplyId: uuid("insumo_id")
      .notNull()
      .references(() => supplies.id, { onDelete: "cascade" }),
    date: date("fecha").notNull(),
    quantity: doublePrecision("cantidad").notNull(),
    unitCost: numeric("costo_unitario", { precision: 14, scale: 4 }),
    currency: text("moneda"),
    note: text("nota"),
    sessionId: uuid("jornada_id").references(() => healthSessions.id, { onDelete: "set null" }),
    createdBy: uuid("creado_por").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("insumos_mov_idx").on(t.supplyId, t.date)],
);

/**
 * Propietarios de animales: el campo, socios, terceros (pensión) o un pozo común
 * entre socios (con el porcentaje de cada uno en owner_shares).
 */
export const owners = pgTable(
  "propietarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmId: uuid("campo_id")
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    name: text("nombre").notNull(),
    kind: text("tipo").notNull(), // campo | socio | tercero | pozo
    phone: text("telefono"),
    monthlyFee: numeric("pension_mensual", { precision: 12, scale: 2 }),
    currency: text("moneda").notNull().default("USD"),
    notes: text("notas"),
    active: boolean("activo").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("propietarios_nombre_unq").on(t.farmId, t.name)],
);

export const ownerShares = pgTable(
  "pozo_partes",
  {
    poolId: uuid("pozo_id")
      .notNull()
      .references(() => owners.id, { onDelete: "cascade" }),
    partnerId: uuid("socio_id")
      .notNull()
      .references(() => owners.id, { onDelete: "cascade" }),
    percent: doublePrecision("porcentaje").notNull(),
  },
  (t) => [primaryKey({ columns: [t.poolId, t.partnerId] })],
);

/** Gastos del campo, con categoría y a quién se imputan (opcional). */
export const expenses = pgTable(
  "gastos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmId: uuid("campo_id")
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    date: date("fecha").notNull(),
    concept: text("concepto").notNull(),
    category: text("categoria").notNull(),
    amount: numeric("monto", { precision: 14, scale: 2 }).notNull(),
    currency: text("moneda").notNull().default("USD"),
    ownerId: uuid("propietario_id").references(() => owners.id, { onDelete: "set null" }),
    supplier: text("proveedor"),
    notes: text("notas"),
    createdBy: uuid("creado_por").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("gastos_campo_idx").on(t.farmId, t.date)],
);

/** Tareas y recordatorios que se cargan a mano en el calendario. */
export const tasks = pgTable(
  "tareas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmId: uuid("campo_id")
      .notNull()
      .references(() => farms.id, { onDelete: "cascade" }),
    date: date("fecha").notNull(),
    title: text("titulo").notNull(),
    notes: text("notas"),
    doneAt: timestamp("hecha", { withTimezone: true }),
    createdBy: uuid("creado_por").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("tareas_campo_idx").on(t.farmId, t.date)],
);

export type Paddock = typeof paddocks.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
export type User = typeof users.$inferSelect;
export type Farm = typeof farms.$inferSelect;
export type Animal = typeof animals.$inferSelect;
export type HealthEvent = typeof healthEvents.$inferSelect;
