import type { CSSProperties } from "react";

/** Scoped stylesheet: focus rings, hover states, range inputs, skeleton, reduced motion. */
export const VIZ_CSS = `
.tv3d, .tv3d * { box-sizing: border-box; }
.tv3d button, .tv3d input, .tv3d select { font: inherit; }
.tv3d button:focus-visible,
.tv3d input:focus-visible,
.tv3d [tabindex]:focus-visible {
  outline: 2px solid var(--viz-accent);
  outline-offset: 2px;
}
.tv3d .tv3d-btn { transition: background 200ms ease, color 200ms ease, border-color 200ms ease, transform 200ms ease; }
.tv3d .tv3d-btn:not([data-active="true"]):not(:disabled):hover { background: var(--viz-hover); color: var(--viz-text); }
.tv3d .tv3d-btn[data-active="true"]:not(:disabled):hover { filter: brightness(1.06); }
.tv3d .tv3d-btn:active:not(:disabled) { transform: scale(0.98); }
.tv3d .tv3d-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.tv3d .tv3d-row { transition: background 160ms ease; }
.tv3d .tv3d-row:hover { background: var(--viz-hover); }
.tv3d input[type="range"] { accent-color: var(--viz-accent); width: 100%; height: 22px; cursor: pointer; }
.tv3d input[type="time"] {
  background: var(--viz-inset); color: var(--viz-text); border: 1px solid var(--viz-line);
  border-radius: 8px; padding: 4px 8px; font-size: 12px; width: 100%; min-height: 30px;
}
.tv3d .tv3d-skeleton {
  background: linear-gradient(90deg, var(--viz-inset) 25%, var(--viz-hover) 50%, var(--viz-inset) 75%);
  background-size: 200% 100%; animation: tv3d-shimmer 1.4s linear infinite; border-radius: 10px;
}
@keyframes tv3d-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.tv3d .tv3d-scroll { scrollbar-width: thin; scrollbar-color: var(--viz-line) transparent; }
@media (prefers-reduced-motion: reduce) {
  .tv3d *, .tv3d *::before, .tv3d *::after { animation: none !important; transition: none !important; }
}
`;

export const btnBase: CSSProperties = {
  cursor: "pointer",
  border: "1px solid var(--viz-line)",
  background: "transparent",
  color: "var(--viz-muted)",
  borderRadius: 8,
  padding: "5px 10px",
  fontSize: 12,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  minHeight: 30,
  whiteSpace: "nowrap",
};

/** Applied on top of `btnBase` for an active/selected state. Text colour comes from `--viz-on-accent`. */
export const btnActive: CSSProperties = {
  background: "var(--viz-accent)",
  color: "var(--viz-on-accent)",
  borderColor: "var(--viz-accent)",
};

export const btnPrimary: CSSProperties = {
  ...btnBase,
  ...btnActive,
  width: "100%",
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 700,
  borderRadius: 10,
};

/** Small rounded label (class chip, basis badge). */
export const pill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "2px 8px",
  borderRadius: 99,
  fontSize: 11,
  fontWeight: 700,
  border: "1px solid var(--viz-line)",
  background: "var(--viz-inset)",
  color: "var(--viz-text)",
};

export const insetBox: CSSProperties = {
  background: "var(--viz-inset)",
  border: "1px solid var(--viz-line)",
  borderRadius: 10,
  padding: "8px 10px",
};
