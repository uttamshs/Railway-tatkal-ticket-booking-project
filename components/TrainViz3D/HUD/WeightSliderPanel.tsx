"use client";

import { ScoreWeights } from "../lib/types";

const GLASS_STYLE: React.CSSProperties = {
  background: "rgba(14, 24, 34, 0.85)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid var(--line)",
  borderRadius: 14,
  padding: "16px 20px",
  color: "var(--text)",
};

interface WeightSliderPanelProps {
  weights: ScoreWeights;
  onChange: (weights: ScoreWeights) => void;
}

const LABELS: { key: keyof ScoreWeights; label: string; emoji: string }[] = [
  { key: "success", label: "Tatkal Success", emoji: "🎯" },
  { key: "fare", label: "Fare (cheap)", emoji: "💰" },
  { key: "duration", label: "Speed", emoji: "⚡" },
];

export default function WeightSliderPanel({
  weights,
  onChange,
}: WeightSliderPanelProps) {
  /** When one slider changes, renormalize so all three sum to 1. */
  const handleChange = (key: keyof ScoreWeights, rawVal: number) => {
    const updated = { ...weights, [key]: rawVal };
    const total = updated.success + updated.fare + updated.duration;
    if (total === 0) {
      onChange({ success: 1 / 3, fare: 1 / 3, duration: 1 / 3 });
    } else {
      onChange({
        success: updated.success / total,
        fare: updated.fare / total,
        duration: updated.duration / total,
      });
    }
  };

  return (
    <div style={GLASS_STYLE}>
      <p
        style={{
          margin: "0 0 12px 0",
          fontWeight: 700,
          fontSize: 13,
          color: "var(--accent)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        ⚖️ Score Weights
      </p>

      {LABELS.map(({ key, label, emoji }) => {
        const pct = Math.round(weights[key] * 100);
        return (
          <div key={key} style={{ marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
                fontSize: 13,
              }}
            >
              <span>
                {emoji} {label}
              </span>
              <span
                style={{
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--accent)",
                  fontWeight: 600,
                }}
              >
                {pct}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={weights[key]}
              onChange={(e) => handleChange(key, parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: "var(--accent)" }}
            />
          </div>
        );
      })}

      <div
        style={{
          marginTop: 4,
          fontSize: 11,
          color: "var(--muted)",
          textAlign: "center",
        }}
      >
        Auto-normalized · Always sum to 100%
      </div>
    </div>
  );
}
