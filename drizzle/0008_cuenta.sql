CREATE TABLE "tarifas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campo_id" uuid NOT NULL,
	"propietario_id" uuid NOT NULL,
	"animal_id" uuid,
	"mensual" numeric(12, 2) NOT NULL,
	"moneda" text DEFAULT 'UYU' NOT NULL,
	"desde" date NOT NULL,
	"hasta" date,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cuenta_movimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campo_id" uuid NOT NULL,
	"propietario_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"fecha" date NOT NULL,
	"monto" numeric(14, 2) NOT NULL,
	"moneda" text DEFAULT 'UYU' NOT NULL,
	"concepto" text NOT NULL,
	"notas" text,
	"animal_id" uuid,
	"periodo" text,
	"tarifa_id" uuid,
	"gasto_id" uuid,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tarifas" ADD CONSTRAINT "tarifas_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarifas" ADD CONSTRAINT "tarifas_propietario_id_propietarios_id_fk" FOREIGN KEY ("propietario_id") REFERENCES "public"."propietarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarifas" ADD CONSTRAINT "tarifas_animal_id_animales_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuenta_movimientos" ADD CONSTRAINT "cuenta_movimientos_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuenta_movimientos" ADD CONSTRAINT "cuenta_movimientos_propietario_id_propietarios_id_fk" FOREIGN KEY ("propietario_id") REFERENCES "public"."propietarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuenta_movimientos" ADD CONSTRAINT "cuenta_movimientos_animal_id_animales_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuenta_movimientos" ADD CONSTRAINT "cuenta_movimientos_tarifa_id_tarifas_id_fk" FOREIGN KEY ("tarifa_id") REFERENCES "public"."tarifas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuenta_movimientos" ADD CONSTRAINT "cuenta_movimientos_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tarifas_propietario_idx" ON "tarifas" USING btree ("propietario_id");--> statement-breakpoint
CREATE INDEX "cuenta_propietario_idx" ON "cuenta_movimientos" USING btree ("propietario_id","fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "cuenta_pension_unq" ON "cuenta_movimientos" USING btree ("tarifa_id","periodo");