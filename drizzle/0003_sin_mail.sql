CREATE TABLE "codigos_acceso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"codigo_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"intentos_fallidos" integer DEFAULT 0 NOT NULL,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usuarios" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "celular" text;--> statement-breakpoint
ALTER TABLE "codigos_acceso" ADD CONSTRAINT "codigos_acceso_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codigos_acceso" ADD CONSTRAINT "codigos_acceso_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "codigos_usuario_idx" ON "codigos_acceso" USING btree ("usuario_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_celular_unq" ON "usuarios" USING btree ("celular");--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_mail_o_celular" CHECK ("email" IS NOT NULL OR "celular" IS NOT NULL);
