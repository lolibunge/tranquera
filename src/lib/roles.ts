// Sin "server-only": las etiquetas también se usan en pantalla.
export const ROLES = ["dueno", "encargado", "operario", "veterinario", "lector"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  dueno: "Dueño",
  encargado: "Encargado",
  operario: "Operario",
  veterinario: "Veterinario",
  lector: "Solo lectura",
};

export const ROLE_HELP: Record<Role, string> = {
  dueno: "Todo, incluido manejar usuarios y borrar el campo.",
  encargado: "Todo el día a día y la configuración del campo.",
  operario: "Carga animales, sanidad y movimientos.",
  veterinario: "Ve los animales y carga sanidad.",
  lector: "Solo mira, no cambia nada.",
};

export type Permission =
  | "configurar" // datos del campo, marca, especies
  | "usuarios" // invitar, cambiar roles, sacar
  | "dueños" // dar o quitar el rol de dueño
  | "cargar" // cargar datos del campo
  | "sanidad"; // cargar sanidad

const MATRIX: Record<Role, Permission[]> = {
  dueno: ["configurar", "usuarios", "dueños", "cargar", "sanidad"],
  encargado: ["configurar", "usuarios", "cargar", "sanidad"],
  operario: ["cargar", "sanidad"],
  veterinario: ["sanidad"],
  lector: [],
};

export function can(role: Role, permission: Permission) {
  return MATRIX[role].includes(permission);
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
