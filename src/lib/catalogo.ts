/**
 * Catálogo de especies de Tranquera (sin "server-only": se usa en pantalla).
 *
 * Es el punto de partida que se ofrece a cada campo. Lo que cada campo elige
 * (especies prendidas, orientación, si vende) se guarda en la tabla campo_especies.
 *
 * Los intervalos sanitarios son sugerencias para revisar con un veterinario:
 * cada registro guarda su propia "próxima fecha", editable.
 */

export type Sex = "hembra" | "macho" | "castrado";

export type Category = { value: string; label: string; sex: Sex };
/** Dato que se pide por animal en la jornada (ej. resultado del tacto, kilos). */
export type PerAnimal =
  | { type: "choice"; label: string; options: { value: string; label: string }[] }
  | { type: "number"; label: string; unit: string; optional?: boolean };

/**
 * Un trabajo que se registra por animal: vacunas y controles (sanidad) o tareas de
 * manejo y reproducción (tacto, inseminación, pesada, esquila…).
 */
export type Control = {
  key: string;
  label: string;
  intervalDays: number | null;
  official?: boolean;
  group?: "sanidad" | "manejo";
  perAnimal?: PerAnimal;
  /** Para la jornada: qué significan producto y serie en este trabajo. */
  productLabel?: string;
  batchLabel?: string;
  vetLabel?: string;
};
export type Orientation = { key: string; label: string };

export type Species = {
  key: SpeciesKey;
  label: string;
  plural: string;
  /** individual: uno por uno; lote: por lotes con cantidad de cabezas; ambos: se elige al cargar. */
  mode: "individual" | "lote" | "ambos";
  /** Identificación oficial individual (caravana SNIG). */
  traceability: "snig" | "caravana" | null;
  orientations: Orientation[];
  categories: Category[];
  breeds: string[];
  controls: Control[];
  /** Qué suma en la app al prenderla (se muestra en Especies del campo). */
  adds: string;
};

export const SPECIES_KEYS = ["vacuno", "caballo", "ovino", "caprino", "porcino", "ave"] as const;
export type SpeciesKey = (typeof SPECIES_KEYS)[number];

const DESPARASITACION: Control = { key: "desparasitacion", label: "Desparasitación", intervalDays: 90 };

const PESADA: Control = {
  key: "pesada",
  label: "Pesada",
  intervalDays: null,
  group: "manejo",
  perAnimal: { type: "number", label: "Peso", unit: "kg" },
};
const PRENEZ = (key: string, label: string, extra: { value: string; label: string }[] = []): Control => ({
  key,
  label,
  intervalDays: null,
  group: "manejo",
  perAnimal: {
    type: "choice",
    label: "Resultado",
    options: [{ value: "preñada", label: "Preñada" }, ...extra, { value: "vacía", label: "Vacía" }, { value: "dudosa", label: "Dudosa" }],
  },
  vetLabel: "Veterinario",
});

