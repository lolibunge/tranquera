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

export type Role = (typeof roleEnum.enumValues)[number];
export type User = typeof users.$inferSelect;
export type Farm = typeof farms.$inferSelect;
export type Animal = typeof animals.$inferSelect;
export type HealthEvent = typeof healthEvents.$inferSelect;
