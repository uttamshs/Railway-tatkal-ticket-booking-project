"use client";

import React, { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { Train } from "../lib/types";
import { estimateConfirmationProbability } from "../lib/probabilityModel";

/* ═══════════════════════════════════════════════════════════════════════════
   ThreeDDecisionCanvas — Ultra-Premium Enterprise 3D Visualizer
   Features:
   • Green-to-Red spatial decision gradient field (better trains on greener side)
   • Multi-objective train dominance score S ∈ [0, 1] coloring every node & stem
   • Ultra-premium dual-mode atmosphere:
       - Dark: Obsidian Cosmic Nebula with emerald-amber-ruby auroras
       - Light: High-End Frosted Platinum Laboratory with refractive glass nodes
   • Full 3D coordinate bounding cage with floor decision heatmap & sector labels
   • Permanent grounding stems with landing pucks & 3-axis laser crosshairs
   • Google Earth-style 3D gimbal compass & camera presets
   • Zero external dependencies — Pure Canvas 2D + 3D Projection Math
   ═══════════════════════════════════════════════════════════════════════════ */

interface Props {
  trains: Train[];
  selectedTrain: Train | null;
  onSelectTrain: (train: Train) => void;
  onBookTrain: (train: Train) => void;
  hoveredTrainId: string | null;
  onHoverTrain: (id: string | null) => void;
  quota?: string;
  theme?: "dark" | "light";
}

// ─── 3×3 Matrix Math ───────────────────────────────────────────────────────

type Mat3 = [
  number, number, number,
  number, number, number,
  number, number, number
];

function mat3Mul(a: Mat3, b: Mat3): Mat3 {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
    a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
    a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
    a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
    a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
    a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
    a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
}

function rotX(a: number): Mat3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}

function rotY(a: number): Mat3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}

