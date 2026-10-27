"use client";

import { FilterState, TravelClass } from "../lib/types";
import { VizBounds } from "../lib/bounds";
import { glassPanel, panelTitle } from "../lib/theme";
import { btnBase, btnActive } from "./ui";
import { Icon } from "./icons";

interface FilterToolbarProps {
  filter: FilterState;
  bounds: VizBounds;
  /** Only the classes that actually exist in the data. */
  availableClasses: TravelClass[];
  isFiltered: boolean;
  onChange: (filter: FilterState) => void;
  onReset: () => void;
}

function SliderRow({
  id, label, valueText, min, max, step, value, onChange,
}: {
  id: string; label: string; valueText: string; min: number; max: number; step: number; value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label htmlFor={id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ color: "var(--viz-accent)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{valueText}</span>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

export default function FilterToolbar({ filter, bounds, availableClasses, isFiltered, onChange, onReset }: FilterToolbarProps) {
  const toggleClass = (cls: TravelClass) => {
    const next = new Set(filter.classes);
    if (next.has(cls)) next.delete(cls);
    else next.add(cls);
    onChange({ ...filter, classes: next });
  };

  const fareStep = Math.max(10, Math.round((bounds.fareMax - bounds.fareMin) / 100 / 10) * 10);

  return (
    <div style={glassPanel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ ...panelTitle, marginBottom: 8 }}>
          <Icon name="filter" size={14} /> Filters
        </p>
        {isFiltered && (
          <button type="button" className="tv3d-btn" style={{ ...btnBase, minHeight: 26, padding: "2px 8px", fontSize: 11 }} onClick={onReset}>
            Reset
          </button>
        )}
      </div>

      <div role="group" aria-label="Travel class" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {availableClasses.map((cls) => {
          const active = filter.classes.size === 0 || filter.classes.has(cls);
          return (
            <button
              key={cls}
              type="button"
              className="tv3d-btn"
              data-active={active}
              aria-pressed={active}
              onClick={() => toggleClass(cls)}
              style={{ ...btnBase, ...(active ? btnActive : {}), borderRadius: 20, padding: "3px 12px" }}
            >
              {cls}
            </button>
          );
        })}
      </div>

      <SliderRow
        id="tv3d-f-fare" label="Max fare" valueText={`₹${filter.maxFare.toLocaleString("en-IN")}`}
        min={bounds.fareMin} max={bounds.fareMax} step={fareStep} value={Math.min(filter.maxFare, bounds.fareMax)}
        onChange={(v) => onChange({ ...filter, maxFare: v })}
      />
      <SliderRow
        id="tv3d-f-success" label="Min success" valueText={`${filter.minSuccessChance}%`}
        min={0} max={100} step={5} value={filter.minSuccessChance}
        onChange={(v) => onChange({ ...filter, minSuccessChance: v })}
      />
      <SliderRow
        id="tv3d-f-duration" label="Max duration" valueText={`${filter.maxDuration.toFixed(1)}h`}
        min={bounds.durationMin} max={bounds.durationMax} step={0.25} value={Math.min(filter.maxDuration, bounds.durationMax)}
        onChange={(v) => onChange({ ...filter, maxDuration: v })}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ fontSize: 11, color: "var(--viz-muted)", display: "grid", gap: 3 }}>
          Depart after
          <input type="time" value={filter.departureAfter} onChange={(e) => onChange({ ...filter, departureAfter: e.target.value || "00:00" })} />
        </label>
        <label style={{ fontSize: 11, color: "var(--viz-muted)", display: "grid", gap: 3 }}>
          Depart before
          <input type="time" value={filter.departureBefore} onChange={(e) => onChange({ ...filter, departureBefore: e.target.value || "23:59" })} />
        </label>
      </div>
    </div>
  );
}