export const CATALOG: Record<SpeciesKey, Species> = {
  vacuno: {
    key: "vacuno",
    label: "Vacuno",
    plural: "Vacunos",
    mode: "individual",
    traceability: "snig",
    orientations: [
      { key: "cria", label: "Cría" },
      { key: "invernada", label: "Invernada" },
      { key: "tambo", label: "Tambo" },
    ],
    categories: [
      { value: "vaca", label: "Vaca", sex: "hembra" },
      { value: "vaquillona", label: "Vaquillona", sex: "hembra" },
      { value: "ternera", label: "Ternera", sex: "hembra" },
      { value: "ternero", label: "Ternero", sex: "macho" },
      { value: "novillito", label: "Novillito", sex: "castrado" },
      { value: "novillo", label: "Novillo", sex: "castrado" },
      { value: "toro", label: "Toro", sex: "macho" },
      { value: "buey", label: "Buey", sex: "castrado" },
    ],
    breeds: ["Hereford", "Aberdeen Angus", "Braford", "Brangus", "Holando", "Jersey", "Normando", "Limousin", "Charolais", "Cruza"],
    controls: [
      { key: "vacuna_aftosa", label: "Vacuna aftosa", intervalDays: null, official: true },
      { key: "vacuna_carbunco", label: "Vacuna carbunco", intervalDays: 365 },
      { key: "vacuna_clostridiosis", label: "Vacuna clostridiosis", intervalDays: 365 },
      { key: "vacuna_brucelosis", label: "Vacuna brucelosis", intervalDays: null },
      { key: "bano_garrapata", label: "Baño o garrapaticida", intervalDays: 21 },
      DESPARASITACION,
      { key: "inseminacion", label: "Inseminación", intervalDays: null, group: "manejo", productLabel: "Toro o pajuela", batchLabel: "Partida", vetLabel: "Inseminador" },
      PRENEZ("tacto", "Tacto"),
      PESADA,
      { key: "destete", label: "Destete", intervalDays: null, group: "manejo" },
      { key: "castracion", label: "Castración", intervalDays: null, group: "manejo" },
    ],
    adds: "Trazabilidad SNIG, aftosa, carbunco, clostridiosis, garrapata.",
  },
  caballo: {
    key: "caballo",
    label: "Caballo",
    plural: "Caballos",
    mode: "individual",
    traceability: null,
    orientations: [
      { key: "placer", label: "Placer" },
      { key: "deporte", label: "Deporte" },
      { key: "cria", label: "Cría" },
      { key: "pension", label: "Pensión" },
      { key: "trabajo", label: "Trabajo" },
    ],
    categories: [
      { value: "yegua", label: "Yegua", sex: "hembra" },
      { value: "potranca", label: "Potranca", sex: "hembra" },
      { value: "caballo", label: "Caballo", sex: "castrado" },
      { value: "padrillo", label: "Padrillo", sex: "macho" },
      { value: "potrillo", label: "Potrillo", sex: "macho" },
    ],
    breeds: ["Criollo", "Cuarto de Milla", "Pura Sangre de Carrera", "Polo Argentino", "Árabe", "Percherón", "Appaloosa", "Cruza"],
    controls: [
      { key: "aie", label: "Certificado anemia infecciosa", intervalDays: 365, official: true },
      { key: "vacuna_influenza", label: "Vacuna influenza", intervalDays: 180 },
      { key: "vacuna_rinoneumonitis", label: "Vacuna rinoneumonitis", intervalDays: 180 },
      { key: "vacuna_encefalomielitis", label: "Vacuna encefalomielitis", intervalDays: 365 },
      { key: "vacuna_tetanos", label: "Vacuna tétanos", intervalDays: 365 },
      { key: "herraje", label: "Herraje o desvasado", intervalDays: 45 },
      { key: "dentista", label: "Dentista", intervalDays: 365 },
      DESPARASITACION,
      { key: "servicio", label: "Servicio o inseminación", intervalDays: null, group: "manejo", productLabel: "Padrillo o pajuela" },
      PRENEZ("ecografia", "Ecografía"),
      PESADA,
    ],
    adds: "Herrero, anemia infecciosa, influenza, dentista.",
  },
  ovino: {
    key: "ovino",
    label: "Ovino",
    plural: "Ovinos",
    mode: "ambos",
    traceability: "caravana",
    orientations: [
      { key: "lana", label: "Lana" },
      { key: "carne", label: "Carne" },
      { key: "cria", label: "Cría" },
    ],
    categories: [
      { value: "oveja", label: "Oveja", sex: "hembra" },
      { value: "borrega", label: "Borrega", sex: "hembra" },
      { value: "cordera", label: "Cordera", sex: "hembra" },
      { value: "cordero", label: "Cordero", sex: "macho" },
      { value: "borrego", label: "Borrego", sex: "macho" },
      { value: "carnero", label: "Carnero", sex: "macho" },
      { value: "capon", label: "Capón", sex: "castrado" },
    ],
    breeds: ["Corriedale", "Merino Australiano", "Dohne Merino", "Ideal", "Texel", "Romney Marsh", "Poll Dorset", "Cruza"],
    controls: [
      { key: "bano_sarna", label: "Baño sarna o piojo", intervalDays: 365 },
      { key: "vacuna_clostridial", label: "Vacuna clostridial", intervalDays: 365 },
      { key: "pietin", label: "Control de pietín", intervalDays: null },
      DESPARASITACION,
      {
        key: "esquila",
        label: "Esquila",
        intervalDays: 365,
        group: "manejo",
        perAnimal: { type: "number", label: "Lana", unit: "kg", optional: true },
        productLabel: "Comparsa",
        batchLabel: "Tipo de esquila",
        vetLabel: "Responsable",
      },
      PRENEZ("ecografia", "Ecografía", [{ value: "mellizos", label: "Mellizos" }]),
      { key: "encarnerada", label: "Encarnerada", intervalDays: null, group: "manejo", productLabel: "Carnero" },
      { key: "senalada", label: "Señalada", intervalDays: null, group: "manejo" },
      PESADA,
    ],
    adds: "Majada por lote o individual, esquila, baños, dosificaciones.",
  },
  caprino: {
    key: "caprino",
    label: "Cabra",
    plural: "Cabras",
    mode: "ambos",
    traceability: "caravana",
    orientations: [
      { key: "leche", label: "Leche" },
      { key: "carne", label: "Carne" },
      { key: "cria", label: "Cría" },
    ],
    categories: [
      { value: "cabra", label: "Cabra", sex: "hembra" },
      { value: "cabrita", label: "Cabrita", sex: "hembra" },
      { value: "cabrito", label: "Cabrito", sex: "macho" },
      { value: "chivo", label: "Chivo", sex: "macho" },
    ],
    breeds: ["Saanen", "Anglo Nubian", "Boer", "Criolla", "Cruza"],
    controls: [{ key: "vacuna_clostridial", label: "Vacuna clostridial", intervalDays: 365 }, DESPARASITACION, PRENEZ("ecografia", "Ecografía", [{ value: "mellizos", label: "Mellizos" }]), PESADA],
    adds: "Lotes o individual, vacuna clostridial, dosificaciones.",
  },
  porcino: {
    key: "porcino",
    label: "Cerdo",
    plural: "Cerdos",
    mode: "ambos",
    traceability: null,
    orientations: [
      { key: "cria", label: "Cría" },
      { key: "engorde", label: "Engorde" },
      { key: "ciclo_completo", label: "Ciclo completo" },
    ],
    categories: [
      { value: "cerda", label: "Cerda", sex: "hembra" },
      { value: "cachorra", label: "Cachorra", sex: "hembra" },
      { value: "lechon", label: "Lechón", sex: "macho" },
      { value: "padrillo", label: "Padrillo", sex: "macho" },
      { value: "capon", label: "Capón", sex: "castrado" },
    ],
    breeds: ["Large White", "Landrace", "Duroc", "Pampa Rocha", "Hampshire", "Cruza"],
    controls: [{ key: "vacunacion", label: "Vacunación", intervalDays: null }, DESPARASITACION, { key: "servicio", label: "Servicio", intervalDays: null, group: "manejo", productLabel: "Padrillo" }, PESADA],
    adds: "Piara por lotes, reproducción, vacunas.",
  },
  ave: {
    key: "ave",
    label: "Ave",
    plural: "Aves",
    mode: "lote",
    traceability: null,
    orientations: [
      { key: "ponedoras", label: "Ponedoras" },
      { key: "parrilleros", label: "Parrilleros" },
      { key: "traspatio", label: "Traspatio" },
    ],
    categories: [
      { value: "gallina", label: "Gallina", sex: "hembra" },
      { value: "polla", label: "Polla", sex: "hembra" },
      { value: "pollo", label: "Pollo parrillero", sex: "macho" },
      { value: "gallo", label: "Gallo", sex: "macho" },
      { value: "pato", label: "Pato", sex: "hembra" },
      { value: "pavo", label: "Pavo", sex: "hembra" },
    ],
    breeds: ["Rhode Island Red", "Plymouth Rock", "Leghorn", "Campera", "Cobb", "Cruza"],
    controls: [
      { key: "vacuna_newcastle", label: "Vacuna Newcastle", intervalDays: 90 },
      { key: "vacunacion", label: "Otra vacuna", intervalDays: null },
    ],
    adds: "Lotes de aves, vacunas, mortandad.",
  },
};

