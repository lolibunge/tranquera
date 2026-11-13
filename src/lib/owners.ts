import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { isISODate, todayISO } from "./dates";
import { parseAmount } from "./number";

export const OWNER_KINDS = [
  { value: "campo", label: "El campo", help: "Los animales propios del establecimiento." },
  { value: "socio", label: "Socio", help: "Una persona o empresa con animales propios en el campo." },
  { value: "tercero", label: "Tercero (pensión)", help: "Animales de otro que pagan pensión." },
  { value: "pozo", label: "Pozo común", help: "Animales comprados entre socios; el resultado se reparte por porcentaje." },
] as const;
export type OwnerKind = (typeof OWNER_KINDS)[number]["value"];
export const ownerKindLabel = (k: string) => OWNER_KINDS.find((o) => o.value === k)?.label ?? k;

export const EXPENSE_CATEGORIES = [
  { key: "personal", label: "Sueldos y jornales", short: "Sueldos", color: "#7a4a2a" },
  { key: "alimentacion", label: "Ración, fardos y pasturas", short: "Ración", color: "#c9733d" },
  { key: "sanidad", label: "Sanidad, veterinario y herrero", short: "Sanidad", color: "#3d5a96" },
  { key: "combustible", label: "Combustible", short: "Combustible", color: "#5b6b3a" },
  { key: "mantenimiento", label: "Alambrados, aguadas y arreglos", short: "Arreglos", color: "#8a6d3b" },
  { key: "impuestos", label: "BPS, contribución e impuestos", short: "Impuestos", color: "#6b5d52" },
  { key: "fletes", label: "Fletes y guías", short: "Fletes", color: "#2f6b6b" },
  { key: "compra_animales", label: "Compra de animales", short: "Compras", color: "#9b4d6b" },
  { key: "arrendamiento", label: "Arrendamiento", short: "Arriendo", color: "#4f5d75" },
  { key: "otros", label: "Otros", short: "Otros", color: "#a89a8c" },
] as const;
export const expenseColor = (k: string) => EXPENSE_CATEGORIES.find((c) => c.key === k)?.color ?? "#a89a8c";
export const expenseCategoryLabel = (k: string) => EXPENSE_CATEGORIES.find((c) => c.key === k)?.label ?? k;

export type Money = Partial<Record<"USD" | "UYU", number>>;
export function addMoney(m: Money, currency: string, amount: number) {
  const c = currency === "UYU" ? "UYU" : "USD";
  m[c] = (m[c] ?? 0) + amount;
  return m;
}
export function formatMoney(m: Money | number, currency?: string) {
  const fmt = (c: string, n: number) => `${n < -0.5 ? "−" : ""}${c === "UYU" ? "$" : "US$"} ${Math.abs(Math.round(n)).toLocaleString("es-UY")}`;
  if (typeof m === "number") return fmt(currency ?? "USD", m);
  const parts = (["USD", "UYU"] as const).filter((c) => m[c]).map((c) => fmt(c, m[c]!));
  return parts.length ? parts.join(" · ") : "—";
}

const optionalMoney = z
  .string()
  .trim()
  .refine((v) => v === "" || ((parseAmount(v) ?? -1) >= 0 && (parseAmount(v) ?? 0) < 1e9), "Revisá el monto.")
  .transform((v) => (v === "" ? null : parseAmount(v)));

export const ownerInput = z.object({
  name: z.string().trim().min(2, "Escribí el nombre.").max(80),
  kind: z.enum(OWNER_KINDS.map((o) => o.value) as [OwnerKind, ...OwnerKind[]]),
  phone: z.string().trim().max(30).optional(),
  monthlyFee: optionalMoney,
  currency: z.enum(["USD", "UYU"]),
  notes: z.string().trim().max(500).optional(),
});

