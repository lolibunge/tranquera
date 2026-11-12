import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getFarmAccess } from "@/lib/farms";
import { getActiveSpecies } from "@/lib/farm-species";
import { CATALOG, categoryOf, formatTag, isSpeciesKey, tagDigits, type SpeciesKey } from "@/lib/catalogo";
import { healthByAnimal } from "@/lib/health";
import { can } from "@/lib/roles";
import { ButtonLink, Card, StatusPill } from "@/components/ui";
import { SearchBox } from "./search-box";

export const metadata: Metadata = { title: "Animales" };

const TONE_LABEL = { ok: "Al día", warn: "Vence pronto", bad: "Vencido" } as const;

export default async function AnimalsPage({ params, searchParams }: PageProps<"/c/[slug]/animales">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { farm, role } = await getFarmAccess(slug);
  const active = await getActiveSpecies(farm.id);
  const base = `/c/${slug}/animales`;
  if (!active.length) redirect(`/c/${slug}/especies?desde=inicio`);

  const requested = typeof sp.e === "string" && isSpeciesKey(sp.e) ? sp.e : null;
  const species: SpeciesKey = requested && active.some((s) => s.key === requested) ? requested : active[0].key;
  const info = CATALOG[species];
  const category = typeof sp.cat === "string" && categoryOf(species, sp.cat) ? sp.cat : null;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 40) : "";
  const showInactive = sp.ver === "bajas";

  const digits = tagDigits(q);
  const search = q
    ? or(
        ilike(schema.animals.name, `%${q}%`),
        ilike(schema.animals.tagVisual, `%${q.replace(/\s+/g, "")}%`),
        digits.length >= 3 ? ilike(schema.animals.tagRfid, `%${digits}`) : undefined,
        digits.length >= 3 ? sql`regexp_replace(coalesce(${schema.animals.tagVisual}, ''), '\\D', '', 'g') like ${"%" + digits}` : undefined,
      )
    : undefined;

  const rows = await db
    .select({
      id: schema.animals.id,
      name: schema.animals.name,
      tagVisual: schema.animals.tagVisual,
      tagRfid: schema.animals.tagRfid,
      category: schema.animals.category,
      isLot: schema.animals.isLot,
      headCount: schema.animals.headCount,
      status: schema.animals.status,
    })
    .from(schema.animals)
    .where(
      and(
        eq(schema.animals.farmId, farm.id),
        eq(schema.animals.species, species),
        showInactive ? ne(schema.animals.status, "activo") : eq(schema.animals.status, "activo"),
        category ? eq(schema.animals.category, category) : undefined,
        search,
      ),
    )
    .orderBy(asc(sql`coalesce(${schema.animals.tagVisual}, ${schema.animals.name}, ${schema.animals.tagRfid})`))
    .limit(500);

  const health = await healthByAnimal(farm.id);
  const heads = rows.reduce((n, r) => n + r.headCount, 0);
  const href = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams();
    const merged = { e: species, cat: category, q: q || null, ver: showInactive ? "bajas" : null, ...changes };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    return `${base}?${next.toString()}`;
  };
  const canLoad = can(role, "cargar");
  const statusLabel = { vendido: "Vendido", muerto: "Muerto", baja: "Baja", activo: "" } as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[26px] font-bold">Animales</h1>
        {canLoad ? (
          <Link
            href={`${base}/nuevo?e=${species}`}
            aria-label={`Agregar ${info.label.toLowerCase()}`}
            className="flex size-11 items-center justify-center rounded-xl bg-brand text-white hover:bg-brand-strong"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
        ) : null}
      </div>

      <SearchBox defaultValue={q} species={species} category={category} showInactive={showInactive} />

      {active.length > 1 ? (
        <nav aria-label="Especies" className="flex gap-1 overflow-x-auto border-b border-line">
          {active.map((s) => {
            const on = s.key === species;
            return (
              <Link
                key={s.key}
                href={href({ e: s.key, cat: null })}
                aria-current={on ? "page" : undefined}
                className={`shrink-0 border-b-3 px-3 py-2.5 text-[15px] font-semibold ${on ? "border-brand text-ink" : "border-transparent text-muted"}`}
              >
                {CATALOG[s.key].plural}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Link href={href({ cat: null })} className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold ${!category ? "bg-ink text-white" : "bg-chip"}`}>
          Todos
        </Link>
        {info.categories.map((c) => (
          <Link
            key={c.value}
            href={href({ cat: c.value })}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold ${category === c.value ? "bg-ink text-white" : "bg-chip"}`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between text-[13px] text-muted">
        <span>
          {heads} {heads === 1 ? "cabeza" : "cabezas"}
          {showInactive ? " fuera del padrón" : ""}
        </span>
        <Link href={href({ ver: showInactive ? null : "bajas" })} className="font-semibold text-brand">
          {showInactive ? "Ver activos" : "Ver vendidos y bajas"}
        </Link>
      </div>

      {rows.length ? (
        <ul className="flex flex-col gap-2">
          {rows.map((a) => {
            const h = health.get(a.id);
            const title = a.tagVisual ? formatTag(a.tagVisual) : a.name ?? formatTag(a.tagRfid);
            const sub = [
              a.isLot ? `Lote · ${a.headCount} cabezas` : categoryOf(species, a.category)?.label,
              a.tagVisual && a.name ? a.name : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={a.id}>
                <Link href={`${base}/${a.id}`} className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-2.5 hover:border-line-strong">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-base font-semibold tabular-nums">{title}</span>
                    <span className="truncate text-[13px] text-muted">{sub}</span>
                  </span>
                  {a.status !== "activo" ? (
                    <StatusPill tone="info">{statusLabel[a.status]}</StatusPill>
                  ) : h ? (
                    <StatusPill tone={h.tone}>{TONE_LABEL[h.tone]}</StatusPill>
                  ) : (
                    <span className="text-xs text-muted">Sin sanidad</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card className="flex flex-col gap-3">
          <p className="text-base font-semibold">{q || category ? "No hay resultados" : `Todavía no hay ${info.plural.toLowerCase()}`}</p>
          {!q && !category && canLoad && !showInactive ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <ButtonLink href={`${base}/nuevo?e=${species}`}>Agregar {info.label.toLowerCase()}</ButtonLink>
              {info.mode !== "lote" ? (
                <ButtonLink href={`${base}/varios?e=${species}`} kind="secondary">
                  Cargar varios por caravana
                </ButtonLink>
              ) : null}
            </div>
          ) : null}
        </Card>
      )}
      {rows.length === 500 ? <p className="text-[13px] text-muted">Se muestran los primeros 500. Usá la búsqueda para encontrar uno en particular.</p> : null}
    </div>
  );
}
