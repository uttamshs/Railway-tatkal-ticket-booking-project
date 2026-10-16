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
  // Direct manipulation thresholds
  const [maxBudget, setMaxBudget] = useState<number>(1200);
  const [maxDurationHours, setMaxDurationHours] = useState<number>(5.5);
  const [pinnedTooltipTrain, setPinnedTooltipTrain] = useState<Train | null>(null);

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

  // Compute Pareto Frontier (Minimizing duration and fare, while maximizing probability)
  const paretoPoints = useMemo(() => {
    // A point is Pareto optimal if no other point is strictly faster AND strictly cheaper with equal or better prob
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
    // Sort by duration ascending for curve drawing
    return nonDominated.sort((a, b) => a.durationMinutes - b.durationMinutes);
  }, [points]);

  // Chart bounds & scales
  const width = 640;
  const height = 360;
  const padding = { top: 30, right: 35, bottom: 50, left: 65 };

  const minDuration = 200; // ~3h 20m
  const maxDuration = 360; // 6h 00m
  const minFare = 400;
  const maxFareVal = 1300;

  const scaleX = (mins: number) => {
    return padding.left + ((mins - minDuration) / (maxDuration - minDuration)) * (width - padding.left - padding.right);
  };

  const scaleY = (fare: number) => {
    // Invert Y so lowest fare is at bottom, highest fare is at top
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
  }, [paretoPoints]);

  const activeHoverTrain = pinnedTooltipTrain || points.find(p => p.train.id === hoveredTrainId)?.train || null;
  const activeHoverPoint = points.find(p => p.train.id === activeHoverTrain?.id);

  return (
    <div className="pareto-canvas-container">
      {/* Top Controls / Direct Manipulation Sliders */}
      <div className="pareto-header">
        <div>
          <span className="eyebrow">VISUAL DECISION SUPPORT (AI511 INFOVIS)</span>
          <h3 style={{ margin: "2px 0 4px 0", fontSize: "17px" }}>Interactive 2D Pareto Decision Space</h3>
          <p className="muted" style={{ margin: 0, fontSize: "12px" }}>
            Spatial multi-criteria trade-off: <strong>Speed (X)</strong> vs <strong>Cost (Y)</strong> vs <strong>Confirmation Certainty (Color)</strong>.
          </p>
        </div>

        {/* Dynamic constraint sliders */}
        <div className="pareto-sliders">
          <div className="slider-group">
            <label>
              <span>Max Budget: <strong>₹{maxBudget}</strong></span>
              <input
                type="range"
                min={500}
                max={1250}
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
                min={3.5}
                max={5.5}
                step={0.25}
                value={maxDurationHours}
                onChange={e => setMaxDurationHours(Number(e.target.value))}
              />
            </label>
          </div>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="svg-wrapper" style={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="pareto-svg"
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          {/* Subtle Gridlines */}
          {[500, 750, 1000, 1250].map(fare => (
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

          {[220, 260, 300, 340].map(dur => (
            <line
              key={`grid-x-${dur}`}
              x1={scaleX(dur)}
              x2={scaleX(dur)}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke="var(--line)"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
            />
          ))}

          {/* Interactive Dynamic Threshold Constraints */}
          {/* Budget Ceiling Line (Y) */}
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

          {/* Duration Deadline Line (X) */}
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

          {/* Pareto Frontier Line */}
          {paretoPathD && (
            <path
              d={paretoPathD}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2}
              strokeDasharray="5 3"
              opacity={0.85}
            />
          )}

          {/* Axes */}
          {/* Y Axis Line */}
          <line
            x1={padding.left}
            x2={padding.left}
            y1={padding.top}
            y2={height - padding.bottom}
            stroke="var(--line)"
            strokeWidth={1.5}
          />
          {/* X Axis Line */}
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={height - padding.bottom}
            y2={height - padding.bottom}
            stroke="var(--line)"
            strokeWidth={1.5}
          />

          {/* Y Axis Labels (Fare) */}
          {[500, 750, 1000, 1250].map(fare => (
            <text
              key={`ylabel-${fare}`}
              x={padding.left - 8}
              y={scaleY(fare) + 3}
              fill="var(--muted)"
              fontSize="10.5"
              textAnchor="end"
            >
              ₹{fare}
            </text>
          ))}
          <text
            x={15}
            y={(padding.top + height - padding.bottom) / 2}
            fill="var(--muted)"
            fontSize="11"
            fontWeight="700"
            transform={`rotate(-90, 15, ${(padding.top + height - padding.bottom) / 2})`}
            textAnchor="middle"
          >
            Fare (₹)
          </text>

          {/* X Axis Labels (Duration) */}
          {[
            { mins: 220, label: "3h 40m" },
            { mins: 260, label: "4h 20m" },
            { mins: 300, label: "5h 00m" },
            { mins: 340, label: "5h 40m" }
          ].map(item => (
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
            y={height - 12}
            fill="var(--muted)"
            fontSize="11"
            fontWeight="700"
            textAnchor="middle"
          >
            Journey Duration (Faster →)
          </text>

          {/* Render Train Data Points */}
          {points.map(p => {
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

            return (
              <g
                key={p.train.id}
                style={{ cursor: "pointer", transition: "transform 0.2s" }}
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
                {/* Outer Glow / Halo for Selected or Pareto */}
                {(isSelected || isHovered || isPareto) && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected || isHovered ? 16 : 12}
                    fill={dotColor}
                    fillOpacity={isHovered || isSelected ? 0.35 : 0.15}
                    stroke={isPareto ? "var(--accent)" : "none"}
                    strokeWidth={isPareto ? 1 : 0}
                  />
                )}

                {/* Primary Circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected || isHovered ? 8 : 6}
                  fill={isOverBudget ? "var(--muted)" : dotColor}
                  stroke={isSelected ? "#ffffff" : isPareto ? "var(--accent)" : "rgba(0,0,0,0.3)"}
                  strokeWidth={isSelected ? 2.5 : isPareto ? 2 : 1}
                  opacity={isOverBudget ? 0.45 : 1}
                />

                {/* Train Number Label next to dot */}
                <text
                  x={cx + 10}
                  y={cy + 3}
                  fontSize="10"
                  fontWeight={isSelected || isHovered ? "800" : "600"}
                  fill={isHovered || isSelected ? "var(--text)" : isOverBudget ? "var(--muted)" : "var(--text)"}
                  opacity={isOverBudget && !isHovered ? 0.5 : 0.9}
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
            <span>Pareto Optimal Frontier</span>
          </div>
        </div>

        {/* Coordinated Interactive Floating Tooltip */}
        {activeHoverPoint && (
          <div
            className="pareto-tooltip-card"
            style={{
              position: "absolute",
              top: 15,
              right: 20,
              zIndex: 30
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{activeHoverPoint.train.name} ({activeHoverPoint.train.number})</strong>
              <span
                style={{
                  fontSize: "10.5px",
                  fontWeight: 800,
                  padding: "2px 6px",
                  borderRadius: "4px",
                  background:
                    activeHoverPoint.probability >= 80 ? "#dcfce7" : activeHoverPoint.probability >= 50 ? "#fef3c7" : "#fee2e2",
                  color:
                    activeHoverPoint.probability >= 80 ? "#166534" : activeHoverPoint.probability >= 50 ? "#92400e" : "#991b1b"
                }}
              >
                {activeHoverPoint.probability}% Clearance
              </span>
            </div>

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
            <p style={{ margin: "4px 0", fontSize: "11px", color: "var(--text)", fontWeight: 600 }}>
              💡 {activeHoverPoint.frequencyText}
            </p>

            <button
              className="primary-button"
              style={{ width: "100%", padding: "6px 10px", fontSize: "12px", marginTop: "6px" }}
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