export async function saveOwner(farmId: string, id: string | null, raw: z.input<typeof ownerInput>) {
  const parsed = ownerInput.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const [dup] = await db
    .select({ id: schema.owners.id })
    .from(schema.owners)
    .where(and(eq(schema.owners.farmId, farmId), sql`lower(${schema.owners.name}) = lower(${d.name})`, id ? sql`${schema.owners.id} <> ${id}` : sql`true`))
    .limit(1);
  if (dup) return { ok: false as const, error: "Ya hay un propietario con ese nombre." };
  const values = {
    name: d.name,
    kind: d.kind,
    phone: d.phone || null,
    monthlyFee: d.kind === "tercero" && d.monthlyFee !== null ? d.monthlyFee.toFixed(2) : null,
    currency: d.currency,
    notes: d.notes || null,
  };
  if (id) {
    const [row] = await db
      .update(schema.owners)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(schema.owners.id, id), eq(schema.owners.farmId, farmId)))
      .returning({ id: schema.owners.id });
    if (!row) return { ok: false as const, error: "Ese propietario no existe." };
    if (d.kind !== "pozo") await db.delete(schema.ownerShares).where(eq(schema.ownerShares.poolId, id));
    return { ok: true as const, value: row };
  }
  const [row] = await db.insert(schema.owners).values({ farmId, ...values }).returning({ id: schema.owners.id });
  return { ok: true as const, value: row };
}

export async function archiveOwner(farmId: string, id: string) {
  await db.transaction(async (tx) => {
    await tx.update(schema.animals).set({ ownerId: null }).where(and(eq(schema.animals.farmId, farmId), eq(schema.animals.ownerId, id)));
    await tx.update(schema.owners).set({ active: false, updatedAt: new Date() }).where(and(eq(schema.owners.id, id), eq(schema.owners.farmId, farmId)));
  });
}

export async function listOwners(farmId: string) {
  const heads = sql<number>`coalesce((select sum(a.cabezas) from animales a where a.propietario_id = "propietarios"."id" and a.estado = 'activo'), 0)`.mapWith(Number);
  return db
    .select({
      id: schema.owners.id,
      name: schema.owners.name,
      kind: schema.owners.kind,
      phone: schema.owners.phone,
      monthlyFee: schema.owners.monthlyFee,
      currency: schema.owners.currency,
      notes: schema.owners.notes,
      heads,
    })
    .from(schema.owners)
    .where(and(eq(schema.owners.farmId, farmId), eq(schema.owners.active, true)))
    .orderBy(sql`case ${schema.owners.kind} when 'campo' then 0 when 'socio' then 1 when 'pozo' then 2 else 3 end`, asc(schema.owners.name));
}

export async function getOwner(farmId: string, id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const rows = await listOwners(farmId);
  return rows.find((r) => r.id === id) ?? null;
}

export async function ownerOptions(farmId: string) {
  return (await listOwners(farmId)).map((o) => ({ id: o.id, name: o.name, kind: o.kind }));
}

export async function poolShares(poolId: string) {
  return db
    .select({ partnerId: schema.ownerShares.partnerId, percent: schema.ownerShares.percent, name: schema.owners.name })
    .from(schema.ownerShares)
    .innerJoin(schema.owners, eq(schema.owners.id, schema.ownerShares.partnerId))
    .where(eq(schema.ownerShares.poolId, poolId))
    .orderBy(asc(schema.owners.name));
}

/** Guarda los porcentajes del pozo: tienen que sumar 100. */
export async function savePoolShares(farmId: string, poolId: string, shares: { partnerId: string; percent: number }[]) {
  const pool = await getOwner(farmId, poolId);
  if (!pool || pool.kind !== "pozo") return { ok: false as const, error: "Ese pozo no existe." };
  const partners = await listOwners(farmId);
  const clean = shares.filter((s) => s.percent > 0);
  if (clean.some((s) => !partners.some((p) => p.id === s.partnerId && p.kind !== "pozo" && p.kind !== "tercero")))
    return { ok: false as const, error: "Los socios del pozo tienen que ser el campo o socios." };
  const total = clean.reduce((n, s) => n + s.percent, 0);
  if (clean.length && Math.abs(total - 100) > 0.01) return { ok: false as const, error: `Los porcentajes suman ${total.toLocaleString("es-UY")}%: tienen que sumar 100%.` };
  await db.transaction(async (tx) => {
    await tx.delete(schema.ownerShares).where(eq(schema.ownerShares.poolId, poolId));
    if (clean.length) await tx.insert(schema.ownerShares).values(clean.map((s) => ({ poolId, partnerId: s.partnerId, percent: s.percent })));
  });
  return { ok: true as const };
}

