CREATE TABLE "raciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campo_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"insumo_id" uuid NOT NULL,
	"turno" text NOT NULL,
	"cantidad" double precision NOT NULL,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raciones_dadas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campo_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"turno" text NOT NULL,
	"animales" integer DEFAULT 0 NOT NULL,
	"salteados" text,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "insumos_movimientos" ADD COLUMN "racion_dada_id" uuid;--> statement-breakpoint
ALTER TABLE "raciones" ADD CONSTRAINT "raciones_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raciones" ADD CONSTRAINT "raciones_animal_id_animales_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raciones" ADD CONSTRAINT "raciones_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raciones_dadas" ADD CONSTRAINT "raciones_dadas_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raciones_dadas" ADD CONSTRAINT "raciones_dadas_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "raciones_animal_idx" ON "raciones" USING btree ("animal_id");--> statement-breakpoint
CREATE INDEX "raciones_campo_idx" ON "raciones" USING btree ("campo_id","turno");--> statement-breakpoint
CREATE UNIQUE INDEX "raciones_dadas_unq" ON "raciones_dadas" USING btree ("campo_id","fecha","turno");