"use client";

import { FilterState, TatkalOption } from "../lib/types";

const ALL_CLASSES: TatkalOption["travelClass"][] = [
  "SL",
  "3A",
  "2A",
  "1A",
  "CC",
  "EC",
];

const GLASS_STYLE: React.CSSProperties = {
  background: "rgba(14, 24, 34, 0.85)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid var(--line)",
  borderRadius: 14,
  padding: "16px 20px",
  color: "var(--text)",
};

interface FilterToolbarProps {
  filter: FilterState;
  onChange: (filter: FilterState) => void;
}

export default function FilterToolbar({ filter, onChange }: FilterToolbarProps) {
  const toggleClass = (cls: TatkalOption["travelClass"]) => {
    const next = new Set(filter.classes);
    if (next.has(cls)) next.delete(cls);
    else next.add(cls);
    onChange({ ...filter, classes: next });
  };

  return (
    <div style={GLASS_STYLE}>
      <p
        style={{
          margin: "0 0 10px 0",
          fontWeight: 700,
          fontSize: 13,
          color: "var(--accent)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        🔍 Filters
      </p>

      {/* Class chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {ALL_CLASSES.map((cls) => {
          const active = filter.classes.size === 0 || filter.classes.has(cls);
          return (
            <button
              key={cls}
              onClick={() => toggleClass(cls)}
              style={{
                padding: "4px 10px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                border: active
                  ? "1.5px solid var(--accent)"
                  : "1.5px solid var(--line)",
                background: active ? "var(--accent)" : "transparent",
                color: active ? "#fff" : "var(--muted)",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {cls}
            </button>
          );
        })}
        {filter.classes.size > 0 && (
          <button
            onClick={() => onChange({ ...filter, classes: new Set() })}
            style={{
              padding: "4px 10px",
              borderRadius: 20,
              fontSize: 11,
              border: "1px solid var(--line)",
              background: "transparent",
              color: "var(--muted)",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Max fare slider */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
          <span>Max Fare</span>
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>
            ₹{filter.maxFare.toLocaleString()}
          </span>
        </div>
        <input
          type="range"
          min={300}
          max={4500}
          step={50}
          value={filter.maxFare}
          onChange={(e) => onChange({ ...filter, maxFare: parseInt(e.target.value) })}
          style={{ width: "100%", accentColor: "var(--accent)" }}
        />
      </div>

      {/* Min success chance */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
          <span>Min Success Chance</span>
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>
            {filter.minSuccessChance}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={filter.minSuccessChance}
          onChange={(e) =>
            onChange({ ...filter, minSuccessChance: parseInt(e.target.value) })
          }
          style={{ width: "100%", accentColor: "var(--accent)" }}
        />
      </div>

      {/* Max duration slider */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
          <span>Max Duration</span>
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>
            {filter.maxDuration.toFixed(1)}h
          </span>
        </div>
        <input
          type="range"
          min={3}
          max={8}
          step={0.25}
          value={filter.maxDuration}
          onChange={(e) =>
            onChange({ ...filter, maxDuration: parseFloat(e.target.value) })
          }
          style={{ width: "100%", accentColor: "var(--accent)" }}
        />
      </div>
    </div>
  );
}
