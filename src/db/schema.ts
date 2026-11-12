import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
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
    email: text("email").notNull(),
    name: text("nombre").notNull(),
    passwordHash: text("password_hash"),
    ...timestamps,
  },
  (t) => [uniqueIndex("usuarios_email_unq").on(t.email)],
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
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.farmId, t.speciesKey] })],
);

export type Role = (typeof roleEnum.enumValues)[number];
export type User = typeof users.$inferSelect;
export type Farm = typeof farms.$inferSelect;
