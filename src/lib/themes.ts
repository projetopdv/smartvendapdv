// Paletas predefinidas do SmartVenda PDV
// Cada paleta define apenas as cores principais; o resto é derivado em CSS.

export type ThemeMode = "light" | "dark";
export type PaletteId =
  | "indigo"
  | "emerald"
  | "rose"
  | "amber"
  | "ocean"
  | "violet"
  | "graphite";

export interface Palette {
  id: PaletteId;
  name: string;
  description: string;
  preview: { primary: string; accent: string; bg: string };
}

export const PALETTES: Palette[] = [
  {
    id: "indigo",
    name: "Indigo SaaS",
    description: "Padrão. Roxo profissional para qualquer negócio.",
    preview: { primary: "#5b5bd6", accent: "#3aa6c9", bg: "#fafbff" },
  },
  {
    id: "emerald",
    name: "Esmeralda",
    description: "Verde fresco. Ótimo para hortifrúti e farmácia.",
    preview: { primary: "#10b981", accent: "#06b6d4", bg: "#f7fdfa" },
  },
  {
    id: "rose",
    name: "Rosê",
    description: "Rosa moderno. Perfeito para moda e beleza.",
    preview: { primary: "#e11d6f", accent: "#f59e0b", bg: "#fff8fb" },
  },
  {
    id: "amber",
    name: "Âmbar",
    description: "Laranja vibrante. Ideal para bar, lanchonete e restaurante.",
    preview: { primary: "#ea580c", accent: "#dc2626", bg: "#fffaf3" },
  },
  {
    id: "ocean",
    name: "Oceano",
    description: "Azul profundo. Sóbrio para serviços e contábil.",
    preview: { primary: "#0369a1", accent: "#0891b2", bg: "#f5fbff" },
  },
  {
    id: "violet",
    name: "Violeta",
    description: "Roxo elegante. Para boutiques e alto padrão.",
    preview: { primary: "#7c3aed", accent: "#ec4899", bg: "#fbf9ff" },
  },
  {
    id: "graphite",
    name: "Grafite",
    description: "Neutro escuro. Minimalista e atemporal.",
    preview: { primary: "#404040", accent: "#737373", bg: "#fafafa" },
  },
];

const PALETTE_STORAGE = "smartvenda.palette";
const MODE_STORAGE = "smartvenda.mode";

export function applyTheme(palette: PaletteId, mode: ThemeMode) {
  const root = document.documentElement;
  // remove paletas anteriores
  PALETTES.forEach((p) => root.classList.remove(`palette-${p.id}`));
  root.classList.add(`palette-${palette}`);
  // modo escuro
  root.classList.toggle("dark", mode === "dark");
  localStorage.setItem(PALETTE_STORAGE, palette);
  localStorage.setItem(MODE_STORAGE, mode);
}

export function loadStoredTheme(): { palette: PaletteId; mode: ThemeMode } {
  const palette = (localStorage.getItem(PALETTE_STORAGE) as PaletteId) || "indigo";
  const mode = (localStorage.getItem(MODE_STORAGE) as ThemeMode) || "light";
  return { palette, mode };
}

export function bootstrapTheme() {
  if (typeof document === "undefined") return;
  const { palette, mode } = loadStoredTheme();
  applyTheme(palette, mode);
}
