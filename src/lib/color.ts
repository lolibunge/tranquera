/** Contraste WCAG entre un color hex y el blanco (texto de los botones). */
export function contrastWithWhite(hex: string) {
  const value = hex.replace("#", "");
  const channel = (i: number) => {
    const c = parseInt(value.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  return 1.05 / (luminance + 0.05);
}

export const PALETTES = [
  { key: "cuero", label: "Tierra y cuero", primary: "#7a4a2a", accent: "#c9733d" },
  { key: "oliva", label: "Verde campo", primary: "#3f5a2b", accent: "#c8a15a" },
  { key: "azul", label: "Azul campo", primary: "#23466b", accent: "#6fa14a" },
  { key: "pradera", label: "Pradera", primary: "#2f6b3a", accent: "#d08a2e" },
] as const;