export function isSpeciesKey(value: unknown): value is SpeciesKey {
  return typeof value === "string" && (SPECIES_KEYS as readonly string[]).includes(value);
}

export function categoryOf(species: SpeciesKey, value: string | null | undefined) {
  return CATALOG[species].categories.find((c) => c.value === value) ?? null;
}

export function controlOf(species: SpeciesKey, key: string | null | undefined) {
  return CATALOG[species].controls.find((c) => c.key === key) ?? null;
}

export const SEX_LABEL: Record<Sex, string> = { hembra: "Hembra", macho: "Macho", castrado: "Castrado" };

/**
 * Caravanas. En Uruguay el botón electrónico se lee como 858 + dígitos, y la
 * caravana visual dice "UY" + los mismos dígitos finales. Se guardan sin espacios
 * y se buscan por coincidencia de los dígitos finales.
 */
export function normalizeTag(raw: string) {
  return raw.replace(/[\s.\-]+/g, "").toUpperCase();
}

export function tagDigits(raw: string | null | undefined) {
  return (raw ?? "").replace(/\D+/g, "");
}

/** ¿La lectura (visual o RFID) corresponde a esta caravana? Compara los dígitos finales. */
export function tagMatches(read: string, visual: string | null, rfid: string | null) {
  const r = tagDigits(read);
  if (r.length < 4) return false;
  const v = tagDigits(visual);
  const e = tagDigits(rfid);
  if (e && (e === r || e.endsWith(r) || r.endsWith(e))) return true;
  if (v && (v === r || r.endsWith(v) || v.endsWith(r))) return true;
  return false;
}

/** Agrupa de a 4 para leer más fácil: UY 0123 4567. */
export function formatTag(tag: string | null | undefined) {
  if (!tag) return "";
  const t = normalizeTag(tag);
  const m = t.match(/^([A-Z]*)(\d+)$/);
  if (!m) return t;
  const groups = m[2].replace(/\B(?=(\d{4})+(?!\d))/g, " ");
  return m[1] ? `${m[1]} ${groups}` : groups;
}

/**
 * Lista de caravanas pegada o leída con el bastón: una por línea o separadas por
 * coma o punto y coma. "UY 0001 0001" con espacios cuenta como una sola.
 */
export function parseTagList(text: string) {
  const out: string[] = [];
  for (const chunk of text.split(/[\n\r,;]+/)) {
    const joined = normalizeTag(chunk);
    if (!joined) continue;
    if (/^[A-Z]{0,3}\d+$/.test(joined)) out.push(joined);
    else out.push(...chunk.split(/\s+/).map(normalizeTag).filter(Boolean));
  }
  return [...new Set(out)];
}

export function isHealthControl(c: Control) {
  return (c.group ?? "sanidad") === "sanidad";
}