/** Deja como dueño de `ownerId` exactamente a los animales elegidos (los que ya no están elegidos quedan sin asignar). */
export async function assignAnimals(farmId: string, ownerId: string, animalIds: string[]) {
  const owner = await getOwner(farmId, ownerId);
  if (!owner) return { ok: false as const, error: "Ese propietario no existe." };
  await db.transaction(async (tx) => {
    await tx
      .update(schema.animals)
      .set({ ownerId: null, updatedAt: new Date() })
      .where(and(eq(schema.animals.farmId, farmId), eq(schema.animals.ownerId, ownerId), eq(schema.animals.status, "activo")));
    if (animalIds.length) {
      await tx
        .update(schema.animals)
        .set({ ownerId, updatedAt: new Date() })
        .where(and(eq(schema.animals.farmId, farmId), inArray(schema.animals.id, animalIds), eq(schema.animals.status, "activo")));
    }
  });
  return { ok: true as const, value: { count: animalIds.length } };
}

export const expenseInput = z.object({
  date: z.string().refine(isISODate, "Revisá la fecha."),
  concept: z.string().trim().min(2, "Escribí el concepto.").max(120),
  category: z.enum(EXPENSE_CATEGORIES.map((c) => c.key) as [string, ...string[]], { message: "Elegí en qué se gastó." }),
  amount: z
    .string()
    .trim()
    .refine((v) => (parseAmount(v) ?? 0) > 0 && (parseAmount(v) ?? 0) < 1e10, "Revisá el monto.")
    .transform((v) => parseAmount(v) as number),
  currency: z.enum(["USD", "UYU"]),
  supplier: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
  /** Quién lo pagó de su bolsillo. Vacío: la caja del campo. */
  paidBy: z.string().trim().max(60).optional().nullable(),
  /** Para quién es: el campo, un dueño, o repartido entre animales. */
  forWhom: z.enum(["campo", "dueno", "reparto"]).default("campo"),
  ownerId: z.string().uuid().nullable().optional(),
  animalIds: z.array(z.string().uuid()).optional(),
  /** Cargar en la cuenta del dueño (o de cada dueño, si se reparte) para cobrárselo. */
  bill: z.boolean().optional(),
});

/** Partes de un reparto: por cabezas de cada dueño entre los animales elegidos (lo sin dueño es del campo). */
export async function splitPreview(farmId: string, animalIds: string[]) {
  if (!animalIds.length) return [];
  const rows = await db
    .select({ id: schema.animals.id, heads: schema.animals.headCount, ownerId: schema.animals.ownerId, owner: schema.owners.name, kind: schema.owners.kind })
    .from(schema.animals)
    .leftJoin(schema.owners, eq(schema.owners.id, schema.animals.ownerId))
    .where(and(eq(schema.animals.farmId, farmId), inArray(schema.animals.id, animalIds), eq(schema.animals.status, "activo")));
  const map = new Map<string, { ownerId: string | null; name: string; kind: string; heads: number }>();
  for (const r of rows) {
    const key = r.ownerId && r.kind !== "campo" ? r.ownerId : "campo";
    const g = map.get(key) ?? { ownerId: key === "campo" ? null : r.ownerId, name: key === "campo" ? "El campo" : (r.owner ?? "Sin nombre"), kind: key === "campo" ? "campo" : (r.kind ?? "tercero"), heads: 0 };
    g.heads += r.heads;
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => Number(a.ownerId !== null) - Number(b.ownerId !== null) || a.name.localeCompare(b.name, "es"));
}

