"use client";

import { ScoreWeights } from "../lib/types";
import { glassPanel, panelTitle } from "../lib/theme";
import { Icon, IconName } from "./icons";

interface WeightSliderPanelProps {
  weights: ScoreWeights;
  onChange: (weights: ScoreWeights) => void;
}

const ROWS: { key: keyof ScoreWeights; label: string; icon: IconName }[] = [
  { key: "success", label: "Tatkal success", icon: "target" },
  { key: "fare", label: "Low fare", icon: "tag" },
  { key: "duration", label: "Speed", icon: "clock" },
];

/**
 * Sets `key` to `value` and rescales the OTHER two proportionally so the three
 * always sum to 1. The slider being dragged therefore never jumps under the cursor.
 */
export function rebalance(weights: ScoreWeights, key: keyof ScoreWeights, value: number): ScoreWeights {
  const v = Math.min(1, Math.max(0, value));
  const others = (Object.keys(weights) as (keyof ScoreWeights)[]).filter((k) => k !== key);
  const otherSum = others.reduce((s, k) => s + weights[k], 0);
  const next = { ...weights, [key]: v } as ScoreWeights;
  for (const k of others) {
    next[k] = otherSum > 0 ? (weights[k] / otherSum) * (1 - v) : (1 - v) / others.length;
  }
  return next;
}

export default function WeightSliderPanel({ weights, onChange }: WeightSliderPanelProps) {
  return (
    <div style={glassPanel}>
      <p style={panelTitle}>
        <Icon name="sliders" size={14} /> What matters most
      </p>

      {ROWS.map(({ key, label, icon }) => {
        const pct = Math.round(weights[key] * 100);
        return (
          <div key={key} style={{ marginBottom: 10 }}>
            <label
              htmlFor={`tv3d-w-${key}`}
              style={{ display: "flex", justifyContent: "space-between", marginBottom: 2, fontSize: 13 }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Icon name={icon} size={13} style={{ color: "var(--viz-muted)" }} /> {label}
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--viz-accent)", fontWeight: 700 }}>{pct}%</span>
            </label>
            <input
              id={`tv3d-w-${key}`}
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={weights[key]}
              onChange={(e) => onChange(rebalance(weights, key, parseFloat(e.target.value)))}
            />
          </div>
        );
      })}

      <div style={{ fontSize: 11, color: "var(--viz-muted)", textAlign: "center" }}>Always sums to 100%</div>
    </div>
  );
}
