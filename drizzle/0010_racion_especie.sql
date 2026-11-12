DROP INDEX "raciones_dadas_unq";--> statement-breakpoint
ALTER TABLE "raciones_dadas" ADD COLUMN "especie" text DEFAULT 'caballo' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "raciones_dadas_unq" ON "raciones_dadas" USING btree ("campo_id","fecha","turno","especie");