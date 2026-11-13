ALTER TABLE "gastos" ADD COLUMN "pagado_por" text;--> statement-breakpoint
ALTER TABLE "gastos" ADD COLUMN "reintegrado" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gastos" ADD COLUMN "reparto_id" uuid;--> statement-breakpoint
ALTER TABLE "campos" ADD COLUMN "tiene_terceros" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "campos" ADD COLUMN "tiene_socios" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Campos que ya usaban propietarios: se prenden las preguntas que corresponden.
UPDATE "campos" c SET "tiene_terceros" = true WHERE EXISTS (SELECT 1 FROM "propietarios" p WHERE p."campo_id" = c."id" AND p."tipo" = 'tercero' AND p."activo");--> statement-breakpoint
UPDATE "campos" c SET "tiene_socios" = true WHERE EXISTS (SELECT 1 FROM "propietarios" p WHERE p."campo_id" = c."id" AND p."tipo" IN ('socio', 'pozo') AND p."activo");
