CREATE TYPE "public"."estado_animal" AS ENUM('activo', 'vendido', 'muerto', 'baja');--> statement-breakpoint
CREATE TABLE "animales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campo_id" uuid NOT NULL,
	"especie" text NOT NULL,
	"categoria" text,
	"sexo" text,
	"nombre" text,
	"caravana" text,
	"rfid" text,
	"nacimiento" date,
	"raza" text,
	"origen" text,
	"origen_detalle" text,
	"ingreso" date,
	"es_lote" boolean DEFAULT false NOT NULL,
	"cabezas" integer DEFAULT 1 NOT NULL,
	"notas" text,
	"estado" "estado_animal" DEFAULT 'activo' NOT NULL,
	"estado_fecha" date,
	"estado_nota" text,
	"client_id" uuid,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanidad" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campo_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"jornada_id" uuid,
	"control" text NOT NULL,
	"titulo" text NOT NULL,
	"producto" text,
	"serie" text,
	"dosis" text,
	"fecha" date NOT NULL,
	"proxima" date,
	"veterinario" text,
	"notas" text,
	"client_id" uuid,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jornadas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campo_id" uuid NOT NULL,
	"especie" text NOT NULL,
	"control" text NOT NULL,
	"titulo" text NOT NULL,
	"producto" text,
	"serie" text,
	"dosis" text,
	"fecha" date NOT NULL,
	"proxima" date,
	"veterinario" text,
	"notas" text,
	"cerrada" timestamp with time zone,
	"client_id" uuid,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campo_especies" ADD COLUMN "activa" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "animales" ADD CONSTRAINT "animales_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animales" ADD CONSTRAINT "animales_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanidad" ADD CONSTRAINT "sanidad_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanidad" ADD CONSTRAINT "sanidad_animal_id_animales_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanidad" ADD CONSTRAINT "sanidad_jornada_id_jornadas_id_fk" FOREIGN KEY ("jornada_id") REFERENCES "public"."jornadas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanidad" ADD CONSTRAINT "sanidad_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jornadas" ADD CONSTRAINT "jornadas_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jornadas" ADD CONSTRAINT "jornadas_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "animales_campo_especie_idx" ON "animales" USING btree ("campo_id","especie","estado");--> statement-breakpoint
CREATE UNIQUE INDEX "animales_client_unq" ON "animales" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "animales_caravana_idx" ON "animales" USING btree ("campo_id","caravana");--> statement-breakpoint
CREATE INDEX "animales_rfid_idx" ON "animales" USING btree ("campo_id","rfid");--> statement-breakpoint
CREATE INDEX "sanidad_animal_idx" ON "sanidad" USING btree ("animal_id","control","fecha");--> statement-breakpoint
CREATE INDEX "sanidad_campo_proxima_idx" ON "sanidad" USING btree ("campo_id","proxima");--> statement-breakpoint
CREATE INDEX "sanidad_jornada_idx" ON "sanidad" USING btree ("jornada_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sanidad_client_unq" ON "sanidad" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "jornadas_campo_idx" ON "jornadas" USING btree ("campo_id","fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "jornadas_client_unq" ON "jornadas" USING btree ("client_id");