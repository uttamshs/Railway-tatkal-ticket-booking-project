"use client";

import { useState } from "react";
import { ScoredOption } from "../lib/types";

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
  { key: "fare", label: "Fare", format: (o) => `₹${o.fare.toLocaleString()}` },
  { key: "duration", label: "Time", format: (o) => `${o.duration.toFixed(1)}h` },
  { key: "tatkalSuccessChance", label: "Success", format: (o) => `${o.tatkalSuccessChance}%` },
  { key: "compositeScore", label: "Score", format: (o) => `${Math.round(o.compositeScore * 100)}%` },
];

export default function Linked2DTable({
  options,
  selectedId,
  hoveredId,
  onSelectOption,
  onHoverOption,
}: Linked2DTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = [...options].sort((a, b) => {
    const av = a[sortKey] as number;
    const bv = b[sortKey] as number;
    return sortAsc ? av - bv : bv - av;
  });

  const handleHeaderClick = (key: SortKey) => {
    if (key === sortKey) setSortAsc((prev) => !prev);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  return (
    <div
      style={{
        background: "rgba(14,24,34,0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        overflow: "hidden",
        color: "var(--text)",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--line)",
          fontSize: 12,
          fontWeight: 700,
          color: "var(--accent)",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
        }}
      >
        📊 All Options ({options.length})
      </div>

      <div style={{ overflowY: "auto", maxHeight: 320 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th
                style={{
                  padding: "6px 10px",
                  textAlign: "left",
                  color: "var(--muted)",
                  fontWeight: 600,
                  borderBottom: "1px solid var(--line)",
                  whiteSpace: "nowrap",
                }}
              >
                Train
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleHeaderClick(col.key)}
                  style={{
                    padding: "6px 8px",
                    textAlign: "right",
                    color: sortKey === col.key ? "var(--accent)" : "var(--muted)",
                    fontWeight: 600,
                    borderBottom: "1px solid var(--line)",
                    cursor: "pointer",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {col.label}
                  {sortKey === col.key ? (sortAsc ? " ↑" : " ↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((opt) => {
              const isSelected = opt.id === selectedId;
              const isHovered = opt.id === hoveredId;
              return (
                <tr
                  key={opt.id}
                  onClick={() => onSelectOption(opt.id)}
                  onMouseEnter={() => onHoverOption(opt.id)}
                  onMouseLeave={() => onHoverOption(null)}
                  style={{
                    background: isSelected
                      ? "rgba(var(--accent-rgb,99,102,241),0.2)"
                      : isHovered
                      ? "rgba(255,255,255,0.04)"
                      : "transparent",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    cursor: "pointer",
                    transition: "background 0.1s",
                  }}
                >
                  <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>
                    <div style={{ fontWeight: 600 }}>
                      {opt.paretoOptimal && (
                        <span style={{ color: "#a78bfa", marginRight: 4 }}>◆</span>
                      )}
                      {opt.id}
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: 10 }}>
                      {opt.trainName.slice(0, 20)}
                    </div>
                  </td>
                  {COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        padding: "6px 8px",
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        color:
                          col.key === "compositeScore"
                            ? "var(--accent)"
                            : "var(--text)",
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
    </div>
  );
}
