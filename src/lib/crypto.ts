import "server-only";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** Formato guardado: scrypt$N$r$p$sal$hash (base64url). */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [kind, n, r, p, saltText, hashText] = stored.split("$");
  if (kind !== "scrypt" || !saltText || !hashText) return false;
  const expected = Buffer.from(hashText, "base64url");
  const actual = await scryptAsync(password, Buffer.from(saltText, "base64url"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: PARAMS.maxmem,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Token aleatorio para cookies y enlaces. Solo se guarda su hash. */
export function newToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
