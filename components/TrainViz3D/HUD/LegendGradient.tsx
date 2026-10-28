"use client";

import { VizTheme, legendGradient, glassPanel } from "../lib/theme";
import { btnBase, btnActive } from "./ui";
import { Icon } from "./icons";
import { LabelMode } from "../Scene/TrainNodeLayer";

interface LegendGradientProps {
  theme: VizTheme;
  colorblindMode: boolean;
  onToggleColorblind: () => void;
  labelMode: LabelMode;
  onToggleLabels: () => void;
}

/** Colour ramp + a key for every redundant encoding (never colour alone). */
export default function LegendGradient({
  theme,
  colorblindMode,
  onToggleColorblind,
  labelMode,
  onToggleLabels,
}: LegendGradientProps) {
  return (
    <div style={{ ...glassPanel, borderRadius: 12, padding: "8px 14px", display: "grid", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 11, color: "var(--viz-muted)", whiteSpace: "nowrap" }}>Worst</span>
        <div
          role="img"
          aria-label={colorblindMode ? "Colour scale from purple (worst) through teal to yellow (best)" : "Colour scale from red (worst) through amber to green (best)"}
          style={{ flex: 1, height: 10, borderRadius: 99, background: legendGradient(colorblindMode, theme), border: "1px solid var(--viz-line)", minWidth: 80 }}
        />
        <span style={{ fontSize: 11, color: "var(--viz-muted)", whiteSpace: "nowrap" }}>Best</span>
        <button
          type="button"
          className="tv3d-btn"
          data-active={colorblindMode}
          aria-pressed={colorblindMode}
          title="Colour-blind-safe palette (blue → yellow)"
          onClick={onToggleColorblind}
          style={{ ...btnBase, ...(colorblindMode ? btnActive : {}), padding: "3px 9px", fontSize: 11, minHeight: 26 }}
        >
          <Icon name="eye" size={12} /> {colorblindMode ? "Colour-blind safe" : "Colour-blind"}
        </button>
        <button
          type="button"
          className="tv3d-btn"
          data-active={labelMode === "all"}
          aria-pressed={labelMode === "all"}
          title="Show every marker label, not just the key ones"
          onClick={onToggleLabels}
          style={{ ...btnBase, ...(labelMode === "all" ? btnActive : {}), padding: "3px 9px", fontSize: 11, minHeight: 26 }}
        >
          <Icon name="tag" size={12} /> All labels
        </button>
      </div>
      <div style={{ display: "flex", gap: "4px 12px", flexWrap: "wrap", fontSize: 10.5, color: "var(--viz-muted)" }}>
        <span>● size = score</span>
        <span style={{ color: "var(--viz-pareto)", fontWeight: 600 }}>◯ ring = Pareto</span>
        <span>│ whisker = uncertainty</span>
        <span style={{ color: "var(--viz-warn)", fontWeight: 600 }}>↓ tail = −60s drop</span>
        <span style={{ color: "var(--viz-accent)", fontWeight: 600 }}>⌒ arc = Plan A → Backup B</span>
        <span style={{ color: "var(--viz-good)", fontWeight: 600 }}>◆ diamond = AII Quota-Jump</span>
      </div>
    </div>
  );
}
