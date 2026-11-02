import type { CSSProperties } from "react";

/**
 * Single source of truth for every colour the visualizer uses.
 *
 * - HTML/HUD components read CSS custom properties (`var(--viz-*)`) that are set
 *   once on the visualizer root via {@link vizCssVars}.
 * - Three.js (which cannot read CSS variables) reads the same palette through
 *   {@link PALETTES}.
 *
 * Contrast rules (verified in theme.test.ts):
 *   - text / muted on every panel surface  ≥ 4.5 : 1  (WCAG AA)
 *   - on-accent text on the accent colour  ≥ 4.5 : 1
 *   - semantic colours (good/warn/bad/pareto) on panels ≥ 4.5 : 1
 * Never put hard-coded white text on `--viz-accent`: the dark-theme accent is a
 * light mint, so it needs dark text (`--viz-on-accent`).
 */
export type VizTheme = "light" | "dark";

export interface VizPalette {
  // Surfaces
  sceneBg: string;
  panel: string; // translucent glass surface
  panelSolid: string; // opaque version (used for contrast maths + tooltips)
  panelInset: string; // inset boxes inside panels
  line: string;
  hover: string;
  shadow: string;
  // Text
  text: string;
  muted: string;
  // Accent
  accent: string;
  onAccent: string;
  accentSoft: string;
  // Semantic
  good: string;
  warn: string;
  bad: string;
  pareto: string;
  // Three.js scene
  gridColor: number;
  axisFare: number;
  axisSuccess: number;
  axisDuration: number;
  labelText: string;
  labelBg: string;
  paretoRing: number;
  selectionRing: number;
  fog: number;
  ambient: number;
  keyLight: number;
  emissiveMix: number;
  /** [worst, middle, best] stops of the standard score ramp. */
  ramp: [string, string, string];
  /** Colour-blind-safe (blue → teal → yellow) ramp, brightness tuned per theme. */
  rampCB: [string, string, string];
}

export const PALETTES: Record<VizTheme, VizPalette> = {
  light: {
    sceneBg: "#f4f8ff",
    panel: "rgba(255,255,255,0.94)",
    panelSolid: "#ffffff",
    panelInset: "#eef3fc",
    line: "#d3dcec",
    hover: "rgba(15,23,42,0.06)",
    shadow: "0 18px 50px rgba(15,23,42,0.12)",
    text: "#0f172a",
    muted: "#475569",
    accent: "#1e40af",
    onAccent: "#ffffff",
    accentSoft: "rgba(30,64,175,0.10)",
    good: "#15803d",
    warn: "#a16207",
    bad: "#b91c1c",
    pareto: "#6d28d9",
    gridColor: 0x93a4c0,
    axisFare: 0xc2410c,
    axisSuccess: 0x15803d,
    axisDuration: 0x1d4ed8,
    labelText: "#1e293b",
    labelBg: "rgba(255,255,255,0.88)",
    paretoRing: 0x6d28d9,
    selectionRing: 0x1e40af,
    fog: 0xf4f8ff,
    ambient: 0.95,
    keyLight: 0.85,
    emissiveMix: 0.12,
    ramp: ["#d62839", "#d98e04", "#12a150"],
    rampCB: ["#46327e", "#1f9e89", "#b08d00"],
  },
  dark: {
    sceneBg: "#07111a",
    panel: "rgba(13,24,35,0.94)",
    panelSolid: "#0d1823",
    panelInset: "#15232f",
    line: "#2a3d4e",
    hover: "rgba(255,255,255,0.07)",
    shadow: "0 18px 50px rgba(0,0,0,0.5)",
    text: "#eef4f7",
    muted: "#a3b4c0",
    accent: "#8ee3bd",
    onAccent: "#05261a",
    accentSoft: "rgba(142,227,189,0.14)",
    good: "#4ade80",
    warn: "#fbbf24",
    bad: "#ff8a8a",
    pareto: "#c4b5fd",
    gridColor: 0x3b556b,
    axisFare: 0xff9f6b,
    axisSuccess: 0x6ee7a8,
    axisDuration: 0x7db4ff,
    labelText: "#e6eef4",
    labelBg: "rgba(7,17,26,0.82)",
    paretoRing: 0xc4b5fd,
    selectionRing: 0x8ee3bd,
    fog: 0x07111a,
    ambient: 0.65,
    keyLight: 0.85,
    emissiveMix: 0.3,
    ramp: ["#ff5d5d", "#ffc83d", "#3ddc97"],
    rampCB: ["#8e7cff", "#2ec4b6", "#e9f542"],
  },
};

/** CSS custom properties for the visualizer root. */
export function vizCssVars(theme: VizTheme): CSSProperties {
  const p = PALETTES[theme];
  const vars: Record<string, string> = {
    "--viz-bg": p.sceneBg,
    "--viz-panel": p.panel,
    "--viz-panel-solid": p.panelSolid,
    "--viz-inset": p.panelInset,
    "--viz-line": p.line,
    "--viz-hover": p.hover,
    "--viz-shadow": p.shadow,
    "--viz-text": p.text,
    "--viz-muted": p.muted,
    "--viz-accent": p.accent,
    "--viz-on-accent": p.onAccent,
    "--viz-accent-soft": p.accentSoft,
    "--viz-good": p.good,
    "--viz-warn": p.warn,
    "--viz-bad": p.bad,
    "--viz-pareto": p.pareto,
    colorScheme: theme,
  };
  return vars as CSSProperties;
}

// --- Shared HUD style fragments (no more copy-pasted GLASS_STYLE objects) ---

export const glassPanel: CSSProperties = {
  background: "var(--viz-panel)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid var(--viz-line)",
  borderRadius: 14,
  padding: "14px 16px",
  color: "var(--viz-text)",
  boxShadow: "var(--viz-shadow)",
};

export const panelTitle: CSSProperties = {
  margin: "0 0 10px 0",
  fontWeight: 700,
  fontSize: 12,
  color: "var(--viz-accent)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  display: "flex",
  alignItems: "center",
  gap: 6,
};

export const FOCUS_RING = "2px solid var(--viz-accent)";

// --- Score → colour (one implementation shared by markers AND legend) ---

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Linear interpolation across the three ramp stops; score is clamped to [0, 1]. */
export function scoreToHex(
  score: number,
  colorblind: boolean,
  theme: VizTheme
): string {
  const stops = colorblind ? PALETTES[theme].rampCB : PALETTES[theme].ramp;
  const s = Math.min(1, Math.max(0, score));
  const [lo, hi, t] = s < 0.5 ? [stops[0], stops[1], s / 0.5] : [stops[1], stops[2], (s - 0.5) / 0.5];
  const a = hexToRgb(lo);
  const b = hexToRgb(hi);
  return rgbToHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
}

/** CSS gradient string for the legend (worst → best, left → right). */
export function legendGradient(colorblind: boolean, theme: VizTheme): string {
  const [a, b, c] = colorblind ? PALETTES[theme].rampCB : PALETTES[theme].ramp;
  return `linear-gradient(to right, ${a}, ${b}, ${c})`;
}

// --- WCAG contrast helpers (used by tests) ---

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
