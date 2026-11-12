import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

declare global {
  // Una sola conexión por instancia (y por recarga en desarrollo).
  var __tranqueraSql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL.");
  // prepare:false porque el pooler de Neon (PgBouncer) no admite sentencias preparadas.
  return postgres(url, { prepare: false, max: 5 });
}

const sql = globalThis.__tranqueraSql ?? createClient();
if (process.env.NODE_ENV !== "production") globalThis.__tranqueraSql = sql;

export const db = drizzle(sql, { schema });
export { schema };
