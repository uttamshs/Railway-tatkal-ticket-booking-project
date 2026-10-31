"use client";

import { useMemo, useState } from "react";
import { Train } from "../lib/types";
import { estimateConfirmationProbability } from "../lib/probabilityModel";

interface Props {
  trains: Train[];
  selectedTrain: Train | null;
  onSelectTrain: (train: Train) => void;
  hoveredTrainId: string | null;
  onHoverTrain: (id: string | null) => void;
  quota?: string;
}

function parseDurationMinutes(d: string): number {
  const match = d.match(/(\d+)h\s*(\d*)m?/);
  if (!match) return 300;
  const hours = parseInt(match[1] || "0", 10);
  const mins = parseInt(match[2] || "0", 10);
  return hours * 60 + mins;
}

export function ParetoDecisionCanvas({
  trains,
  selectedTrain,
  onSelectTrain,
  hoveredTrainId,
  onHoverTrain,
  quota = "General"
}: Props) {
  // Compute processed data points
  const points = useMemo(() => {
    return trains.map(t => {
      const dur = parseDurationMinutes(t.duration);
      const fare = t.fare || 500;
      const probInfo = estimateConfirmationProbability(t, t.classes[0] || "3A", quota);
      return {
        train: t,
        durationMinutes: dur,
        fare,
        probability: probInfo.probability,
        probStatus: probInfo.status,
        frequencyText: probInfo.frequencyText,
        factors: probInfo.factors
      };
    });
  }, [trains, quota]);

  // Dynamic bounds calculation with graceful defaults
  const { minDuration, maxDuration, minFare, maxFareVal } = useMemo(() => {
    if (points.length === 0) {
      return { minDuration: 200, maxDuration: 360, minFare: 400, maxFareVal: 1300 };
    }
    const durs = points.map(p => p.durationMinutes);
    const fares = points.map(p => p.fare);
    const minD = Math.max(120, Math.floor((Math.min(...durs) - 25) / 10) * 10);
    const maxD = Math.ceil((Math.max(...durs) + 30) / 10) * 10;
    const minF = Math.max(200, Math.floor((Math.min(...fares) - 100) / 50) * 50);
    const maxF = Math.ceil((Math.max(...fares) + 150) / 50) * 50;
    return { minDuration: minD, maxDuration: maxD, minFare: minF, maxFareVal: maxF };
  }, [points]);

  // Direct manipulation thresholds
  const [maxBudget, setMaxBudget] = useState<number>(() => maxFareVal);
  const [maxDurationHours, setMaxDurationHours] = useState<number>(() => Math.round((maxDuration / 60) * 10) / 10);
  const [pinnedTooltipTrain, setPinnedTooltipTrain] = useState<Train | null>(null);

  // Compute Pareto Frontier (Minimizing duration and fare, while maximizing probability)
  const paretoPoints = useMemo(() => {
    const nonDominated: typeof points = [];
    for (const p of points) {
      let isDominated = false;
      for (const other of points) {
        if (other.train.id === p.train.id) continue;
        if (
          other.durationMinutes <= p.durationMinutes &&
          other.fare <= p.fare &&
          other.probability >= p.probability &&
          (other.durationMinutes < p.durationMinutes || other.fare < p.fare || other.probability > p.probability)
        ) {
          isDominated = true;
          break;
        }
      }
      if (!isDominated) {
        nonDominated.push(p);
      }
    }
    return nonDominated.sort((a, b) => a.durationMinutes - b.durationMinutes);
  }, [points]);

  // Chart bounds & scales
  const width = 680;
  const height = 370;
  const padding = { top: 35, right: 45, bottom: 55, left: 70 };

  const scaleX = (mins: number) => {
    return padding.left + ((mins - minDuration) / (maxDuration - minDuration)) * (width - padding.left - padding.right);
  };

  const scaleY = (fare: number) => {
    return height - padding.bottom - ((fare - minFare) / (maxFareVal - minFare)) * (height - padding.top - padding.bottom);
  };

  // Generate Pareto line path
  const paretoPathD = useMemo(() => {
    if (paretoPoints.length < 2) return "";
    return paretoPoints.reduce((acc, p, idx) => {
      const x = scaleX(p.durationMinutes);
      const y = scaleY(p.fare);
      return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, "");
  }, [paretoPoints, minDuration, maxDuration, minFare, maxFareVal]);

  const activeHoverTrain = pinnedTooltipTrain || points.find(p => p.train.id === hoveredTrainId)?.train || null;
  const activeHoverPoint = points.find(p => p.train.id === activeHoverTrain?.id);

  // Filter metrics
  const activeCount = points.filter(p => p.fare <= maxBudget && p.durationMinutes <= maxDurationHours * 60).length;
  const isFiltered = activeCount < points.length;

  // Generate nice round ticks for axes
  const yTicks = useMemo(() => {
    const step = (maxFareVal - minFare) / 4;
    return [0, 1, 2, 3, 4].map(i => Math.round(minFare + i * step));
  }, [minFare, maxFareVal]);

  const xTicks = useMemo(() => {
    const step = (maxDuration - minDuration) / 4;
    return [1, 2, 3].map(i => {
      const mins = Math.round(minDuration + i * step);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return { mins, label: `${h}h ${m < 10 ? "0" : ""}${m}m` };
    });
  }, [minDuration, maxDuration]);

  // Smart Tooltip Side: Anchor to left if active point is in right 50%
  const activePointX = activeHoverPoint ? scaleX(activeHoverPoint.durationMinutes) : 0;
  const tooltipOnLeft = activePointX > width * 0.52;

  return (
    <div className="pareto-canvas-container" style={{ position: "relative" }}>
      {/* Top Controls / Direct Manipulation Sliders */}
      <div className="pareto-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span className="eyebrow" style={{ margin: 0 }}>VISUAL DECISION SUPPORT (AI511 INFOVIS)</span>
            <span
              style={{
                fontSize: "11px",
                padding: "2px 8px",
                borderRadius: "999px",
                background: isFiltered ? "rgba(245, 158, 11, 0.12)" : "rgba(16, 185, 129, 0.12)",
                color: isFiltered ? "#d97706" : "#059669",
                fontWeight: 700,
                border: `1px solid ${isFiltered ? "rgba(245, 158, 11, 0.3)" : "rgba(16, 185, 129, 0.3)"}`
              }}
            >
              {activeCount} of {points.length} candidates visible
            </span>
          </div>
          <h3 style={{ margin: "2px 0 4px 0", fontSize: "17px" }}>Interactive 2D Pareto Decision Space</h3>
          <p className="muted" style={{ margin: 0, fontSize: "12px" }}>
            Spatial multi-criteria trade-off: <strong>Speed (X)</strong> vs <strong>Cost (Y)</strong> vs <strong>Certainty (Color)</strong>.
          </p>
        </div>

        {/* Dynamic constraint sliders */}
        <div className="pareto-sliders">
          <div className="slider-group">
            <label>
              <span>Max Budget: <strong>₹{maxBudget}</strong></span>
              <input
                type="range"
                min={minFare}
                max={maxFareVal}
                step={50}
                value={maxBudget}
                onChange={e => setMaxBudget(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="slider-group">
            <label>
              <span>Max Duration: <strong>{maxDurationHours}h</strong></span>
              <input
                type="range"
                min={Math.floor((minDuration / 60) * 10) / 10}
                max={Math.ceil((maxDuration / 60) * 10) / 10}
                step={0.25}
                value={maxDurationHours}
                onChange={e => setMaxDurationHours(Number(e.target.value))}
              />
            </label>
          </div>
          {isFiltered && (
            <button
              className="text-button"
              onClick={() => {
                setMaxBudget(maxFareVal);
                setMaxDurationHours(Math.round((maxDuration / 60) * 10) / 10);
              }}
              style={{ fontSize: "11px", padding: "4px 8px", alignSelf: "flex-end", color: "var(--accent)" }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="svg-wrapper" style={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="pareto-svg"
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          <defs>
            {/* Gradient for Dominant Zone in bottom-left */}
            <linearGradient id="idealZoneGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
            {/* Filter glow for Pareto nodes */}
            <filter id="paretoGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Shaded "Ideal Zone" (Fast & Low Cost) */}
          <rect
            x={padding.left}
            y={scaleY(minFare + (maxFareVal - minFare) * 0.45)}
            width={(scaleX(minDuration + (maxDuration - minDuration) * 0.45) - padding.left)}
            height={(height - padding.bottom - scaleY(minFare + (maxFareVal - minFare) * 0.45))}
            fill="url(#idealZoneGrad)"
            rx={8}
          />
          <text
            x={padding.left + 10}
            y={height - padding.bottom - 10}
            fill="#10b981"
            fontSize="9"
            fontWeight="800"
            letterSpacing="0.05em"
            opacity={0.65}
          >
            ★ DOMINANT ZONE (FAST & ECONOMICAL)
          </text>

          {/* Subtle Gridlines */}
          {yTicks.map(fare => (
            <line
              key={`grid-y-${fare}`}
              x1={padding.left}
              x2={width - padding.right}
              y1={scaleY(fare)}
              y2={scaleY(fare)}
              stroke="var(--line)"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
            />
          ))}

          {xTicks.map(item => (
            <line
              key={`grid-x-${item.mins}`}
              x1={scaleX(item.mins)}
              x2={scaleX(item.mins)}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke="var(--line)"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
            />
          ))}

          {/* Budget Ceiling Constraint Line (Y) */}
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={scaleY(maxBudget)}
            y2={scaleY(maxBudget)}
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
          <text
            x={width - padding.right - 6}
            y={scaleY(maxBudget) - 6}
            fill="#ef4444"
            fontSize="10"
            textAnchor="end"
            fontWeight="700"
          >
            Budget Limit ₹{maxBudget}
          </text>

          {/* Duration Deadline Constraint Line (X) */}
          <line
            x1={scaleX(maxDurationHours * 60)}
            x2={scaleX(maxDurationHours * 60)}
            y1={padding.top}
            y2={height - padding.bottom}
            stroke="#3b82f6"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
          <text
            x={scaleX(maxDurationHours * 60) + 6}
            y={padding.top + 12}
            fill="#3b82f6"
            fontSize="10"
            fontWeight="700"
          >
            Max {maxDurationHours}h
          </text>

          {/* Pareto Frontier Curve Line */}
          {paretoPathD && (
            <path
              d={paretoPathD}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2.2}
              strokeDasharray="5 3"
              opacity={0.85}
            />
          )}

          {/* Axes */}
          <line
            x1={padding.left}
            x2={padding.left}
            y1={padding.top}
            y2={height - padding.bottom}
            stroke="var(--line)"
            strokeWidth={1.5}
          />
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={height - padding.bottom}
            y2={height - padding.bottom}
            stroke="var(--line)"
            strokeWidth={1.5}
          />

          {/* Y Axis Labels (Fare) */}
          {yTicks.map(fare => (
            <text
              key={`ylabel-${fare}`}
              x={padding.left - 8}
              y={scaleY(fare) + 3.5}
              fill="var(--muted)"
              fontSize="10.5"
              textAnchor="end"
            >
              ₹{fare}
            </text>
          ))}
          <text
            x={16}
            y={(padding.top + height - padding.bottom) / 2}
            fill="var(--muted)"
            fontSize="11"
            fontWeight="700"
            transform={`rotate(-90, 16, ${(padding.top + height - padding.bottom) / 2})`}
            textAnchor="middle"
          >
            Ticket Fare (₹)
          </text>

          {/* X Axis Labels (Duration) */}
          {xTicks.map(item => (
            <text
              key={`xlabel-${item.mins}`}
              x={scaleX(item.mins)}
              y={height - padding.bottom + 18}
              fill="var(--muted)"
              fontSize="10.5"
              textAnchor="middle"
            >
              {item.label}
            </text>
          ))}
          <text
            x={(padding.left + width - padding.right) / 2}
            y={height - 14}
            fill="var(--muted)"
            fontSize="11"
            fontWeight="700"
            textAnchor="middle"
          >
            Journey Duration (Faster → Leftward)
          </text>

          {/* Render Train Data Points */}
          {points.map((p, idx) => {
            const cx = scaleX(p.durationMinutes);
            const cy = scaleY(p.fare);
            const isHovered = hoveredTrainId === p.train.id || pinnedTooltipTrain?.id === p.train.id;
            const isSelected = selectedTrain?.id === p.train.id;
            const isOverBudget = p.fare > maxBudget || p.durationMinutes > maxDurationHours * 60;
            const isPareto = paretoPoints.some(pp => pp.train.id === p.train.id);

            // Color mapping based on certainty
            const dotColor =
              p.probStatus === "available" || p.probability >= 80
                ? "#10b981" // Emerald
                : p.probability >= 50
                ? "#f59e0b" // Amber
                : "#ef4444"; // Rose

            // Stagger label placement to prevent overlapping
            const labelOffsetY = idx % 2 === 0 ? -12 : 14;
            const labelOffsetX = idx % 3 === 0 ? -15 : 12;

            return (
              <g
                key={p.train.id}
                style={{ cursor: "pointer", transition: "all 0.25s ease" }}
                onClick={() => {
                  onSelectTrain(p.train);
                  setPinnedTooltipTrain(p.train);
                }}
                onMouseEnter={() => {
                  onHoverTrain(p.train.id);
                  setPinnedTooltipTrain(null);
                }}
                onMouseLeave={() => {
                  onHoverTrain(null);
                }}
              >
                {/* Outer Glow Halo for Selected or Pareto */}
                {(isSelected || isHovered || isPareto) && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected || isHovered ? 18 : 13}
                    fill={dotColor}
                    fillOpacity={isHovered || isSelected ? 0.35 : 0.15}
                    stroke={isPareto ? "var(--accent)" : "none"}
                    strokeWidth={isPareto ? 1.5 : 0}
                    filter={isPareto ? "url(#paretoGlow)" : undefined}
                  />
                )}

                {/* Primary Circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected || isHovered ? 8.5 : 6.5}
                  fill={isOverBudget ? "var(--muted)" : dotColor}
                  stroke={isSelected ? "#ffffff" : isPareto ? "var(--accent)" : "rgba(0,0,0,0.3)"}
                  strokeWidth={isSelected ? 3 : isPareto ? 2 : 1}
                  opacity={isOverBudget ? 0.3 : 1}
                />

                {/* Star mark for Pareto Optimal points */}
                {isPareto && !isOverBudget && (
                  <text
                    x={cx}
                    y={cy + 3.5}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="8"
                    fontWeight="900"
                    pointerEvents="none"
                  >
                    ★
                  </text>
                )}

                {/* Train Number Label next to dot */}
                <text
                  x={cx + labelOffsetX}
                  y={cy + labelOffsetY}
                  fontSize="10"
                  fontWeight={isSelected || isHovered ? "800" : "600"}
                  fill={isHovered || isSelected ? "var(--text)" : isOverBudget ? "var(--muted)" : "var(--text)"}
                  opacity={isOverBudget && !isHovered ? 0.4 : 0.9}
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}
                >
                  {p.train.number}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="pareto-legend">
          <div className="legend-item">
            <span className="legend-dot" style={{ background: "#10b981" }} />
            <span>High Clearance (≥80% / Available)</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: "#f59e0b" }} />
            <span>Moderate (50–79%)</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: "#ef4444" }} />
            <span>High Risk (&lt;50%)</span>
          </div>
          <div className="legend-item">
            <span className="legend-line" />
            <span>★ Pareto Frontier Line</span>
          </div>
        </div>

        {/* Coordinated Interactive Floating Tooltip (Smart Anchored) */}
        {activeHoverPoint && (
          <div
            className="pareto-tooltip-card"
            style={{
              position: "absolute",
              top: 15,
              ...(tooltipOnLeft ? { left: 75 } : { right: 25 }),
              zIndex: 30,
              boxShadow: "0 12px 36px rgba(0,0,0,0.28)",
              border: "1.5px solid var(--accent)",
              backdropFilter: "blur(8px)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px" }}>
              <div>
                <strong style={{ fontSize: "13.5px", display: "block" }}>{activeHoverPoint.train.name}</strong>
                <span className="muted" style={{ fontSize: "11px" }}>Train #{activeHoverPoint.train.number}</span>
              </div>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  padding: "3px 7px",
                  borderRadius: "6px",
                  whiteSpace: "nowrap",
                  background:
                    activeHoverPoint.probability >= 80 ? "#dcfce7" : activeHoverPoint.probability >= 50 ? "#fef3c7" : "#fee2e2",
                  color:
                    activeHoverPoint.probability >= 80 ? "#166534" : activeHoverPoint.probability >= 50 ? "#92400e" : "#991b1b"
                }}
              >
                {activeHoverPoint.probability}% Clearance
              </span>
            </div>

            {paretoPoints.some(pp => pp.train.id === activeHoverPoint.train.id) && (
              <div style={{ margin: "6px 0", fontSize: "10.5px", color: "var(--accent)", fontWeight: 700 }}>
                ★ Pareto Optimal Choice (Non-dominated)
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", margin: "8px 0" }}>
              <div className="tooltip-stat">
                <span className="muted" style={{ fontSize: "10px" }}>TIMINGS</span>
                <strong style={{ fontSize: "12px", display: "block" }}>
                  {activeHoverPoint.train.departure} → {activeHoverPoint.train.arrival}
                </strong>
                <small style={{ color: "var(--muted)", fontSize: "10.5px" }}>{activeHoverPoint.train.duration}</small>
              </div>
              <div className="tooltip-stat">
                <span className="muted" style={{ fontSize: "10px" }}>FARE</span>
                <strong style={{ fontSize: "14px", display: "block", color: "var(--accent)" }}>
                  ₹{activeHoverPoint.fare}
                </strong>
                <small style={{ color: "var(--muted)", fontSize: "10.5px" }}>{activeHoverPoint.train.classes.join(", ")}</small>
              </div>
            </div>

            {/* Frequency Framing */}
            <p style={{ margin: "4px 0 8px 0", fontSize: "11px", color: "var(--text)", fontWeight: 600 }}>
              💡 {activeHoverPoint.frequencyText}
            </p>

            <button
              className="primary-button"
              style={{ width: "100%", padding: "7px 10px", fontSize: "12px" }}
              onClick={() => onSelectTrain(activeHoverPoint.train)}
            >
              Select Train {activeHoverPoint.train.number}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