export async function createExpense(farmId: string, userId: string, raw: z.input<typeof expenseInput>) {
  const parsed = expenseInput.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.date > todayISO()) return { ok: false as const, error: "La fecha no puede ser futura." };
  const base = {
    farmId,
    date: d.date,
    category: d.category,
    currency: d.currency,
    supplier: d.supplier || null,
    notes: d.notes || null,
    paidBy: d.paidBy || null,
    createdBy: userId,
  };

  // Las partes: una sola (campo o dueño) o una por dueño si se reparte entre animales.
  let parts: { ownerId: string | null; kind: string; amount: number; concept: string }[];
  let splitId: string | null = null;
  if (d.forWhom === "reparto") {
    const groups = await splitPreview(farmId, d.animalIds ?? []);
    if (!groups.length) return { ok: false as const, error: "Elegí los animales entre los que se reparte." };
    const total = groups.reduce((n, g) => n + g.heads, 0);
    let left = Math.round(d.amount * 100);
    parts = groups.map((g, i) => {
      const cents = i === groups.length - 1 ? left : Math.round((d.amount * 100 * g.heads) / total);
      left -= cents;
      return { ownerId: g.ownerId, kind: g.kind, amount: cents / 100, concept: `${d.concept} (${g.heads} de ${total} animales)` };
    });
    splitId = crypto.randomUUID();
  } else if (d.forWhom === "dueno") {
    if (!d.ownerId) return { ok: false as const, error: "Elegí el dueño." };
    const owner = await getOwner(farmId, d.ownerId);
    if (!owner) return { ok: false as const, error: "Elegí un dueño de la lista." };
    parts = [{ ownerId: owner.id, kind: owner.kind, amount: d.amount, concept: d.concept }];
  } else {
    parts = [{ ownerId: null, kind: "campo", amount: d.amount, concept: d.concept }];
  }

  await db.transaction(async (tx) => {
    for (const part of parts) {
      const [row] = await tx
        .insert(schema.expenses)
        .values({ ...base, concept: part.concept.slice(0, 120), amount: part.amount.toFixed(2), ownerId: part.ownerId, splitId })
        .returning({ id: schema.expenses.id });
      if (d.bill && part.ownerId && part.kind !== "campo" && part.amount > 0) {
        await tx.insert(schema.ledger).values({
          farmId,
          ownerId: part.ownerId,
          kind: "cargo",
          date: d.date,
          amount: part.amount.toFixed(2),
          currency: d.currency,
          concept: part.concept.slice(0, 120),
          expenseId: row.id,
          createdBy: userId,
        });
      }
    }
  });
  return { ok: true as const, value: { parts: parts.length } };
}

export async function deleteExpense(farmId: string, id: string) {
  if (!z.string().uuid().safeParse(id).success) return;
  const [row] = await db
    .select({ splitId: schema.expenses.splitId })
    .from(schema.expenses)
    .where(and(eq(schema.expenses.id, id), eq(schema.expenses.farmId, farmId)))
    .limit(1);
  if (!row) return;
  // Un gasto repartido se borra entero, con lo que se había cargado a cada dueño.
  const ids = row.splitId
    ? (await db.select({ id: schema.expenses.id }).from(schema.expenses).where(and(eq(schema.expenses.farmId, farmId), eq(schema.expenses.splitId, row.splitId)))).map((r) => r.id)
    : [id];
  await db.transaction(async (tx) => {
    await tx.delete(schema.ledger).where(and(eq(schema.ledger.farmId, farmId), inArray(schema.ledger.expenseId, ids)));
    await tx.delete(schema.expenses).where(and(eq(schema.expenses.farmId, farmId), inArray(schema.expenses.id, ids)));
  });
}

/** Lo que cada persona puso de su bolsillo y todavía no se le devolvió. */
export async function pendingReimbursements(farmId: string) {
  const rows = await db
    .select({
      person: schema.expenses.paidBy,
      currency: schema.expenses.currency,
      total: sql<number>`sum(${schema.expenses.amount})::float`,
      count: sql<number>`count(distinct coalesce(${schema.expenses.splitId}, ${schema.expenses.id}))::int`,
    })
    .from(schema.expenses)
    .where(and(eq(schema.expenses.farmId, farmId), sql`${schema.expenses.paidBy} is not null`, isNull(schema.expenses.reimbursedAt)))
    .groupBy(schema.expenses.paidBy, schema.expenses.currency);
  const map = new Map<string, { person: string; total: Money; count: number }>();
  for (const r of rows) {
    const p = map.get(r.person!) ?? { person: r.person!, total: {}, count: 0 };
    addMoney(p.total, r.currency, r.total);
    p.count += r.count;
    map.set(r.person!, p);
  }
  return [...map.values()];
}

