CREATE TABLE "laboreos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campo_id" uuid NOT NULL,
	"potrero_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"fecha" date NOT NULL,
	"pronto_desde" date,
	"hecho_por" text,
	"notas" text,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grupo_miembros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campo_id" uuid NOT NULL,
	"grupo_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"desde" date NOT NULL,
	"hasta" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grupos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campo_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"notas" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "archivo_origen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campo_id" uuid NOT NULL,
	"origen" text NOT NULL,
	"tabla" text NOT NULL,
	"id_origen" text NOT NULL,
	"datos" text NOT NULL,
	"destino_tabla" text,
	"destino_id" uuid,
	"importado" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mediciones_pasto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campo_id" uuid NOT NULL,
	"potrero_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"kg_ms_ha" double precision NOT NULL,
	"detalle" text,
	"notas" text,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "animales" ADD COLUMN "pelaje" text;--> statement-breakpoint
ALTER TABLE "animales" ADD COLUMN "doma" text;--> statement-breakpoint
ALTER TABLE "sanidad" ADD COLUMN "costo" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "sanidad" ADD COLUMN "moneda" text;--> statement-breakpoint
ALTER TABLE "potreros" ADD COLUMN "padre_id" uuid;--> statement-breakpoint
ALTER TABLE "potreros" ADD COLUMN "zona" text;--> statement-breakpoint
ALTER TABLE "potreros" ADD COLUMN "descanso_desde" date;--> statement-breakpoint
ALTER TABLE "registros_clima" ADD COLUMN "helada_intensidad" text;--> statement-breakpoint
ALTER TABLE "registros_clima" ADD COLUMN "temp_min" double precision;--> statement-breakpoint
ALTER TABLE "registros_clima" ADD COLUMN "temp_max" double precision;--> statement-breakpoint
ALTER TABLE "laboreos" ADD CONSTRAINT "laboreos_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "laboreos" ADD CONSTRAINT "laboreos_potrero_id_potreros_id_fk" FOREIGN KEY ("potrero_id") REFERENCES "public"."potreros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "laboreos" ADD CONSTRAINT "laboreos_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grupo_miembros" ADD CONSTRAINT "grupo_miembros_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grupo_miembros" ADD CONSTRAINT "grupo_miembros_grupo_id_grupos_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."grupos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grupo_miembros" ADD CONSTRAINT "grupo_miembros_animal_id_animales_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grupos" ADD CONSTRAINT "grupos_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archivo_origen" ADD CONSTRAINT "archivo_origen_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mediciones_pasto" ADD CONSTRAINT "mediciones_pasto_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mediciones_pasto" ADD CONSTRAINT "mediciones_pasto_potrero_id_potreros_id_fk" FOREIGN KEY ("potrero_id") REFERENCES "public"."potreros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mediciones_pasto" ADD CONSTRAINT "mediciones_pasto_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "laboreos_potrero_idx" ON "laboreos" USING btree ("potrero_id","fecha");--> statement-breakpoint
CREATE INDEX "grupo_miembros_grupo_idx" ON "grupo_miembros" USING btree ("grupo_id");--> statement-breakpoint
CREATE INDEX "grupo_miembros_animal_idx" ON "grupo_miembros" USING btree ("animal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "grupos_nombre_unq" ON "grupos" USING btree ("campo_id","nombre");--> statement-breakpoint
CREATE UNIQUE INDEX "archivo_origen_unq" ON "archivo_origen" USING btree ("campo_id","origen","tabla","id_origen");--> statement-breakpoint
CREATE INDEX "mediciones_potrero_idx" ON "mediciones_pasto" USING btree ("potrero_id","fecha");--> statement-breakpoint
ALTER TABLE "potreros" ADD CONSTRAINT "potreros_padre_id_potreros_id_fk" FOREIGN KEY ("padre_id") REFERENCES "public"."potreros"("id") ON DELETE set null ON UPDATE no action;