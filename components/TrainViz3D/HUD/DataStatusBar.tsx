"use client";

import { DataBasis } from "../lib/types";
import { ExcludedOption } from "../lib/realTrainAdapter";
import { btnBase } from "./ui";
import { Icon } from "./icons";

interface DataStatusBarProps {
  counts: Record<DataBasis, number>;
  pending: number;
  failed: number;
  excluded: ExcludedOption[];
  demoTimetable: boolean;
  onRefresh: () => void;
}

const dot = (color: string) => (
  <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block" }} />
);

/**
 * Honest data-quality strip: how many markers are backed by live seats vs baseline vs
 * estimate, plus any demo-timetable warning, failures and excluded trains.
 */
export default function DataStatusBar({ counts, pending, failed, excluded, demoTimetable, onRefresh }: DataStatusBarProps) {
  const total = counts.live + counts.baseline + counts.estimate;
  return (
    <div
      role="status"
      style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 14px", padding: "7px 20px",
        background: "var(--viz-inset)", borderBottom: "1px solid var(--viz-line)", fontSize: 12, color: "var(--viz-muted)",
      }}
    >
      <span style={{ fontWeight: 700, color: "var(--viz-text)" }}>Seat data</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{dot("var(--viz-good)")} {counts.live} live</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{dot("var(--viz-warn)")} {counts.baseline} baseline</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{dot("var(--viz-muted)")} {counts.estimate} estimated</span>
      <span>of {total}</span>

      {pending > 0 && <span aria-live="polite">· checking {pending}…</span>}
      {failed > 0 && (
        <span style={{ color: "var(--viz-bad)", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Icon name="alert" size={12} /> {failed} check{failed === 1 ? "" : "s"} failed
        </span>
      )}
      {demoTimetable && (
        <span style={{ color: "var(--viz-warn)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }} title="The live timetable feed is unavailable, so the app is showing its built-in fallback timetable.">
          <Icon name="alert" size={12} /> Fallback timetable (live feed unavailable)
        </span>
      )}
      {excluded.length > 0 && (
        <span title={excluded.map((e) => `${e.label}: ${e.reason}`).join("\n")} style={{ textDecoration: "underline dotted", cursor: "help" }}>
          {excluded.length} excluded
        </span>
      )}

      <button
        type="button"
        className="tv3d-btn"
        onClick={onRefresh}
        disabled={pending > 0}
        style={{ ...btnBase, marginLeft: "auto", minHeight: 26, padding: "2px 10px", fontSize: 11 }}
      >
        <Icon name="refresh" size={12} /> Refresh live seats
      </button>
    </div>
  );
}
