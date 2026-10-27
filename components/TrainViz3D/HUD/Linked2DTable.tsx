"use client";

import { useMemo, useState } from "react";
import { ScoredOption } from "../lib/types";
import { glassPanel } from "../lib/theme";
import { Icon } from "./icons";

type SortKey = "rank" | "fare" | "duration" | "tatkalSuccessChance" | "compositeScore";

interface Linked2DTableProps {
  options: ScoredOption[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelectOption: (id: string) => void;
  onHoverOption: (id: string | null) => void;
}

const COLUMNS: { key: SortKey; label: string; format: (o: ScoredOption) => string }[] = [
  { key: "rank", label: "#", format: (o) => String(o.rank) },
  { key: "fare", label: "Fare", format: (o) => `${o.fareBasis === "estimated" ? "≈" : ""}₹${o.fare.toLocaleString("en-IN")}` },
  { key: "duration", label: "Time", format: (o) => `${o.duration.toFixed(1)}h` },
  { key: "tatkalSuccessChance", label: "Success", format: (o) => `${o.successBasis === "estimate" ? "≈" : ""}${o.tatkalSuccessChance}%` },
  { key: "compositeScore", label: "Score", format: (o) => `${Math.round(o.compositeScore * 100)}%` },
];

const th = { padding: "6px 8px", borderBottom: "1px solid var(--viz-line)", whiteSpace: "nowrap", fontWeight: 600 } as const;

/** Keyboard-accessible ranked list, linked both ways with the 3D scene. */
export default function Linked2DTable({ options, selectedId, hoveredId, onSelectOption, onHoverOption }: Linked2DTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = useMemo(
    () =>
      [...options].sort((a, b) => {
        const diff = (a[sortKey] as number) - (b[sortKey] as number);
        return sortAsc ? diff : -diff;
      }),
    [options, sortKey, sortAsc]
  );

  const onHeader = (key: SortKey) => {
    if (key === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === "rank" || key === "fare" || key === "duration");
    }
  };

  return (
    <div style={{ ...glassPanel, padding: 0, overflow: "hidden", borderRadius: 14 }}>
      <div
        style={{
          padding: "10px 14px", borderBottom: "1px solid var(--viz-line)", fontSize: 12, fontWeight: 700,
          color: "var(--viz-accent)", textTransform: "uppercase", letterSpacing: "0.07em",
          display: "flex", alignItems: "center", gap: 6,
        }}
      >
        <Icon name="list" size={14} /> All options ({options.length})
      </div>

      <div className="tv3d-scroll" style={{ overflow: "auto", maxHeight: 360 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ position: "sticky", top: 0, background: "var(--viz-panel-solid)", zIndex: 1 }}>
            <tr>
              <th scope="col" style={{ ...th, textAlign: "left", color: "var(--viz-muted)" }}>Train</th>
              {COLUMNS.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (sortAsc ? "ascending" : "descending") : "none"}
                    style={{ ...th, textAlign: "right", padding: 0 }}
                  >
                    <button
                      type="button"
                      onClick={() => onHeader(col.key)}
                      style={{
                        all: "unset", cursor: "pointer", padding: "6px 8px", boxSizing: "border-box",
                        color: active ? "var(--viz-accent)" : "var(--viz-muted)", fontWeight: 600,
                      }}
                    >
                      {col.label}
                      {active ? (sortAsc ? " ↑" : " ↓") : ""}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} style={{ padding: 16, textAlign: "center", color: "var(--viz-muted)" }}>
                  No trains match the current filters.
                </td>
              </tr>
            )}
            {sorted.map((opt) => {
              const isSelected = opt.id === selectedId;
              const isHovered = opt.id === hoveredId;
              return (
                <tr
                  key={opt.id}
                  className="tv3d-row"
                  tabIndex={0}
                  aria-selected={isSelected}
                  onClick={() => onSelectOption(opt.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectOption(opt.id);
                    }
                  }}
                  onMouseEnter={() => onHoverOption(opt.id)}
                  onMouseLeave={() => onHoverOption(null)}
                  onFocus={() => onHoverOption(opt.id)}
                  onBlur={() => onHoverOption(null)}
                  style={{
                    background: isSelected ? "var(--viz-accent-soft)" : isHovered ? "var(--viz-hover)" : "transparent",
                    borderBottom: "1px solid var(--viz-line)",
                    cursor: "pointer",
                    boxShadow: isSelected ? "inset 3px 0 0 var(--viz-accent)" : "none",
                  }}
                >
                  <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>
                    <div style={{ fontWeight: 700 }}>
                      {opt.paretoOptimal && (
                        <span title="Pareto-optimal" style={{ color: "var(--viz-pareto)", marginRight: 4 }}>◆</span>
                      )}
                      {opt.trainNumber} · {opt.travelClass}
                    </div>
                    <div style={{ color: "var(--viz-muted)", fontSize: 10 }}>{opt.trainName.slice(0, 24)}</div>
                  </td>
                  {COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums",
                        color: col.key === "compositeScore" ? "var(--viz-accent)" : "var(--viz-text)",
                        fontWeight: col.key === "compositeScore" ? 700 : 400,
                      }}
                    >
                      {col.format(opt)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "6px 14px", fontSize: 10, color: "var(--viz-muted)", borderTop: "1px solid var(--viz-line)" }}>
        ≈ = estimated value (fare scaled from the timetable fare, or success without a live seat count)
      </div>
    </div>
  );
}
