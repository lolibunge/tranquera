/**
 * Aplica las migraciones pendientes (carpeta drizzle/).
 * Corre antes de cada build en Vercel. Nunca borra datos: cada migración
 * se revisa a mano antes de subirla.
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[migrate] Sin DATABASE_URL: no se aplican migraciones.");
    return;
  }
  // Para migrar conviene la conexión directa (sin pooler) si está disponible.
  const sql = postgres(process.env.DATABASE_URL_UNPOOLED ?? url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
    console.log("[migrate] Base al día.");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("[migrate] Falló:", error);
  process.exit(1);
});
