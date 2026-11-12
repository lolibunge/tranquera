CREATE TABLE "mapas" (
	"campo_id" uuid PRIMARY KEY NOT NULL,
	"svg" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campo_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"desde_potrero_id" uuid,
	"hacia_potrero_id" uuid,
	"fecha" date NOT NULL,
	"tanda_id" uuid NOT NULL,
	"nota" text,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "potreros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campo_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"hectareas" double precision,
	"tipo" text,
	"svg_id" text,
	"notas" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ventas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campo_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"comprador" text NOT NULL,
	"intermediario" text,
	"guia" text,
	"modo_precio" text NOT NULL,
	"cabezas" integer NOT NULL,
	"kilos" numeric(12, 1),
	"precio_unitario" numeric(12, 3),
	"moneda" text DEFAULT 'USD' NOT NULL,
	"bruto" numeric(14, 2) NOT NULL,
	"gastos" numeric(14, 2) DEFAULT '0' NOT NULL,
	"notas" text,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registros_clima" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campo_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"lluvia_mm" double precision,
	"helada" boolean DEFAULT false NOT NULL,
	"nota" text,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "animales" ADD COLUMN "estado_causa" text;--> statement-breakpoint
ALTER TABLE "animales" ADD COLUMN "potrero_id" uuid;--> statement-breakpoint
ALTER TABLE "animales" ADD COLUMN "venta_id" uuid;--> statement-breakpoint
ALTER TABLE "mapas" ADD CONSTRAINT "mapas_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_animal_id_animales_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_desde_potrero_id_potreros_id_fk" FOREIGN KEY ("desde_potrero_id") REFERENCES "public"."potreros"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_hacia_potrero_id_potreros_id_fk" FOREIGN KEY ("hacia_potrero_id") REFERENCES "public"."potreros"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "potreros" ADD CONSTRAINT "potreros_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros_clima" ADD CONSTRAINT "registros_clima_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros_clima" ADD CONSTRAINT "registros_clima_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mov_animal_idx" ON "movimientos" USING btree ("animal_id","fecha");--> statement-breakpoint
CREATE INDEX "mov_desde_idx" ON "movimientos" USING btree ("desde_potrero_id","fecha");--> statement-breakpoint
CREATE INDEX "mov_hacia_idx" ON "movimientos" USING btree ("hacia_potrero_id","fecha");--> statement-breakpoint
CREATE INDEX "mov_tanda_idx" ON "movimientos" USING btree ("tanda_id");--> statement-breakpoint
CREATE INDEX "potreros_campo_idx" ON "potreros" USING btree ("campo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "potreros_nombre_unq" ON "potreros" USING btree ("campo_id","nombre");--> statement-breakpoint
CREATE INDEX "ventas_campo_idx" ON "ventas" USING btree ("campo_id","fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "clima_dia_unq" ON "registros_clima" USING btree ("campo_id","fecha");--> statement-breakpoint
ALTER TABLE "animales" ADD CONSTRAINT "animales_potrero_id_potreros_id_fk" FOREIGN KEY ("potrero_id") REFERENCES "public"."potreros"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animales" ADD CONSTRAINT "animales_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE set null ON UPDATE no action;