# Tranquera · gestión de campo

App para manejar uno o varios campos: animales por especie, sanidad, potreros y equipo. Funciona en el celular, y pronto también sin señal.

- **Una sola base para todos los campos.** Cada dato pertenece a un campo, y cada persona ve solo los campos donde es miembro.
- **Roles por campo:** dueño, encargado, operario, veterinario y solo lectura.
- **Marca propia de cada campo:** logo y dos colores.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind 4
- Postgres en Neon con Drizzle ORM. Las migraciones están en `drizzle/`.
- Acceso con contraseña o con enlace por mail (Resend).

## Variables de entorno

Ver `.env.example`. Mínimo: `DATABASE_URL`.

## Desarrollo

```bash
npm install
cp .env.example .env.local   # completar DATABASE_URL
npm run db:migrate
npm run dev
```

Sin `RESEND_API_KEY`, el enlace para entrar se muestra en pantalla en desarrollo. Los enlaces de invitación siempre se pueden copiar o mandar por WhatsApp.

## Cambios en la base

1. Editar `src/db/schema.ts`.
2. `npm run db:generate -- --name descripcion`
3. Revisar el SQL generado en `drizzle/`. Nunca subir una migración que borre datos sin revisarla.
4. Se aplica sola en cada deploy (`npm run build` corre las migraciones antes de compilar).

## Etapas

- **Etapa 0 · Base**: cuentas, campos, equipo y roles, datos del campo, marca, app instalable.
- **Etapa 1 · Animales y Sanidad**: especies del campo, padrón por especie, carga de varios por caravana, sanidad con vencimientos, campañas oficiales, jornada de manga que funciona sin señal.
- **Etapa 2 · Potreros, Movimientos, Ventas y Clima** (esta): potreros con ocupación y descanso, mapa desde SVG (solo se guarda la geometría), mover animales, ventas por kilo o por cabeza, muertes con causa, pronóstico (Open-Meteo), lluvias y heladas. La jornada de manga sirve también para tacto, inseminación, pesada y esquila, con un dato por animal.
- **Etapa 3 · Stock, Calendario, Propietarios y asistente inicial.**
- **Etapa 4 · Migración de La Hidalguía** desde campo-admin.

## Sin señal

- El service worker guarda las pantallas de cada campo (`/c/...`) a medida que se abren: sin señal se ve la última copia.
- La jornada de manga busca las caravanas en el padrón que ya está en el celular y guarda cada registro en una cola local (IndexedDB, `src/lib/offline-queue.ts`). La cola se envía sola a `/api/sync` al volver la conexión; cada registro lleva un `client_id`, así un reintento no duplica.

## Campañas oficiales

Las fechas de campañas del MGAP (aftosa, DICOSE) están en la tabla `campanas_oficiales`. Cada año se agregan con una migración nueva (ver `drizzle/0002_campanas.sql`).
