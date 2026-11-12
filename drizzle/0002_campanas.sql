CREATE TABLE "campanas_oficiales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"especie" text NOT NULL,
	"control" text NOT NULL,
	"titulo" text NOT NULL,
	"detalle" text,
	"desde" date NOT NULL,
	"hasta" date NOT NULL,
	"fuente" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "campanas_fechas_idx" ON "campanas_oficiales" USING btree ("especie","hasta");--> statement-breakpoint
INSERT INTO "campanas_oficiales" ("especie", "control", "titulo", "detalle", "desde", "hasta", "fuente") VALUES
('vacuno', 'vacuna_aftosa', 'Aftosa: vacunación de todo el rodeo', 'Período obligatorio para todas las categorías bovinas (prorrogado). Para retirar la vacuna se presenta la Declaración Jurada de DICOSE y la planilla de control sanitario.', '2026-05-15', '2026-06-15', 'https://www.gub.uy/ministerio-ganaderia-agricultura-pesca/'),
('vacuno', 'vacuna_aftosa', 'Aftosa: segundo período, terneros', 'Bovinos nacidos entre el 1 de enero y el 31 de agosto de 2026. Después de vacunar, esperar 10 días para mover los animales.', '2026-11-01', '2026-11-15', 'https://www.gub.uy/ministerio-ganaderia-agricultura-pesca/'),
('todas', 'dicose', 'Declaración Jurada DICOSE', 'Existencias al 30 de junio. Se presenta durante julio, aunque no haya animales.', '2026-07-01', '2026-07-31', 'https://www.gub.uy/ministerio-ganaderia-agricultura-pesca/');
