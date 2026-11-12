CREATE TABLE "gastos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campo_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"concepto" text NOT NULL,
	"categoria" text NOT NULL,
	"monto" numeric(14, 2) NOT NULL,
	"moneda" text DEFAULT 'USD' NOT NULL,
	"propietario_id" uuid,
	"proveedor" text,
	"notas" text,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pozo_partes" (
	"pozo_id" uuid NOT NULL,
	"socio_id" uuid NOT NULL,
	"porcentaje" double precision NOT NULL,
	CONSTRAINT "pozo_partes_pozo_id_socio_id_pk" PRIMARY KEY("pozo_id","socio_id")
);
--> statement-breakpoint
CREATE TABLE "propietarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campo_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"tipo" text NOT NULL,
	"telefono" text,
	"pension_mensual" numeric(12, 2),
	"moneda" text DEFAULT 'USD' NOT NULL,
	"notas" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insumos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campo_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"categoria" text NOT NULL,
	"unidad" text NOT NULL,
	"minimo" double precision,
	"notas" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insumos_movimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campo_id" uuid NOT NULL,
	"insumo_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"cantidad" double precision NOT NULL,
	"costo_unitario" numeric(14, 4),
	"moneda" text,
	"nota" text,
	"jornada_id" uuid,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tareas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campo_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"titulo" text NOT NULL,
	"notas" text,
	"hecha" timestamp with time zone,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "animales" ADD COLUMN "propietario_id" uuid;--> statement-breakpoint
ALTER TABLE "campos" ADD COLUMN "asistente_completo" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ventas" ADD COLUMN "propietario_id" uuid;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_propietario_id_propietarios_id_fk" FOREIGN KEY ("propietario_id") REFERENCES "public"."propietarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pozo_partes" ADD CONSTRAINT "pozo_partes_pozo_id_propietarios_id_fk" FOREIGN KEY ("pozo_id") REFERENCES "public"."propietarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pozo_partes" ADD CONSTRAINT "pozo_partes_socio_id_propietarios_id_fk" FOREIGN KEY ("socio_id") REFERENCES "public"."propietarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propietarios" ADD CONSTRAINT "propietarios_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insumos" ADD CONSTRAINT "insumos_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insumos_movimientos" ADD CONSTRAINT "insumos_movimientos_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insumos_movimientos" ADD CONSTRAINT "insumos_movimientos_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insumos_movimientos" ADD CONSTRAINT "insumos_movimientos_jornada_id_jornadas_id_fk" FOREIGN KEY ("jornada_id") REFERENCES "public"."jornadas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insumos_movimientos" ADD CONSTRAINT "insumos_movimientos_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gastos_campo_idx" ON "gastos" USING btree ("campo_id","fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "propietarios_nombre_unq" ON "propietarios" USING btree ("campo_id","nombre");--> statement-breakpoint
CREATE UNIQUE INDEX "insumos_nombre_unq" ON "insumos" USING btree ("campo_id","nombre");--> statement-breakpoint
CREATE INDEX "insumos_mov_idx" ON "insumos_movimientos" USING btree ("insumo_id","fecha");--> statement-breakpoint
CREATE INDEX "tareas_campo_idx" ON "tareas" USING btree ("campo_id","fecha");--> statement-breakpoint
ALTER TABLE "animales" ADD CONSTRAINT "animales_propietario_id_propietarios_id_fk" FOREIGN KEY ("propietario_id") REFERENCES "public"."propietarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_propietario_id_propietarios_id_fk" FOREIGN KEY ("propietario_id") REFERENCES "public"."propietarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Campos que ya existían: el asistente no se les muestra.
UPDATE "campos" SET "asistente_completo" = now() WHERE "asistente_completo" IS NULL;