function applyMat3(m: Mat3, v: [number, number, number]): [number, number, number] {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

function project(
  v: [number, number, number],
  cx: number,
  cy: number,
  fov: number,
  zoom: number
): { sx: number; sy: number; depth: number } {
  const z = v[2] + fov;
  const scale = (fov / Math.max(10, z)) * zoom;
  return { sx: cx + v[0] * scale, sy: cy - v[1] * scale, depth: v[2] };
}

function parseMins(d: string): number {
  const m = d.match(/(\d+)h\s*(\d*)m?/);
  if (!m) return 300;
  return parseInt(m[1] || "0") * 60 + parseInt(m[2] || "0");
}

function isParetoOptimal(
  pts: Array<{ dur: number; fare: number; prob: number }>,
  idx: number
): boolean {
  const p = pts[idx];
  return !pts.some(
    (q, j) =>
      j !== idx &&
      q.dur <= p.dur &&
      q.fare <= p.fare &&
      q.prob >= p.prob &&
      (q.dur < p.dur || q.fare < p.fare || q.prob > p.prob)
  );
}

// ─── Multi-Attribute Gradient Color Along Green-to-Red Continuum ──────────

export function getDominanceColor(score: number): {
  base: string;
  glow: string;
  border: string;
  label: string;
} {
  // score ∈ [0, 1] where 1.0 = best (emerald), 0.0 = worst (crimson)
  if (score >= 0.72) {
    return {
      base: "#10b981",
      glow: "rgba(16, 185, 129, 0.55)",
      border: "#059669",
      label: "Optimal / Top Tier",
    };
  }
  if (score >= 0.52) {
    return {
      base: "#84cc16",
      glow: "rgba(132, 204, 22, 0.5)",
      border: "#65a30d",
      label: "Strong Value",
    };
  }
  if (score >= 0.38) {
    return {
      base: "#f59e0b",
      glow: "rgba(245, 158, 11, 0.5)",
      border: "#d97706",
      label: "Balanced / RAC",
    };
  }
  return {
    base: "#ef4444",
    glow: "rgba(239, 68, 68, 0.55)",
    border: "#dc2626",
    label: "Risky / Waitlist",
  };
}

// Microscopic star dust for dark mode
const STARS: { x: number; y: number; r: number; a: number }[] = Array.from(
  { length: 140 },
  (_, i) => {
    const s1 = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    const s2 = Math.sin(i * 269.5 + 183.3) * 43758.5453;
    const s3 = Math.sin(i * 44.3 + 52.1) * 43758.5453;
    return {
      x: s1 - Math.floor(s1),
      y: s2 - Math.floor(s2),
      r: 0.6 + (s3 - Math.floor(s3)) * 1.4,
      a: 0.2 + (Math.sin(i * 17.3) * 0.5 + 0.5) * 0.6,
    };
  }
);

// Camera Presets
const VIEW_PRESETS = {
  iso: mat3Mul(rotX(-0.44), rotY(0.58)),
  top: rotX(-Math.PI / 2 + 0.05),
  front: rotX(-0.06),
};

export function ThreeDDecisionCanvas({
  trains,
  selectedTrain,
  onSelectTrain,
  onBookTrain,
  hoveredTrainId,
  onHoverTrain,
  quota = "General",
  theme = "light",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  // Rotation & camera
  const rotationRef = useRef<Mat3>(VIEW_PRESETS.iso);
  const zoomRef = useRef<number>(1.0);
  const dragRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });
  const velocityRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  // Tooltip
  const [tooltip, setTooltip] = useState<{
    train: Train;
    prob: number;
    probStatus: string;
    freqText: string;
    factors: string[];
    isPareto: boolean;
    screenX: number;
    screenY: number;
    dur: number;
    fare: number;
    score: number;
  } | null>(null);

  const [activeView, setActiveView] = useState<"iso" | "top" | "front" | "free">("iso");

  // Normalized points & dominance calculation
  const { points, minD, maxD, minF, maxF, stats } = useMemo(() => {
    const raw = trains.map((t) => {
      const dur = parseMins(t.duration);
      const fare = t.fare || 500;
      const pi = estimateConfirmationProbability(t, t.classes[0] || "3A", quota);
      return {
        id: t.id,
        train: t,
        dur,
        fare,
        prob: pi.probability,
        probStatus: pi.status,
        freqText: pi.frequencyText,
        factors: pi.factors,
      };
    });

    const durs = raw.map((p) => p.dur);
    const fares = raw.map((p) => p.fare);

    const minDur = Math.min(...durs, 180);
    const maxDur = Math.max(...durs, 360);
    const minFare = Math.min(...fares, 300);
    const maxFare = Math.max(...fares, 1500);

    const norm = (v: number, lo: number, hi: number) =>
      hi === lo ? 0 : ((v - lo) / (hi - lo)) * 2 - 1;

    let greenCount = 0;
    let yellowCount = 0;
    let redCount = 0;

    const processed = raw.map((p, i) => {
      // Relative ratios [0, 1] for quality calculation
      const durRatio = (p.dur - minDur) / Math.max(1, maxDur - minDur); // 0 = fast, 1 = slow
      const fareRatio = (p.fare - minFare) / Math.max(1, maxFare - minFare); // 0 = cheap, 1 = pricey
      const probRatio = p.prob; // 0 = low, 1 = 100%

      // Multi-Attribute Dominance Score S ∈ [0, 1]: Higher = Better
      const score = Math.max(
        0,
        Math.min(1, 0.48 * probRatio + 0.32 * (1 - durRatio) + 0.20 * (1 - fareRatio))
      );

      if (score >= 0.6) greenCount++;
      else if (score >= 0.38) yellowCount++;
      else redCount++;

      return {
        ...p,
        // X = Duration (left = fast, right = slow)
        // Y = Probability (bottom = 0%, top = 100%)
        // Z = Fare (front = cheap, back = expensive)
        nx: norm(p.dur, minDur, maxDur),
        ny: norm(p.prob, 0, 1),
        nz: -norm(p.fare, minFare, maxFare),
        score,
        pareto: isParetoOptimal(raw, i),
        rawDur: p.dur,
        rawFare: p.fare,
      };
    });

    return {
      points: processed,
      minD: minDur,
      maxD: maxDur,
      minF: minFare,
      maxF: maxFare,
      stats: { greenCount, yellowCount, redCount },
    };
  }, [trains, quota]);

  // Render loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width / (window.devicePixelRatio || 1);
    const H = canvas.height / (window.devicePixelRatio || 1);
    const cx = W / 2;
    const cy = H / 2 + 10;
    const fov = 520;
    const zoom = Math.min(W, H) * 0.38 * zoomRef.current;
    const rot = rotationRef.current;
    const isDark = theme !== "light";

    ctx.save();
    ctx.clearRect(0, 0, W, H);

    // ── 1. ULTRA-PREMIUM ATMOSPHERE ──────────────────────────────────────────
    if (isDark) {
      // Obsidian cosmic void with subtle chromatic depth
      const bgGrad = ctx.createRadialGradient(cx, cy * 0.7, 40, cx, cy * 0.7, Math.max(W, H) * 0.95);
      bgGrad.addColorStop(0, "#0b1528");
      bgGrad.addColorStop(0.5, "#050a14");
      bgGrad.addColorStop(1, "#020408");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Distant celestial particles
      for (const s of STARS) {
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(186, 218, 255, ${s.a * 0.75})`;
        ctx.fill();
      }
    } else {
      // Ultra-premium frosted platinum titanium laboratory
      const bgGrad = ctx.createRadialGradient(cx, cy * 0.6, 60, cx, cy * 0.7, Math.max(W, H) * 0.95);
      bgGrad.addColorStop(0, "#ffffff");
      bgGrad.addColorStop(0.5, "#ffffff");
      bgGrad.addColorStop(0.85, "#f0f6ff");
      bgGrad.addColorStop(1, "#dbeafe");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Subtle architectural platinum dot matrix
      ctx.fillStyle = "rgba(37, 99, 235, 0.09)";
      const dotSpacing = 32;
      for (let x = 16; x < W; x += dotSpacing) {
        for (let y = 16; y < H; y += dotSpacing) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Palette tokens
    const cageColor = isDark ? "rgba(148, 163, 184, 0.22)" : "rgba(37, 99, 235, 0.26)";
    const gridMajor = isDark ? "rgba(56, 189, 248, 0.35)" : "rgba(37, 99, 235, 0.32)";
    const gridMinor = isDark ? "rgba(56, 189, 248, 0.12)" : "rgba(37, 99, 235, 0.12)";
    const textPrimary = isDark ? "#f8fafc" : "#0f172a";
    const textMuted = isDark ? "rgba(148, 163, 184, 0.8)" : "#64748b";

    // ── 2. GREEN-TO-RED SPATIAL GRADIENT FIELD IN THE 3D DECISION VOLUME ─────
    // Project the 4 corners of the decision space mid-plane (y = 0 or on floor)
    const optCorner = project(applyMat3(rot, [-1, -0.98, 1]), cx, cy, fov, zoom); // Green optimal
    const riskCorner = project(applyMat3(rot, [1, -0.98, -1]), cx, cy, fov, zoom); // Red risk
    const mid1 = project(applyMat3(rot, [-1, -0.98, -1]), cx, cy, fov, zoom);
    const mid2 = project(applyMat3(rot, [1, -0.98, 1]), cx, cy, fov, zoom);

    // Draw the green-to-red luminous gradient wash across the decision space
    const spaceGrad = ctx.createLinearGradient(optCorner.sx, optCorner.sy, riskCorner.sx, riskCorner.sy);
    if (isDark) {
      spaceGrad.addColorStop(0, "rgba(16, 185, 129, 0.32)"); // Radiant Emerald (Optimal side)
      spaceGrad.addColorStop(0.35, "rgba(132, 204, 22, 0.18)"); // Chartreuse
      spaceGrad.addColorStop(0.65, "rgba(245, 158, 11, 0.16)"); // Amber
      spaceGrad.addColorStop(1, "rgba(239, 68, 68, 0.28)"); // Ruby Red (Risk side)
    } else {
      spaceGrad.addColorStop(0, "rgba(16, 185, 129, 0.24)"); // Emerald
      spaceGrad.addColorStop(0.4, "rgba(132, 204, 22, 0.14)"); // Light Chartreuse
      spaceGrad.addColorStop(0.7, "rgba(245, 158, 11, 0.14)"); // Amber
      spaceGrad.addColorStop(1, "rgba(239, 68, 68, 0.22)"); // Red
    }

    ctx.beginPath();
    ctx.moveTo(optCorner.sx, optCorner.sy);
    ctx.lineTo(mid1.sx, mid1.sy);
    ctx.lineTo(riskCorner.sx, riskCorner.sy);
    ctx.lineTo(mid2.sx, mid2.sy);
    ctx.closePath();
    ctx.fillStyle = spaceGrad;
    ctx.fill();

    // ── 3. 3D Coordinate Bounding Cage ───────────────────────────────────────
    const cageCorners: [number, number, number][] = [
      [-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], // Floor
      [-1,  1, -1], [1,  1, -1], [1,  1, 1], [-1,  1, 1], // Ceiling
    ];
    const projCorners = cageCorners.map((pt) => project(applyMat3(rot, pt), cx, cy, fov, zoom));

    const edges: [number, number][] = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];

    ctx.strokeStyle = cageColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (const [fromIdx, toIdx] of edges) {
      const p1 = projCorners[fromIdx];
      const p2 = projCorners[toIdx];
      ctx.beginPath();
      ctx.moveTo(p1.sx, p1.sy);
      ctx.lineTo(p2.sx, p2.sy);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // ── 4. Floor Grid Subdivisions ───────────────────────────────────────────
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * 2 - 1;
      const isMajor = i === 0 || i === steps;
      ctx.strokeStyle = isMajor ? gridMajor : gridMinor;
      ctx.lineWidth = isMajor ? 1.5 : 0.75;

      // Lines along Z
      const x0 = project(applyMat3(rot, [-1, -1, t]), cx, cy, fov, zoom);
      const x1 = project(applyMat3(rot, [ 1, -1, t]), cx, cy, fov, zoom);
      ctx.beginPath(); ctx.moveTo(x0.sx, x0.sy); ctx.lineTo(x1.sx, x1.sy); ctx.stroke();

      // Lines along X
      const z0 = project(applyMat3(rot, [t, -1, -1]), cx, cy, fov, zoom);
      const z1 = project(applyMat3(rot, [t, -1,  1]), cx, cy, fov, zoom);
      ctx.beginPath(); ctx.moveTo(z0.sx, z0.sy); ctx.lineTo(z1.sx, z1.sy); ctx.stroke();
    }

    // ── 5. Sector Annotations on the Decision Surface ────────────────────────
    // Green Optimal Sector Label
    ctx.save();
    ctx.font = "bold 10px Inter, system-ui";
    ctx.fillStyle = "#10b981";
    ctx.textAlign = "center";
    ctx.fillText("🟢 OPTIMAL VALUE SECTOR", optCorner.sx, optCorner.sy + 18);
    ctx.font = "9px Inter, system-ui";
    ctx.fillStyle = isDark ? "rgba(16, 185, 129, 0.75)" : "#047857";
    ctx.fillText("(Fast · High Clearance · Value)", optCorner.sx, optCorner.sy + 30);

    // Red Risk Sector Label
    ctx.font = "bold 10px Inter, system-ui";
    ctx.fillStyle = "#ef4444";
    ctx.textAlign = "center";
    ctx.fillText("🔴 HIGH RISK / COMPROMISE", riskCorner.sx, riskCorner.sy - 18);
    ctx.font = "9px Inter, system-ui";
    ctx.fillStyle = isDark ? "rgba(239, 68, 68, 0.75)" : "#b91c1c";
    ctx.fillText("(Longer · Low Probability · Cost)", riskCorner.sx, riskCorner.sy - 6);
    ctx.restore();

    // ── 6. Numerical Scale Ticks on Coordinate Axes ──────────────────────────
    // X Axis: Duration
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * 2 - 1;
      const minsVal = Math.round(minD + (i / steps) * (maxD - minD));
      const hours = Math.floor(minsVal / 60);
      const mins = minsVal % 60;
      const label = `${hours}h${mins ? `${mins}m` : ""}`;
      const tick = project(applyMat3(rot, [t, -1, -1]), cx, cy, fov, zoom);

      ctx.fillStyle = textMuted;
      ctx.font = "9.5px Inter, system-ui";
      ctx.textAlign = "center";
      ctx.fillText(label, tick.sx, tick.sy + 15);
    }

    // Y Axis: Probability
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * 2 - 1;
      const probPercent = Math.round((i / steps) * 100);
      const label = `${probPercent}%`;
      const tick = project(applyMat3(rot, [-1, t, -1]), cx, cy, fov, zoom);

      ctx.fillStyle = textMuted;
      ctx.font = "9.5px Inter, system-ui";
      ctx.textAlign = "right";
      ctx.fillText(label, tick.sx - 8, tick.sy + 3);
    }

    // Z Axis: Fare
    for (let i = 0; i <= steps; i += 2) {
      const t = (i / steps) * 2 - 1;
      const fareVal = Math.round(minF + (i / steps) * (maxF - minF));
      const label = `₹${fareVal}`;
      const tick = project(applyMat3(rot, [-1, -1, -t]), cx, cy, fov, zoom);

      ctx.fillStyle = textMuted;
      ctx.font = "9.5px Inter, system-ui";
      ctx.textAlign = "right";
      ctx.fillText(label, tick.sx - 8, tick.sy + 10);
    }

    // ── 7. Primary 3D Axes with Direction Arrows & Titles ────────────────────
    const axes: [string, [number, number, number], [number, number, number], string][] = [
      ["⏱ Journey Duration →", [-1, -1, -1], [1.25, -1, -1], isDark ? "#38bdf8" : "#0284c7"],
      ["🎟 Confirmation Probability ↑", [-1, -1, -1], [-1, 1.25, -1], isDark ? "#34d399" : "#059669"],
      ["₹ Fare (Cheaper ↗)", [-1, -1, -1], [-1, -1, 1.25], isDark ? "#fbbf24" : "#d97706"],
    ];

    for (const [title, fromPt, toPt, axisCol] of axes) {
      const pFrom = project(applyMat3(rot, fromPt), cx, cy, fov, zoom);
      const pTo = project(applyMat3(rot, toPt), cx, cy, fov, zoom);

      ctx.beginPath();
      ctx.moveTo(pFrom.sx, pFrom.sy);
      ctx.lineTo(pTo.sx, pTo.sy);
      ctx.strokeStyle = axisCol;
      ctx.lineWidth = 2.4;
      ctx.stroke();

      const dx = pTo.sx - pFrom.sx;
      const dy = pTo.sy - pFrom.sy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / len, ny = dy / len;
      const px = -ny, py = nx;

      ctx.beginPath();
      ctx.moveTo(pTo.sx, pTo.sy);
      ctx.lineTo(pTo.sx - nx * 10 + px * 5, pTo.sy - ny * 10 + py * 5);
      ctx.lineTo(pTo.sx - nx * 10 - px * 5, pTo.sy - ny * 10 - py * 5);
      ctx.closePath();
      ctx.fillStyle = axisCol;
      ctx.fill();

      ctx.font = "bold 11px Inter, system-ui";
      ctx.fillStyle = axisCol;
      ctx.textAlign = "center";
      ctx.fillText(title, pTo.sx + nx * 18, pTo.sy + ny * 18 + 4);
    }

    // ── 8. Project & Depth-Sort Trains ───────────────────────────────────────
    const projected = points.map((p) => {
      const v = applyMat3(rot, [p.nx, p.ny, p.nz]);
      const proj = project(v, cx, cy, fov, zoom);
      const floorProj = project(applyMat3(rot, [p.nx, -1, p.nz]), cx, cy, fov, zoom);
      return { ...p, ...proj, floorProj, v };
    });
    projected.sort((a, b) => a.depth - b.depth);

    // ── 9. Permanent Grounding Stems (Color-coded along Green-to-Red continuum)
    for (const p of projected) {
      const isHov = hoveredTrainId === p.id;
      const isSel = selectedTrain?.id === p.id;
      const col = getDominanceColor(p.score);

      // Vertical stem from point to floor
      ctx.beginPath();
      ctx.moveTo(p.sx, p.sy);
      ctx.lineTo(p.floorProj.sx, p.floorProj.sy);
      ctx.strokeStyle = isSel ? "#a855f7" : isHov ? col.base : `${col.base}66`;
      ctx.lineWidth = isHov || isSel ? 2.0 : 1.1;
      if (!isHov && !isSel) ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Floor target puck
      const puckR = (isSel ? 7 : isHov ? 6 : 4.5) * Math.max(0.6, Math.min(1.4, (p.depth + 500) / 600));
      ctx.beginPath();
      ctx.ellipse(p.floorProj.sx, p.floorProj.sy, puckR * 1.6, puckR * 0.75, 0, 0, Math.PI * 2);
      ctx.fillStyle = isSel ? "rgba(168, 85, 247, 0.45)" : col.glow;
      ctx.fill();
      ctx.strokeStyle = isSel ? "#a855f7" : col.border;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // ── 10. Interactive 3-Axis Laser Projections for Active Train ────────────
    const activePoint =
      projected.find((p) => p.id === hoveredTrainId) ||
      (selectedTrain ? projected.find((p) => p.id === selectedTrain.id) : null);

    if (activePoint) {
      const col = getDominanceColor(activePoint.score);

      const pX = project(applyMat3(rot, [activePoint.nx, -1, -1]), cx, cy, fov, zoom);
      const pY = project(applyMat3(rot, [-1, activePoint.ny, -1]), cx, cy, fov, zoom);
      const pZ = project(applyMat3(rot, [-1, -1, activePoint.nz]), cx, cy, fov, zoom);

      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.6;

      ctx.strokeStyle = "#38bdf8";
      ctx.beginPath(); ctx.moveTo(activePoint.sx, activePoint.sy); ctx.lineTo(pX.sx, pX.sy); ctx.stroke();

      ctx.strokeStyle = "#34d399";
      ctx.beginPath(); ctx.moveTo(activePoint.sx, activePoint.sy); ctx.lineTo(pY.sx, pY.sy); ctx.stroke();

      ctx.strokeStyle = "#fbbf24";
      ctx.beginPath(); ctx.moveTo(activePoint.sx, activePoint.sy); ctx.lineTo(pZ.sx, pZ.sy); ctx.stroke();
      ctx.restore();

      // Readout Badges
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath(); ctx.roundRect(pX.sx - 34, pX.sy + 6, 68, 20, 6); ctx.fill();
      ctx.fillStyle = "#030712";
      ctx.font = "bold 10px Inter, system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`${activePoint.train.duration}`, pX.sx, pX.sy + 20);

      ctx.fillStyle = "#34d399";
      ctx.beginPath(); ctx.roundRect(pY.sx - 66, pY.sy - 10, 60, 20, 6); ctx.fill();
      ctx.fillStyle = "#030712";
      ctx.font = "bold 10px Inter, system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(activePoint.prob * 100)}% Prob`, pY.sx - 36, pY.sy + 4);

      ctx.fillStyle = "#fbbf24";
      ctx.beginPath(); ctx.roundRect(pZ.sx - 32, pZ.sy - 24, 64, 20, 6); ctx.fill();
      ctx.fillStyle = "#030712";
      ctx.font = "bold 10px Inter, system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`₹${activePoint.rawFare}`, pZ.sx, pZ.sy - 10);
    }

    // ── 11. Pareto Optimal Frontier Spline ───────────────────────────────────
    const paretoPoints = projected.filter((p) => p.pareto);
    if (paretoPoints.length > 1) {
      const sorted = [...paretoPoints].sort((a, b) => a.sx - b.sx);
      ctx.beginPath();
      ctx.moveTo(sorted[0].sx, sorted[0].sy);
      for (let i = 1; i < sorted.length; i++) {
        const mx = (sorted[i - 1].sx + sorted[i].sx) / 2;
        const my = (sorted[i - 1].sy + sorted[i].sy) / 2;
        ctx.quadraticCurveTo(sorted[i - 1].sx, sorted[i - 1].sy, mx, my);
      }
      ctx.lineTo(sorted[sorted.length - 1].sx, sorted[sorted.length - 1].sy);
      ctx.strokeStyle = "rgba(168, 85, 247, 0.8)";
      ctx.lineWidth = 2.4;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── 12. Render Jewel-like 3D Points ──────────────────────────────────────
    for (const p of projected) {
      const col = getDominanceColor(p.score);
      const isHov = hoveredTrainId === p.id;
      const isSel = selectedTrain?.id === p.id;
      const depthScale = Math.max(0.65, Math.min(1.45, (p.depth + 500) / 600));
      const r = (isSel ? 12 : isHov ? 10.5 : 8) * depthScale;

      // Radiant Halo
      if (isHov || isSel || p.pareto) {
        const glowR = r * (isSel ? 3.4 : isHov ? 3.0 : 2.2);
        const glowGrad = ctx.createRadialGradient(p.sx, p.sy, r * 0.4, p.sx, p.sy, glowR);
        glowGrad.addColorStop(0, isSel ? "rgba(168, 85, 247, 0.65)" : col.glow);
        glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, glowR, 0, Math.PI * 2);
        ctx.fillStyle = glowGrad;
        ctx.fill();
      }

      // Pareto corona
      if (p.pareto) {
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(168, 85, 247, 0.85)";
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }

      // 3D Specular Shaded Sphere (Gemstone Refraction)
      const sphereGrad = ctx.createRadialGradient(
        p.sx - r * 0.35,
        p.sy - r * 0.4,
        r * 0.08,
        p.sx,
        p.sy,
        r
      );
      sphereGrad.addColorStop(0, "#ffffff"); // Specular highlight
      sphereGrad.addColorStop(0.25, isSel ? "#c084fc" : col.base);
      sphereGrad.addColorStop(0.85, col.border);
      sphereGrad.addColorStop(1, isDark ? "#020617" : "#1e293b");

      ctx.beginPath();
      ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
      ctx.fillStyle = sphereGrad;
      ctx.fill();

      // Outer crisp rim
      ctx.strokeStyle = isSel ? "#ffffff" : isDark ? "rgba(255, 255, 255, 0.8)" : "rgba(0, 0, 0, 0.25)";
      ctx.lineWidth = isSel ? 2 : 1;
      ctx.stroke();

      // Star for Pareto
      if (p.pareto) {
        ctx.font = `bold ${Math.max(9, r * 0.95)}px system-ui`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("★", p.sx, p.sy);
        ctx.textBaseline = "alphabetic";
      }

      // Text label in 3D
      if (isHov || isSel || depthScale > 1.05) {
        const trainShort = p.train.name.replace(/(Superfast|Express|Special)/gi, "").trim();
        ctx.font = `${isHov || isSel ? "bold 11px" : "10px"} Inter, system-ui`;
        ctx.fillStyle = textPrimary;
        ctx.textAlign = "left";
        ctx.fillText(`${trainShort} (#${p.train.number})`, p.sx + r + 6, p.sy + 4);
      }
    }

    // ── 13. Google Earth-Style Mini 3D Orientation Gimbal ───────────────────
    const gimbalX = W - 45;
    const gimbalY = 45;
    const gimbalR = 24;

    ctx.save();
    ctx.beginPath();
    ctx.arc(gimbalX, gimbalY, gimbalR, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? "rgba(15, 23, 42, 0.8)" : "rgba(255, 255, 255, 0.9)";
    ctx.strokeStyle = isDark ? "rgba(148, 163, 184, 0.3)" : "rgba(100, 116, 139, 0.35)";
    ctx.lineWidth = 1.2;
    ctx.fill();
    ctx.stroke();

    const gVecs: [string, [number, number, number], string][] = [
      ["X", [1, 0, 0], isDark ? "#38bdf8" : "#0284c7"],
      ["Y", [0, 1, 0], isDark ? "#34d399" : "#059669"],
      ["Z", [0, 0, 1], isDark ? "#fbbf24" : "#d97706"],
    ];

    for (const [axisName, dir, c] of gVecs) {
      const v = applyMat3(rot, dir);
      const gx = gimbalX + v[0] * (gimbalR - 6);
      const gy = gimbalY - v[1] * (gimbalR - 6);

      ctx.beginPath();
      ctx.moveTo(gimbalX, gimbalY);
      ctx.lineTo(gx, gy);
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(gx, gy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();

      ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
      ctx.font = "bold 8px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(axisName, gx, gy - 5);
    }
    ctx.restore();

    // ── 14. HUD Footer ───────────────────────────────────────────────────────
    ctx.font = "11.5px Inter, system-ui";
    ctx.fillStyle = textMuted;
    ctx.textAlign = "left";
    ctx.fillText("🖱 Left-drag: Orbit space · Scroll: Zoom in/out · Click node: Select train", 16, H - 14);

    ctx.restore();
  }, [points, hoveredTrainId, selectedTrain, theme, minD, maxD, minF, maxF]);

  // Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
      render();
    };
    const obs = new ResizeObserver(handleResize);
    obs.observe(canvas);
    handleResize();
    return () => obs.disconnect();
  }, [render]);

  // Animation Loop with inertia
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      const v = velocityRef.current;
      if (!dragRef.current.active && (Math.abs(v.dx) > 0.0001 || Math.abs(v.dy) > 0.0001)) {
        rotationRef.current = mat3Mul(rotY(v.dx), mat3Mul(rotX(v.dy), rotationRef.current));
        v.dx *= 0.92;
        v.dy *= 0.92;
      }
      render();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [render]);

  // Hit-test
  const hitTest = useCallback(
    (mx: number, my: number): (typeof points)[0] | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;
      const cx = W / 2;
      const cy = H / 2 + 10;
      const fov = 520;
      const zoom = Math.min(W, H) * 0.38 * zoomRef.current;
      const rot = rotationRef.current;

      let best: (typeof points)[0] | null = null;
      let bestDist = 28;

      for (const p of points) {
        const v = applyMat3(rot, [p.nx, p.ny, p.nz]);
        const proj = project(v, cx, cy, fov, zoom);
        const d = Math.sqrt((proj.sx - mx) ** 2 + (proj.sy - my) ** 2);
        if (d < bestDist) {
          bestDist = d;
          best = p;
        }
      }
      return best;
    },
    [points]
  );

  // Mouse handlers
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
    velocityRef.current = { dx: 0, dy: 0 };
    setActiveView("free");
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (dragRef.current.active) {
        const dx = (e.clientX - dragRef.current.lastX) * 0.007;
        const dy = (e.clientY - dragRef.current.lastY) * 0.007;
        rotationRef.current = mat3Mul(rotY(dx), mat3Mul(rotX(dy), rotationRef.current));
        velocityRef.current = { dx, dy };
        dragRef.current.lastX = e.clientX;
        dragRef.current.lastY = e.clientY;
        setTooltip(null);
        onHoverTrain(null);
        return;
      }

      const hit = hitTest(mx, my);
      if (hit) {
        onHoverTrain(hit.id);
        setTooltip({
          train: hit.train,
          prob: hit.prob,
          probStatus: hit.probStatus,
          freqText: hit.freqText,
          factors: hit.factors,
          isPareto: hit.pareto,
          screenX: mx,
          screenY: my,
          dur: hit.dur,
          fare: hit.fare,
          score: hit.score,
        });
      } else {
        onHoverTrain(null);
        setTooltip(null);
      }
    },
    [hitTest, onHoverTrain]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current.active = false;
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (Math.abs(velocityRef.current.dx) > 0.01 || Math.abs(velocityRef.current.dy) > 0.01) return;
      const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const hit = hitTest(mx, my);
      if (hit) onSelectTrain(hit.train);
    },
    [hitTest, onSelectTrain]
  );

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    zoomRef.current = Math.max(0.4, Math.min(3.2, zoomRef.current * (1 - e.deltaY * 0.001)));
  }, []);

  const setPreset = useCallback((preset: "iso" | "top" | "front") => {
    velocityRef.current = { dx: 0, dy: 0 };
    rotationRef.current = VIEW_PRESETS[preset];
    zoomRef.current = 1.0;
    setActiveView(preset);
  }, []);

  // Tooltip
  const tooltipStyle = useMemo((): React.CSSProperties => {
    if (!tooltip) return {};
    const W = canvasRef.current?.offsetWidth || 800;
    const H = canvasRef.current?.offsetHeight || 500;
    const cardW = 310;
    const cardH = 270;
    let left = tooltip.screenX + 20;
    let top = tooltip.screenY - 20;
    if (left + cardW > W - 12) left = tooltip.screenX - cardW - 16;
    if (top + cardH > H - 12) top = H - cardH - 12;
    if (top < 12) top = 12;
    return { left, top, width: cardW };
  }, [tooltip]);

  const col = tooltip ? getDominanceColor(tooltip.score) : null;
  const isDark = theme !== "light";

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        borderRadius: "22px",
        overflow: "hidden",
        border: isDark ? "1px solid rgba(56, 189, 248, 0.22)" : "1.5px solid #bfdbfe",
        boxShadow: isDark
          ? "0 30px 90px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
          : "0 24px 65px rgba(15, 23, 42, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
        background: isDark ? "#02050b" : "#ffffff",
        marginBottom: "24px",
      }}
    >
      {/* ── Space Command Bar ────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "13px 20px",
          borderBottom: isDark ? "1px solid rgba(56, 189, 248, 0.15)" : "1.5px solid #dbeafe",
          background: isDark ? "rgba(8, 16, 32, 0.94)" : "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(16px)",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: "15px", fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a" }}>
          🌐 3D Volumetric Decision Space
        </span>

        {/* Dynamic Gradient Continuum Legend */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "4px 12px",
            borderRadius: "999px",
            background: isDark ? "rgba(255, 255, 255, 0.05)" : "#f0f6ff",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #bfdbfe",
            fontSize: "11px",
          }}
        >
          <span style={{ fontWeight: 700, color: "#10b981" }}>🟢 Optimal ({stats.greenCount})</span>
          <div
            style={{
              width: "55px",
              height: "5px",
              borderRadius: "999px",
              background: "linear-gradient(90deg, #10b981 0%, #f59e0b 50%, #ef4444 100%)",
            }}
          />
          <span style={{ fontWeight: 700, color: "#ef4444" }}>🔴 Risky ({stats.redCount})</span>
        </div>

        {/* View preset buttons */}
        <div style={{ display: "flex", gap: "6px", marginLeft: "auto", alignItems: "center" }}>
          <span style={{ fontSize: "11px", color: isDark ? "rgba(148, 163, 184, 0.8)" : "#64748b", marginRight: "4px" }}>
            Camera:
          </span>
          {[
            { id: "iso", label: "📐 Iso View" },
            { id: "top", label: "🔝 Top (Time-Cost)" },
            { id: "front", label: "⏩ Front (Time-Odds)" },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setPreset(v.id as any)}
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "5px 11px",
                borderRadius: "8px",
                cursor: "pointer",
                border:
                  activeView === v.id
                    ? isDark
                      ? "1px solid #38bdf8"
                      : "1px solid #2563eb"
                    : isDark
                    ? "1px solid rgba(148, 163, 184, 0.22)"
                    : "1px solid #cbd5e1",
                background:
                  activeView === v.id
                    ? isDark
                      ? "rgba(56, 189, 248, 0.2)"
                      : "rgba(37, 99, 235, 0.12)"
                    : "transparent",
                color:
                  activeView === v.id
                    ? isDark
                      ? "#38bdf8"
                      : "#2563eb"
                    : isDark
                    ? "rgba(226, 232, 240, 0.8)"
                    : "#475569",
                transition: "all 0.15s",
              }}
            >
              {v.label}
            </button>
          ))}
          <button
            onClick={() => {
              zoomRef.current = 1.0;
              setPreset("iso");
            }}
            title="Reset Orbit & Zoom"
            style={{
              fontSize: "11px",
              padding: "5px 9px",
              borderRadius: "8px",
              cursor: "pointer",
              border: isDark ? "1px solid rgba(148, 163, 184, 0.22)" : "1px solid #cbd5e1",
              background: "transparent",
              color: isDark ? "rgba(226, 232, 240, 0.8)" : "#475569",
            }}
          >
            🔄 Reset
          </button>
        </div>
      </div>

      {/* ── 3D Canvas ────────────────────────────────────────────────────── */}
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "520px",
          display: "block",
          cursor: dragRef.current.active ? "grabbing" : tooltip ? "pointer" : "grab",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={handleClick}
        onWheel={handleWheel}
      />

      {/* ── Rich Tooltip Card ────────────────────────────────────────────── */}
      {tooltip && col && (
        <div
          style={{
            position: "absolute",
            ...tooltipStyle,
            background: isDark ? "rgba(8, 16, 32, 0.97)" : "rgba(255, 255, 255, 0.98)",
            border: `1.5px solid ${col.base}`,
            borderRadius: "18px",
            padding: "16px",
            backdropFilter: "blur(22px)",
            boxShadow: isDark
              ? `0 24px 60px rgba(0, 0, 0, 0.85), 0 0 28px ${col.glow}`
              : `0 24px 50px rgba(15, 23, 42, 0.18), 0 0 20px ${col.glow}`,
            zIndex: 30,
            pointerEvents: "auto",
            color: isDark ? "#f8fafc" : "#0f172a",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 800, lineHeight: 1.25 }}>
                {tooltip.train.name}
              </div>
              <div style={{ fontSize: "11px", color: isDark ? "rgba(148, 163, 184, 0.8)" : "#64748b", marginTop: "2px" }}>
                Train #{tooltip.train.number} · {tooltip.train.departure} → {tooltip.train.arrival}
              </div>
            </div>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 800,
                padding: "3px 8px",
                borderRadius: "999px",
                background: `${col.base}22`,
                color: col.base,
                border: `1px solid ${col.base}55`,
                whiteSpace: "nowrap",
              }}
            >
              {tooltip.isPareto ? "★ Pareto Top" : col.label}
            </span>
          </div>

          {/* Coordinate Readout */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginBottom: "12px" }}>
            <div
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.05)" : "#f0f6ff",
                borderRadius: "8px",
                padding: "8px",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid #dbeafe",
              }}
            >
              <div style={{ fontSize: "10px", color: "#38bdf8", fontWeight: 700 }}>⏱ DURATION</div>
              <div style={{ fontSize: "13px", fontWeight: 800 }}>{tooltip.train.duration}</div>
            </div>
            <div
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.05)" : "#f0f6ff",
                borderRadius: "8px",
                padding: "8px",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid #dbeafe",
              }}
            >
              <div style={{ fontSize: "10px", color: "#fbbf24", fontWeight: 700 }}>₹ FARE</div>
              <div style={{ fontSize: "13px", fontWeight: 800 }}>₹{tooltip.fare.toLocaleString("en-IN")}</div>
            </div>
            <div
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.05)" : "#f0f6ff",
                borderRadius: "8px",
                padding: "8px",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid #dbeafe",
              }}
            >
              <div style={{ fontSize: "10px", color: col.base, fontWeight: 700 }}>🎟 ODDS</div>
              <div style={{ fontSize: "13px", fontWeight: 800, color: col.base }}>
                {Math.round(tooltip.prob * 100)}%
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", marginBottom: "4px" }}>
              <span style={{ color: isDark ? "rgba(148, 163, 184, 0.85)" : "#64748b" }}>Seat Clearance Confidence:</span>
              <strong style={{ color: col.base }}>{tooltip.probStatus.toUpperCase()}</strong>
            </div>
            <div
              style={{
                height: "6px",
                borderRadius: "999px",
                background: isDark ? "rgba(255, 255, 255, 0.1)" : "#e2e8f0",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.round(tooltip.prob * 100)}%`,
                  background: `linear-gradient(90deg, ${col.base}99, ${col.base})`,
                  borderRadius: "999px",
                }}
              />
            </div>
            <div
              style={{
                fontSize: "10px",
                color: isDark ? "rgba(148, 163, 184, 0.75)" : "#64748b",
                marginTop: "4px",
                lineHeight: 1.35,
              }}
            >
              {tooltip.freqText}
            </div>
          </div>

          {/* Action button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBookTrain(tooltip.train);
            }}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "10px",
              border: `1.5px solid ${col.base}`,
              background: `linear-gradient(135deg, ${col.base}33, ${col.base}18)`,
              color: isDark ? "#ffffff" : col.border,
              fontSize: "13px",
              fontWeight: 800,
              cursor: "pointer",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = col.base;
              (e.currentTarget as HTMLButtonElement).style.color = "#ffffff";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = `linear-gradient(135deg, ${col.base}33, ${col.base}18)`;
              (e.currentTarget as HTMLButtonElement).style.color = isDark ? "#ffffff" : col.border;
            }}
          >
            ⚡ Select &amp; Book this Train →
          </button>
        </div>
      )}
    </div>
  );
}