export async function markReimbursed(farmId: string, person: string) {
  await db
    .update(schema.expenses)
    .set({ reimbursedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.expenses.farmId, farmId), eq(schema.expenses.paidBy, person), isNull(schema.expenses.reimbursedAt)));
}

/** Personas para "¿Quién lo pagó?": el equipo del campo y quienes ya pagaron antes. */
export async function payers(farmId: string) {
  const [team, used] = await Promise.all([
    db
      .select({ name: schema.users.name })
      .from(schema.memberships)
      .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
      .where(eq(schema.memberships.farmId, farmId)),
    db
      .selectDistinct({ name: schema.expenses.paidBy })
      .from(schema.expenses)
      .where(and(eq(schema.expenses.farmId, farmId), sql`${schema.expenses.paidBy} is not null`)),
  ]);
  const first = (n: string) => n.trim().split(/\s+/)[0];
  return [...new Set([...team.map((t) => first(t.name)), ...used.map((u) => u.name!)])].filter(Boolean).slice(0, 8);
}

/** Totales por moneda de un rango de fechas. */
export async function expenseTotals(farmId: string, from: string, to: string) {
  const rows = await db
    .select({ currency: schema.expenses.currency, total: sql<number>`sum(${schema.expenses.amount})::float` })
    .from(schema.expenses)
    .where(and(eq(schema.expenses.farmId, farmId), gte(schema.expenses.date, from), lte(schema.expenses.date, to)))
    .groupBy(schema.expenses.currency);
  const m: Money = {};
  for (const r of rows) addMoney(m, r.currency, r.total);
  return m;
}

export async function listExpenses(farmId: string, from: string, to: string) {
  return db
    .select({
      id: schema.expenses.id,
      date: schema.expenses.date,
      concept: schema.expenses.concept,
      category: schema.expenses.category,
      amount: schema.expenses.amount,
      currency: schema.expenses.currency,
      supplier: schema.expenses.supplier,
      paidBy: schema.expenses.paidBy,
      reimbursedAt: schema.expenses.reimbursedAt,
      splitId: schema.expenses.splitId,
      ownerName: schema.owners.name,
      billed: sql<boolean>`exists (select 1 from cuenta_movimientos c where c.gasto_id = ${schema.expenses.id})`,
    })
    .from(schema.expenses)
    .leftJoin(schema.owners, eq(schema.owners.id, schema.expenses.ownerId))
    .where(and(eq(schema.expenses.farmId, farmId), gte(schema.expenses.date, from), lte(schema.expenses.date, to)))
    .orderBy(desc(schema.expenses.date), desc(schema.expenses.createdAt));
}

export type OwnerResult = { id: string | null; name: string; kind: string; heads: number; sales: Money; expenses: Money; pension: Money };

/**
 * Resultado del año por propietario: ventas de sus animales (repartidas por cabezas si una tropa
 * mezcla dueños), gastos imputados y pensiones de terceros. Lo que no tiene dueño va al campo.
 * El resultado del pozo se reparte entre sus socios según los porcentajes.
 */
