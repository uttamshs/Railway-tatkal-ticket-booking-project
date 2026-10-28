"use client";

import { EMPHASIS_LABEL, IntentChip, VizIntent } from "../lib/vizIntent";
import { btnBase } from "./ui";
import { Icon } from "./icons";

export interface RelaxAction {
  key: string;
  label: string;
  /** How many options would match after applying this relaxation. */
  gain: number;
  onClick: () => void;
}

interface IntentStripProps {
  intent: VizIntent;
  /** Live, always-accurate summary of the filters that are ACTIVE right now (derived, never stale). */
  filterChips: string[];
  matchCount: number;
  totalCount: number;
  relaxActions: RelaxAction[];
  onEditFilters: () => void;
  onClear: () => void;
}

const chipBase = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "3px 10px",
  borderRadius: 99,
  fontSize: 11.5,
  fontWeight: 600,
  lineHeight: 1.4,
} as const;

function Chip({ chip }: { chip: IntentChip }) {
  return (
    <span
      title={chip.warn ? "Understood but NOT applied" : undefined}
      style={{
        ...chipBase,
        border: `1px solid ${chip.warn ? "var(--viz-warn)" : "var(--viz-line)"}`,
        background: chip.warn ? "var(--viz-inset)" : "var(--viz-accent-soft)",
        color: chip.warn ? "var(--viz-warn)" : "var(--viz-text)",
      }}
    >
      {chip.warn && <Icon name="alert" size={11} />}
      {chip.label}
    </span>
  );
}

/**
 * Summary of what the Express-intent bar applied, shown once the user lands in the visualizer.
 *  - One line, always visible: what was understood, how many options match.
 *  - If NOTHING matches, the single most useful one-tap relaxations are offered (never a dead end).
 *  - Filter chips are derived from the live filter state, so they stay truthful if the user edits filters.
 */
export default function IntentStrip({
  intent,
  filterChips,
  matchCount,
  totalCount,
  relaxActions,
  onEditFilters,
  onClear,
}: IntentStripProps) {
  const empty = totalCount > 0 && matchCount === 0;
  return (
    <div
      role="region"
      aria-label="Your request, applied as filters"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "6px 8px",
        padding: "8px 20px",
        background: "var(--viz-panel-solid)",
        borderBottom: "1px solid var(--viz-line)",
        fontSize: 12,
        color: "var(--viz-text)",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontWeight: 800,
          fontSize: 11,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--viz-accent)",
          marginRight: 2,
        }}
        title={intent.source === "ai" ? "Understood with AI assistance" : "Understood instantly on this device"}
      >
        <Icon name="zap" size={12} /> Your request
        <span style={{ fontWeight: 600, color: "var(--viz-muted)", textTransform: "none", letterSpacing: 0 }}>
          · {intent.source === "ai" ? "AI-assisted" : "instant"}
        </span>
      </span>

      {intent.context.map((c) => (
        <Chip key={c.key} chip={c} />
      ))}
      {filterChips.map((label) => (
        <Chip key={label} chip={{ key: label, label }} />
      ))}
      {intent.emphasis && !intent.context.some((c) => c.key === "emphasis") && (
        <Chip chip={{ key: "emphasis", label: EMPHASIS_LABEL[intent.emphasis] }} />
      )}

      <span role="status" aria-live="polite" style={{ marginLeft: "auto", color: empty ? "var(--viz-warn)" : "var(--viz-muted)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        {totalCount === 0 ? "Loading trains…" : empty ? "No match" : `${matchCount} of ${totalCount} match`}
      </span>
      <button type="button" className="tv3d-btn" onClick={onEditFilters} style={{ ...btnBase, minHeight: 26, padding: "2px 10px", fontSize: 11 }}>
        <Icon name="filter" size={11} /> Edit
      </button>
      <button type="button" className="tv3d-btn" onClick={onClear} style={{ ...btnBase, minHeight: 26, padding: "2px 10px", fontSize: 11 }} title="Remove these filters and show every option">
        <Icon name="close" size={11} /> Clear
      </button>

      {empty && (
        <div style={{ flexBasis: "100%", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, paddingTop: 4 }}>
          <span style={{ color: "var(--viz-muted)" }}>
            {relaxActions.length > 0 ? "Nothing fits every filter. Quickest fix:" : "Nothing fits every filter."}
          </span>
          {relaxActions.map((a) => (
            <button
              key={a.key}
              type="button"
              className="tv3d-btn"
              data-active="true"
              onClick={a.onClick}
              style={{ ...btnBase, background: "var(--viz-accent)", color: "var(--viz-on-accent)", borderColor: "var(--viz-accent)", minHeight: 28 }}
            >
              {a.label} <span style={{ opacity: 0.85, fontVariantNumeric: "tabular-nums" }}>→ {a.gain} match{a.gain === 1 ? "" : "es"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
