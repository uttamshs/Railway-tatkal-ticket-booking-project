"use client";

import React, { useMemo, useState, useRef } from "react";
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
  const svgRef = useRef<SVGSVGElement>(null);

  // Progressive disclosure toggles
  const [showFilters, setShowFilters] = useState(false);
  const [showFrontier, setShowFrontier] = useState(true);
  const [showDominantZone, setShowDominantZone] = useState(true);
  const [showLegend, setShowLegend] = useState(false);

  // Mouse crosshair coordinates
  const [crosshair, setCrosshair] = useState<{ x: number; y: number; fare: number; mins: number } | null>(null);

  // Compute processed data points
  const points = useMemo(() => {
    return trains.map((t, idx) => {
      const dur = parseDurationMinutes(t.duration);
      const fare = t.fare || 500;
      const probInfo = estimateConfirmationProbability(t, t.classes[0] || "3A", quota);
      return {
        id: t.id,
        train: t,
        durationMinutes: dur,
        fare,
        probability: probInfo.probability,
        probStatus: probInfo.status,
        frequencyText: probInfo.frequencyText,
        factors: probInfo.factors,
        index: idx
      };
    });
  }, [trains, quota]);

  // Dynamic bounds calculation
  const { minDuration, maxDuration, minFare, maxFareVal } = useMemo(() => {
    if (points.length === 0) {
      return { minDuration: 200, maxDuration: 360, minFare: 400, maxFareVal: 1300 };
    }
    const durs = points.map(p => p.durationMinutes);
    const fares = points.map(p => p.fare);
    const minD = Math.max(120, Math.floor((Math.min(...durs) - 20) / 10) * 10);
    const maxD = Math.ceil((Math.max(...durs) + 30) / 10) * 10;
    const minF = Math.max(200, Math.floor((Math.min(...fares) - 80) / 50) * 50);
    const maxF = Math.ceil((Math.max(...fares) + 120) / 50) * 50;
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

  // SVG Chart bounds & scales
  const width = 720;
  const height = 400;
  const padding = { top: 40, right: 50, bottom: 60, left: 75 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const scaleX = (mins: number) => {
    return padding.left + ((mins - minDuration) / (maxDuration - minDuration)) * plotWidth;
  };

  const scaleY = (fare: number) => {
    return height - padding.bottom - ((fare - minFare) / (maxFareVal - minFare)) * plotHeight;
  };

  // Inverse scales for crosshair tracking
  const invertX = (svgX: number) => {
    const clampedX = Math.max(padding.left, Math.min(width - padding.right, svgX));
    const ratio = (clampedX - padding.left) / plotWidth;
    return Math.round(minDuration + ratio * (maxDuration - minDuration));
  };

  const invertY = (svgY: number) => {
    const clampedY = Math.max(padding.top, Math.min(height - padding.bottom, svgY));
    const ratio = (height - padding.bottom - clampedY) / plotHeight;
    return Math.round(minFare + ratio * (maxFareVal - minFare));
  };

  // Generate smooth cubic bezier curve for Pareto Frontier
  const paretoPathD = useMemo(() => {
    if (paretoPoints.length < 2) return "";
    return paretoPoints.reduce((acc, p, idx) => {
      const x = scaleX(p.durationMinutes);
      const y = scaleY(p.fare);
      if (idx === 0) return `M ${x} ${y}`;
      const prev = paretoPoints[idx - 1];
      const prevX = scaleX(prev.durationMinutes);
      const prevY = scaleY(prev.fare);
      const midX = (prevX + x) / 2;
      return `${acc} C ${midX} ${prevY}, ${midX} ${y}, ${x} ${y}`;
    }, "");
  }, [paretoPoints, minDuration, maxDuration, minFare, maxFareVal]);

  const activeHoverTrain = pinnedTooltipTrain || points.find(p => p.train.id === hoveredTrainId)?.train || null;
  const activeHoverPoint = points.find(p => p.train.id === activeHoverTrain?.id);

  // Filter metrics
  const activeCount = points.filter(p => p.fare <= maxBudget && p.durationMinutes <= maxDurationHours * 60).length;
  const isFiltered = activeCount < points.length;

  // Axis Ticks
  const yTicks = useMemo(() => {
    const step = (maxFareVal - minFare) / 4;
    return [0, 1, 2, 3, 4].map(i => Math.round(minFare + i * step));
  }, [minFare, maxFareVal]);

  const xTicks = useMemo(() => {
    const step = (maxDuration - minDuration) / 4;
    return [0, 1, 2, 3, 4].map(i => {
      const mins = Math.round(minDuration + i * step);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return { mins, label: `${h}h ${m < 10 ? "0" : ""}${m}m` };
    });
  }, [minDuration, maxDuration]);

  // Handle SVG pointer moves for interactive crosshairs
  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const svgX = (clientX / rect.width) * width;
    const svgY = (clientY / rect.height) * height;

    if (
      svgX >= padding.left &&
      svgX <= width - padding.right &&
      svgY >= padding.top &&
      svgY <= height - padding.bottom
    ) {
      setCrosshair({
        x: svgX,
        y: svgY,
        mins: invertX(svgX),
        fare: invertY(svgY)
      });
    } else {
      setCrosshair(null);
    }
  };

  const handleSvgPointerLeave = () => {
    setCrosshair(null);
  };

  // Tooltip dynamic coordinates
  const tooltipCoords = useMemo(() => {
    if (!activeHoverPoint) return null;
    const px = scaleX(activeHoverPoint.durationMinutes);
    const py = scaleY(activeHoverPoint.fare);
    const isRightHalf = px > width * 0.52;
    return {
      pointX: px,
      pointY: py,
      isRightHalf,
      left: isRightHalf ? `${((px - 290) / width) * 100}%` : `${((px + 24) / width) * 100}%`,
      top: `${Math.max(10, Math.min(65, ((py - 70) / height) * 100))}%`
    };
  }, [activeHoverPoint, minDuration, maxDuration, minFare, maxFareVal]);

  return (
    <div
      className="pareto-canvas-container"
      style={{
        position: "relative",
        borderRadius: "20px",
        padding: "24px",
        background: "radial-gradient(ellipse at 80% 0%, rgba(30, 64, 175, 0.08) 0%, var(--panel) 70%)",
        border: "1px solid var(--line)",
        boxShadow: "0 20px 45px -10px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.03)",
        marginBottom: "24px",
        transition: "all 0.3s ease"
      }}
    >
      {/* Top Header & Progressive Disclosure Controls */}
      <div className="pareto-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap", marginBottom: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "6px" }}>
            <span
              style={{
                fontSize: "10px",
                letterSpacing: "0.12em",
                fontWeight: 900,
                color: "var(--accent)",
                textTransform: "uppercase",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px"
              }}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }}></span>
              Visual Decision Frontier • AI511 InfoVis
            </span>
            <span
              style={{
                fontSize: "11px",
                padding: "3px 10px",
                borderRadius: "999px",
                background: isFiltered ? "rgba(245, 158, 11, 0.14)" : "rgba(16, 185, 129, 0.14)",
                color: isFiltered ? "#f59e0b" : "#10b981",
                fontWeight: 700,
                border: `1px solid ${isFiltered ? "rgba(245, 158, 11, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                transition: "all 0.2s"
              }}
            >
              {activeCount} of {points.length} services match
            </span>
          </div>

          <h3 style={{ margin: "0 0 4px", fontSize: "19px", fontWeight: 800, letterSpacing: "-0.02em" }}>
            Interactive Multi-Criteria Decision Space
          </h3>
          <p className="muted" style={{ margin: 0, fontSize: "12.5px" }}>
            Hover over any point to inspect service clearance. <strong>Leftward</strong> is faster · <strong>Downward</strong> is lower fare.
          </p>
        </div>

        {/* Action Toolbar with Progressive Disclosure Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setShowFrontier(!showFrontier)}
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "11.5px",
              fontWeight: 700,
              background: showFrontier ? "rgba(14, 165, 233, 0.14)" : "var(--panel2)",
              color: showFrontier ? "#0ea5e9" : "var(--muted)",
              border: `1px solid ${showFrontier ? "#0ea5e9" : "var(--line)"}`,
              transition: "all 0.2s"
            }}
          >
            ★ Pareto Curve {showFrontier ? "ON" : "OFF"}
          </button>

          <button
            type="button"
            onClick={() => setShowDominantZone(!showDominantZone)}
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "11.5px",
              fontWeight: 700,
              background: showDominantZone ? "rgba(16, 185, 129, 0.14)" : "var(--panel2)",
              color: showDominantZone ? "#10b981" : "var(--muted)",
              border: `1px solid ${showDominantZone ? "#10b981" : "var(--line)"}`,
              transition: "all 0.2s"
            }}
          >
            🎯 Ideal Zone {showDominantZone ? "ON" : "OFF"}
          </button>

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              fontSize: "11.5px",
              fontWeight: 700,
              background: showFilters || isFiltered ? "var(--accent)" : "var(--panel2)",
              color: showFilters || isFiltered ? "var(--bg)" : "var(--text)",
              border: "1px solid var(--line)",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s"
            }}
          >
            <span>⚙️ Budget &amp; Time Filters</span>
            <span>{showFilters ? "▲" : "▼"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLegend(!showLegend)}
            style={{
              padding: "6px 10px",
              borderRadius: "8px",
              fontSize: "11.5px",
              fontWeight: 600,
              background: "var(--panel2)",
              color: "var(--muted)",
              border: "1px solid var(--line)"
            }}
            title="Toggle Visual Legend"
          >
            ℹ️
          </button>
        </div>
      </div>

      {/* Progressive Disclosure Filter Drawer */}
      {showFilters && (
        <div
          style={{
            padding: "16px 20px",
            background: "var(--panel2)",
            borderRadius: "14px",
            border: "1px solid var(--line)",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "24px",
            flexWrap: "wrap",
            animation: "fadeIn 0.25s ease-out"
          }}
        >
          <div style={{ display: "flex", gap: "28px", flexWrap: "wrap", flex: 1 }}>
            {/* Budget Constraint Slider */}
            <div style={{ minWidth: "220px", flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                <span className="muted">Maximum Fare Ceiling:</span>
                <strong style={{ color: "#ef4444", fontWeight: 800 }}>₹{maxBudget}</strong>
              </div>
              <input
                type="range"
                min={minFare}
                max={maxFareVal}
                step={50}
                value={maxBudget}
                onChange={e => setMaxBudget(Number(e.target.value))}
                style={{
                  width: "100%",
                  accentColor: "#ef4444",
                  height: "6px",
                  borderRadius: "999px",
                  cursor: "pointer"
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--muted)", marginTop: "4px" }}>
                <span>₹{minFare}</span>
                <span>₹{maxFareVal}</span>
              </div>
            </div>

            {/* Journey Duration Constraint Slider */}
            <div style={{ minWidth: "220px", flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                <span className="muted">Maximum Travel Time:</span>
                <strong style={{ color: "#3b82f6", fontWeight: 800 }}>{maxDurationHours}h</strong>
              </div>
              <input
                type="range"
                min={Math.floor((minDuration / 60) * 10) / 10}
                max={Math.ceil((maxDuration / 60) * 10) / 10}
                step={0.25}
                value={maxDurationHours}
                onChange={e => setMaxDurationHours(Number(e.target.value))}
                style={{
                  width: "100%",
                  accentColor: "#3b82f6",
                  height: "6px",
                  borderRadius: "999px",
                  cursor: "pointer"
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--muted)", marginTop: "4px" }}>
                <span>{Math.floor(minDuration / 60)}h</span>
                <span>{Math.ceil(maxDuration / 60)}h</span>
              </div>
            </div>
          </div>

          {isFiltered && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setMaxBudget(maxFareVal);
                setMaxDurationHours(Math.round((maxDuration / 60) * 10) / 10);
              }}
              style={{
                fontSize: "12px",
                padding: "8px 14px",
                color: "var(--accent)",
                fontWeight: 700,
                border: "1px dashed var(--accent)",
                borderRadius: "8px"
              }}
            >
              ↺ Reset Constraints
            </button>
          )}
        </div>
      )}

      {/* Optional Visual Legend */}
      {showLegend && (
        <div
          style={{
            padding: "10px 16px",
            background: "var(--panel2)",
            borderRadius: "10px",
            border: "1px solid var(--line)",
            marginBottom: "14px",
            display: "flex",
            gap: "20px",
            flexWrap: "wrap",
            alignItems: "center",
            fontSize: "11.5px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }}></span>
            <span>High Clearance (≥80% / Confirmed)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b" }}></span>
            <span>Moderate (50–79% / RAC)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444" }}></span>
            <span>High Risk (&lt;50% Waitlisted)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "14px", color: "var(--accent)" }}>★</span>
            <span>Pareto Non-Dominated Winner</span>
          </div>
        </div>
      )}

      {/* SVG Canvas Workspace */}
      <div
        className="svg-wrapper"
        style={{
          position: "relative",
          borderRadius: "14px",
          background: "var(--panel2)",
          border: "1px solid var(--line)",
          overflow: "hidden"
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="pareto-svg"
          onPointerMove={handleSvgPointerMove}
          onPointerLeave={handleSvgPointerLeave}
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            cursor: "crosshair",
            userSelect: "none"
          }}
        >
          <defs>
            {/* Dominant Zone Gradient */}
            <linearGradient id="goldenQuadrantGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.16" />
              <stop offset="60%" stopColor="#0ea5e9" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>

            {/* Pareto Curve Gradient */}
            <linearGradient id="paretoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>

            {/* Glowing filter */}
            <filter id="canvasGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Golden Dominant Zone (Fast & Low Cost quadrant) */}
          {showDominantZone && (
            <g>
              <rect
                x={padding.left}
                y={scaleY(minFare + (maxFareVal - minFare) * 0.48)}
                width={scaleX(minDuration + (maxDuration - minDuration) * 0.48) - padding.left}
                height={height - padding.bottom - scaleY(minFare + (maxFareVal - minFare) * 0.48)}
                fill="url(#goldenQuadrantGrad)"
                rx={10}
              />
              <text
                x={padding.left + 12}
                y={height - padding.bottom - 12}
                fill="#10b981"
                fontSize="10"
                fontWeight="800"
                letterSpacing="0.06em"
                opacity={0.8}
              >
                ★ GOLDEN QUADRANT (FASTEST &amp; ECONOMICAL)
              </text>
            </g>
          )}

          {/* Clean Horizontal Gridlines */}
          {yTicks.map(fare => (
            <g key={`ygrid-${fare}`}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={scaleY(fare)}
                y2={scaleY(fare)}
                stroke="var(--line)"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
              />
              <text
                x={padding.left - 10}
                y={scaleY(fare) + 3.5}
                fill="var(--muted)"
                fontSize="10.5"
                textAnchor="end"
                fontWeight="500"
              >
                ₹{fare}
              </text>
            </g>
          ))}

          {/* Clean Vertical Gridlines */}
          {xTicks.map(item => (
            <g key={`xgrid-${item.mins}`}>
              <line
                x1={scaleX(item.mins)}
                x2={scaleX(item.mins)}
                y1={padding.top}
                y2={height - padding.bottom}
                stroke="var(--line)"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
              />
              <text
                x={scaleX(item.mins)}
                y={height - padding.bottom + 18}
                fill="var(--muted)"
                fontSize="10.5"
                textAnchor="middle"
                fontWeight="500"
              >
                {item.label}
              </text>
            </g>
          ))}

          {/* Y Axis Title */}
          <text
            x={18}
            y={(padding.top + height - padding.bottom) / 2}
            fill="var(--muted)"
            fontSize="11"
            fontWeight="700"
            letterSpacing="0.05em"
            transform={`rotate(-90, 18, ${(padding.top + height - padding.bottom) / 2})`}
            textAnchor="middle"
          >
            FARE (₹ INR)
          </text>

          {/* X Axis Title */}
          <text
            x={(padding.left + width - padding.right) / 2}
            y={height - 18}
            fill="var(--muted)"
            fontSize="11"
            fontWeight="700"
            letterSpacing="0.05em"
            textAnchor="middle"
          >
            ← FASTER JOURNEY DURATION (HOURS)
          </text>

          {/* Dynamic Budget Limit Constraint Line */}
          {maxBudget < maxFareVal && (
            <g>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={scaleY(maxBudget)}
                y2={scaleY(maxBudget)}
                stroke="#ef4444"
                strokeWidth={1.8}
                strokeDasharray="6 4"
              />
              <rect
                x={width - padding.right - 105}
                y={scaleY(maxBudget) - 18}
                width={100}
                height={16}
                fill="rgba(239, 68, 68, 0.15)"
                stroke="#ef4444"
                rx={4}
              />
              <text
                x={width - padding.right - 55}
                y={scaleY(maxBudget) - 6}
                fill="#ef4444"
                fontSize="9.5"
                textAnchor="middle"
                fontWeight="800"
              >
                Budget Cap ₹{maxBudget}
              </text>
            </g>
          )}

          {/* Dynamic Travel Time Limit Constraint Line */}
          {maxDurationHours < Math.round((maxDuration / 60) * 10) / 10 && (
            <g>
              <line
                x1={scaleX(maxDurationHours * 60)}
                x2={scaleX(maxDurationHours * 60)}
                y1={padding.top}
                y2={height - padding.bottom}
                stroke="#3b82f6"
                strokeWidth={1.8}
                strokeDasharray="6 4"
              />
              <rect
                x={scaleX(maxDurationHours * 60) + 4}
                y={padding.top + 4}
                width={85}
                height={16}
                fill="rgba(59, 130, 246, 0.15)"
                stroke="#3b82f6"
                rx={4}
              />
              <text
                x={scaleX(maxDurationHours * 60) + 46}
                y={padding.top + 16}
                fill="#3b82f6"
                fontSize="9.5"
                textAnchor="middle"
                fontWeight="800"
              >
                Max {maxDurationHours}h Limit
              </text>
            </g>
          )}

          {/* Smooth Animated Pareto Frontier Curve */}
          {showFrontier && paretoPathD && (
            <g>
              <path
                d={paretoPathD}
                fill="none"
                stroke="url(#paretoGrad)"
                strokeWidth={2.8}
                strokeLinecap="round"
                strokeDasharray="6 4"
                opacity={0.88}
                filter="url(#canvasGlow)"
              />
            </g>
          )}

          {/* Interactive Mouse Crosshair Tracking */}
          {crosshair && (
            <g pointerEvents="none">
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={crosshair.y}
                y2={crosshair.y}
                stroke="var(--accent)"
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.7}
              />
              <line
                x1={crosshair.x}
                x2={crosshair.x}
                y1={padding.top}
                y2={height - padding.bottom}
                stroke="var(--accent)"
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.7}
              />
              {/* Axis Value Chips */}
              <rect
                x={padding.left - 54}
                y={crosshair.y - 10}
                width={48}
                height={20}
                fill="var(--accent)"
                rx={4}
              />
              <text
                x={padding.left - 30}
                y={crosshair.y + 4}
                fill="var(--bg)"
                fontSize="10"
                fontWeight="800"
                textAnchor="middle"
              >
                ₹{crosshair.fare}
              </text>

              <rect
                x={crosshair.x - 30}
                y={height - padding.bottom + 4}
                width={60}
                height={18}
                fill="var(--accent)"
                rx={4}
              />
              <text
                x={crosshair.x}
                y={height - padding.bottom + 17}
                fill="var(--bg)"
                fontSize="10"
                fontWeight="800"
                textAnchor="middle"
              >
                {Math.floor(crosshair.mins / 60)}h {crosshair.mins % 60}m
              </text>
            </g>
          )}

          {/* Render Service Data Points */}
          {points.map((p, idx) => {
            const cx = scaleX(p.durationMinutes);
            const cy = scaleY(p.fare);
            const isHovered = hoveredTrainId === p.train.id || pinnedTooltipTrain?.id === p.train.id;
            const isSelected = selectedTrain?.id === p.train.id;
            const isOverBudget = p.fare > maxBudget || p.durationMinutes > maxDurationHours * 60;
            const isPareto = paretoPoints.some(pp => pp.train.id === p.train.id);

            // Clearance color
            const pointColor =
              p.probStatus === "available" || p.probability >= 80
                ? "#10b981" // Emerald
                : p.probability >= 50
                ? "#f59e0b" // Amber
                : "#ef4444"; // Rose

            // Clean alternating label offset
            const labelOffsetY = idx % 2 === 0 ? -14 : 18;
            const labelOffsetX = idx % 3 === 0 ? -18 : 14;

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
                {/* Radiating Ripple Waves on Hover/Selection */}
                {(isSelected || isHovered) && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={22}
                    fill={pointColor}
                    fillOpacity={0.2}
                    stroke={pointColor}
                    strokeWidth={1.5}
                    filter="url(#canvasGlow)"
                  />
                )}

                {/* Outer Pareto Halo */}
                {isPareto && !isOverBudget && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected || isHovered ? 14 : 11}
                    fill="none"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    strokeDasharray="2 2"
                    opacity={0.8}
                  />
                )}

                {/* Main Node Circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected || isHovered ? 9 : 7}
                  fill={isOverBudget ? "var(--muted)" : pointColor}
                  stroke={isSelected ? "#ffffff" : isPareto ? "#0ea5e9" : "rgba(0,0,0,0.4)"}
                  strokeWidth={isSelected ? 3 : 2}
                  opacity={isOverBudget ? 0.35 : 1}
                />

                {/* Pareto Star Crown */}
                {isPareto && !isOverBudget && (
                  <text
                    x={cx}
                    y={cy + 3.5}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="8.5"
                    fontWeight="900"
                    pointerEvents="none"
                  >
                    ★
                  </text>
                )}

                {/* Train Identifier Tag */}
                <text
                  x={cx + labelOffsetX}
                  y={cy + labelOffsetY}
                  fontSize="10"
                  fontWeight={isSelected || isHovered ? "800" : "600"}
                  fill={isSelected ? "var(--accent)" : isHovered ? "var(--text)" : isOverBudget ? "var(--muted)" : "var(--text)"}
                  opacity={isOverBudget && !isHovered ? 0.45 : 0.9}
                  style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}
                >
                  {p.train.number}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Dynamic Contextual Tooltip Card Anchored Near Point */}
        {activeHoverPoint && tooltipCoords && (
          <div
            className="pareto-tooltip-card"
            style={{
              position: "absolute",
              top: tooltipCoords.top,
              left: tooltipCoords.left,
              zIndex: 40,
              width: "285px",
              padding: "16px",
              borderRadius: "14px",
              background: "rgba(15, 23, 42, 0.92)",
              backdropFilter: "blur(14px)",
              border: "1.5px solid var(--accent)",
              boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.5), 0 0 20px rgba(14, 165, 233, 0.2)",
              animation: "fadeIn 0.2s ease-out"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
              <div>
                <strong style={{ fontSize: "14px", color: "#f8fafc", display: "block" }}>
                  {activeHoverPoint.train.name}
                </strong>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                  #{activeHoverPoint.train.number} • {activeHoverPoint.train.trainType}
                </span>
              </div>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  padding: "3px 8px",
                  borderRadius: "6px",
                  whiteSpace: "nowrap",
                  background:
                    activeHoverPoint.probability >= 80 ? "#10b981" : activeHoverPoint.probability >= 50 ? "#f59e0b" : "#ef4444",
                  color: "#ffffff"
                }}
              >
                {activeHoverPoint.probability}% Clearance
              </span>
            </div>

            {paretoPoints.some(pp => pp.train.id === activeHoverPoint.train.id) && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11px",
                  color: "#38bdf8",
                  fontWeight: 700,
                  marginBottom: "8px"
                }}
              >
                <span>★</span>
                <span>Pareto Non-Dominated Frontier Choice</span>
              </div>
            )}

            {/* Quick Metrics */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
                padding: "8px 10px",
                background: "rgba(255, 255, 255, 0.05)",
                borderRadius: "8px",
                marginBottom: "10px",
                fontSize: "12px"
              }}
            >
              <div>
                <span style={{ color: "var(--muted)", fontSize: "10px", display: "block" }}>SCHEDULE</span>
                <strong style={{ color: "#f8fafc" }}>
                  {activeHoverPoint.train.departure} → {activeHoverPoint.train.arrival}
                </strong>
                <span style={{ color: "var(--muted)", fontSize: "10.5px", display: "block" }}>
                  {activeHoverPoint.train.duration}
                </span>
              </div>
              <div>
                <span style={{ color: "var(--muted)", fontSize: "10px", display: "block" }}>STARTING FARE</span>
                <strong style={{ color: "var(--accent)", fontSize: "14px" }}>
                  ₹{activeHoverPoint.fare}
                </strong>
                <span style={{ color: "var(--muted)", fontSize: "10.5px", display: "block" }}>
                  {activeHoverPoint.train.classes.join(" · ")}
                </span>
              </div>
            </div>

            {/* Natural Frequency Framing (Gigerenzer) */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "6px",
                fontSize: "11.5px",
                color: "#e2e8f0",
                lineHeight: "1.4",
                marginBottom: "12px"
              }}
            >
              <span>💡</span>
              <span>{activeHoverPoint.frequencyText}</span>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={() => onSelectTrain(activeHoverPoint.train)}
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "12px",
                fontWeight: 800,
                borderRadius: "8px",
                background: "var(--accent)",
                color: "var(--bg)",
                border: "none",
                cursor: "pointer"
              }}
            >
              Select Train {activeHoverPoint.train.number} →
            </button>
          </div>
        )}

        {/* Empty State when filters exclude all */}
        {activeCount === 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(15, 23, 42, 0.8)",
              backdropFilter: "blur(6px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "20px"
            }}
          >
            <span style={{ fontSize: "36px", marginBottom: "8px" }}>🔍</span>
            <strong style={{ fontSize: "16px", color: "#f8fafc", marginBottom: "4px" }}>
              No services meet current constraints
            </strong>
            <p className="muted" style={{ fontSize: "12px", maxWidth: "340px", margin: "0 0 14px" }}>
              Relax your budget ceiling (currently ₹{maxBudget}) or journey time limit (currently {maxDurationHours}h) to reveal viable trains.
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setMaxBudget(maxFareVal);
                setMaxDurationHours(Math.round((maxDuration / 60) * 10) / 10);
              }}
              style={{ fontSize: "12px", padding: "8px 16px" }}
            >
              ↺ Reset All Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
