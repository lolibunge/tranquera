CREATE TYPE "public"."rol" AS ENUM('dueno', 'encargado', 'operario', 'veterinario', 'lector');--> statement-breakpoint
CREATE TABLE "campo_especies" (
	"campo_id" uuid NOT NULL,
	"especie" text NOT NULL,
	"orientaciones" text[] DEFAULT '{}' NOT NULL,
	"vende" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campo_especies_campo_id_especie_pk" PRIMARY KEY("campo_id","especie")
);
--> statement-breakpoint
CREATE TABLE "campos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nombre" text NOT NULL,
	"ubicacion" text,
	"latitud" double precision,
	"longitud" double precision,
	"hectareas" double precision,
	"dicose" text,
	"logo" text,
	"color_principal" text DEFAULT '#7a4a2a' NOT NULL,
	"color_acento" text DEFAULT '#c9733d' NOT NULL,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campo_id" uuid NOT NULL,
	"email" text NOT NULL,
	"rol" "rol" NOT NULL,
	"token_hash" text NOT NULL,
	"invitado_por" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enlaces_acceso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "miembros" (
	"campo_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"rol" "rol" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "miembros_campo_id_usuario_id_pk" PRIMARY KEY("campo_id","usuario_id")
);
--> statement-breakpoint
CREATE TABLE "sesiones" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"nombre" text NOT NULL,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campo_especies" ADD CONSTRAINT "campo_especies_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campos" ADD CONSTRAINT "campos_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_invitado_por_usuarios_id_fk" FOREIGN KEY ("invitado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "miembros" ADD CONSTRAINT "miembros_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "miembros" ADD CONSTRAINT "miembros_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campos_slug_unq" ON "campos" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "invitaciones_token_unq" ON "invitaciones" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invitaciones_campo_idx" ON "invitaciones" USING btree ("campo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "enlaces_token_unq" ON "enlaces_acceso" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "enlaces_email_idx" ON "enlaces_acceso" USING btree ("email");--> statement-breakpoint
CREATE INDEX "miembros_usuario_idx" ON "miembros" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "sesiones_usuario_idx" ON "sesiones" USING btree ("usuario_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_email_unq" ON "usuarios" USING btree ("email");