export async function yearSummary(farmId: string, year: number) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const owners = await listOwners(farmId);
  const campo = owners.find((o) => o.kind === "campo");
  const key = (id: string | null) => id ?? campo?.id ?? null;
  const results = new Map<string | null, OwnerResult>();
  for (const o of owners) results.set(o.id, { id: o.id, name: o.name, kind: o.kind, heads: o.heads, sales: {}, expenses: {}, pension: {} });
  const unassignedHeads = await db
    .select({ n: sql<number>`coalesce(sum(${schema.animals.headCount}), 0)::int` })
    .from(schema.animals)
    .where(and(eq(schema.animals.farmId, farmId), eq(schema.animals.status, "activo"), isNull(schema.animals.ownerId)));
  const bucket = (id: string | null) => {
    const k = key(id);
    if (!results.has(k)) results.set(k, { id: null, name: "Sin asignar (del campo)", kind: "campo", heads: 0, sales: {}, expenses: {}, pension: {} });
    return results.get(k)!;
  };
  bucket(null).heads += unassignedHeads[0]?.n ?? 0;

  // Ventas: cada tropa se reparte por cabezas entre los dueños de sus animales.
  const sold = await db
    .select({
      saleId: schema.sales.id,
      gross: schema.sales.gross,
      cost: schema.sales.expenses,
      currency: schema.sales.currency,
      heads: schema.animals.headCount,
      ownerId: schema.animals.ownerId,
    })
    .from(schema.sales)
    .innerJoin(schema.animals, eq(schema.animals.saleId, schema.sales.id))
    .where(and(eq(schema.sales.farmId, farmId), gte(schema.sales.date, from), lte(schema.sales.date, to)));
  const totals = new Map<string, number>();
  for (const r of sold) totals.set(r.saleId, (totals.get(r.saleId) ?? 0) + r.heads);
  for (const r of sold) {
    const share = r.heads / (totals.get(r.saleId) || 1);
    addMoney(bucket(r.ownerId).sales, r.currency, (Number(r.gross) - Number(r.cost ?? 0)) * share);
  }

  const spent = await db
    .select({ ownerId: schema.expenses.ownerId, amount: schema.expenses.amount, currency: schema.expenses.currency })
    .from(schema.expenses)
    .where(and(eq(schema.expenses.farmId, farmId), gte(schema.expenses.date, from), lte(schema.expenses.date, to)));
  for (const e of spent) addMoney(bucket(e.ownerId).expenses, e.currency, Number(e.amount));

  // Pensión: cuota mensual por los meses del año transcurridos (es una referencia, no un cobro registrado).
  const today = todayISO();
  const months = Number(today.slice(0, 4)) > year ? 12 : Number(today.slice(0, 4)) < year ? 0 : Number(today.slice(5, 7));
  // Pensión: lo cargado en la cuenta ese año; si no se usa la cuenta, la cuota fija como estimación.
  const charged = await db
    .select({ ownerId: schema.ledger.ownerId, currency: schema.ledger.currency, total: sql<number>`sum(${schema.ledger.amount})::float` })
    .from(schema.ledger)
    .where(and(eq(schema.ledger.farmId, farmId), eq(schema.ledger.kind, "cargo"), sql`${schema.ledger.period} like ${`${year}-%`}`))
    .groupBy(schema.ledger.ownerId, schema.ledger.currency);
  for (const o of owners) {
    const mine = charged.filter((c) => c.ownerId === o.id);
    if (mine.length) for (const c of mine) addMoney(results.get(o.id)!.pension, c.currency, c.total);
    else if (o.kind === "tercero" && o.monthlyFee && o.heads > 0) addMoney(results.get(o.id)!.pension, o.currency, Number(o.monthlyFee) * months);
  }

  const rows = [...results.values()].filter((r) => r.heads || Object.keys(r.sales).length || Object.keys(r.expenses).length || r.kind !== "tercero");
  const net = (r: OwnerResult): Money => {
    const m: Money = {};
    for (const c of ["USD", "UYU"] as const) {
      const v = (r.sales[c] ?? 0) - (r.expenses[c] ?? 0);
      if (r.sales[c] || r.expenses[c]) m[c] = v;
    }
    return m;
  };

  // Reparto de cada pozo entre sus socios.
  const pools = await Promise.all(
    owners
      .filter((o) => o.kind === "pozo")
      .map(async (p) => {
        const shares = await poolShares(p.id);
        const result = net(results.get(p.id)!);
        return {
          id: p.id,
          name: p.name,
          result,
          shares: shares.map((s) => ({
            name: s.name,
            percent: s.percent,
            amount: Object.fromEntries(Object.entries(result).map(([c, v]) => [c, (v as number) * (s.percent / 100)])) as Money,
          })),
        };
      }),
  );

  const pensionTotal: Money = {};
  for (const r of rows) for (const [c, v] of Object.entries(r.pension)) addMoney(pensionTotal, c, v as number);

  return { year, months, rows: rows.map((r) => ({ ...r, net: net(r) })), pools, pensionTotal };
}
