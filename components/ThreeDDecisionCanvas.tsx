"use client";

import React, { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { Train } from "../lib/types";
import { estimateConfirmationProbability } from "../lib/probabilityModel";

/* ═══════════════════════════════════════════════════════════════════════════
   ThreeDDecisionCanvas
   3D interactive visualisation of train search results.
   Axes: X = Journey Duration · Y = Fare · Z = Confirmation Probability
   Interaction: Arcball (trackball) rotation · Scroll-wheel zoom · Click-to-book
   ═══════════════════════════════════════════════════════════════════════════ */

interface Props {
  trains: Train[];
  selectedTrain: Train | null;
  onSelectTrain: (train: Train) => void;
  /** Called when user explicitly clicks "Book" in the tooltip → also navigates to Step 2 */
  onBookTrain: (train: Train) => void;
  hoveredTrainId: string | null;
  onHoverTrain: (id: string | null) => void;
  quota?: string;
}

// ─── Pure 3×3 matrix math ─────────────────────────────────────────────────

type Mat3 = [
  number, number, number,
  number, number, number,
  number, number, number
];

function mat3Identity(): Mat3 {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

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

// ─── Perspective projection ────────────────────────────────────────────────

function project(
  v: [number, number, number],
  cx: number,
  cy: number,
  fov: number,
  zoom: number
): { sx: number; sy: number; depth: number } {
  const z = v[2] + fov;
  const scale = (fov / z) * zoom;
  return { sx: cx + v[0] * scale, sy: cy - v[1] * scale, depth: v[2] };
}

// ─── Duration parser ───────────────────────────────────────────────────────

function parseMins(d: string): number {
  const m = d.match(/(\d+)h\s*(\d*)m?/);
  if (!m) return 300;
  return parseInt(m[1] || "0") * 60 + parseInt(m[2] || "0");
}

// ─── Pareto helper ─────────────────────────────────────────────────────────

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

// ─── Colour helpers ────────────────────────────────────────────────────────

function probColour(prob: number): { base: string; glow: string; ring: string } {
  if (prob >= 0.72)
    return { base: "#10b981", glow: "rgba(16,185,129,0.45)", ring: "rgba(16,185,129,0.25)" };
  if (prob >= 0.45)
    return { base: "#f59e0b", glow: "rgba(245,158,11,0.45)", ring: "rgba(245,158,11,0.25)" };
  return { base: "#ef4444", glow: "rgba(239,68,68,0.45)", ring: "rgba(239,68,68,0.25)" };
}

// ─── Star field (deterministic pseudo-random) ──────────────────────────────

const STARS: { x: number; y: number; r: number; a: number }[] = Array.from(
  { length: 120 },
  (_, i) => {
    const seed = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    const seed2 = Math.sin(i * 269.5 + 183.3) * 43758.5453;
    const seed3 = Math.sin(i * 44.3 + 52.1) * 43758.5453;
    return {
      x: (seed - Math.floor(seed)),
      y: (seed2 - Math.floor(seed2)),
      r: 0.4 + (seed3 - Math.floor(seed3)) * 1.4,
      a: 0.15 + (Math.sin(i * 17.3) * 0.5 + 0.5) * 0.5,
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

export function ThreeDDecisionCanvas({
  trains,
  selectedTrain,
  onSelectTrain,
  onBookTrain,
  hoveredTrainId,
  onHoverTrain,
  quota = "General",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  // Rotation matrix (arcball)
  const rotationRef = useRef<Mat3>(mat3Mul(rotX(-0.38), rotY(0.5)));
  // Camera
  const zoomRef = useRef<number>(1.0);
  // Drag state
  const dragRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false, lastX: 0, lastY: 0,
  });
  // Inertia
  const velocityRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  // React state only for the tooltip (avoids re-renders for rotation)
  const [tooltip, setTooltip] = useState<{
    train: Train;
    prob: number;
    probStatus: string;
    freqText: string;
    factors: string[];
    isPareto: boolean;
    screenX: number;
    screenY: number;
  } | null>(null);

  // Processed points (normalised to [-1, 1] cube)
  const points = useMemo(() => {
    const raw = trains.map((t) => {
      const dur = parseMins(t.duration);
      const fare = t.fare || 500;
      const pi = estimateConfirmationProbability(t, t.classes[0] || "3A", quota);
      return { id: t.id, train: t, dur, fare, prob: pi.probability, probStatus: pi.status, freqText: pi.frequencyText, factors: pi.factors };
    });

    const durs = raw.map((p) => p.dur);
    const fares = raw.map((p) => p.fare);
    const probs = raw.map((p) => p.prob);
    const minD = Math.min(...durs), maxD = Math.max(...durs);
    const minF = Math.min(...fares), maxF = Math.max(...fares);
    const minP = Math.min(...probs), maxP = Math.max(...probs);

    const norm = (v: number, lo: number, hi: number) =>
      hi === lo ? 0 : (v - lo) / (hi - lo) * 2 - 1;

    return raw.map((p, i) => ({
      ...p,
      // X = duration (right = longer), Y = probability (up = better), Z = fare (towards camera = cheaper)
      nx: norm(p.dur, minD, maxD),
      ny: norm(p.prob, minP, maxP),
      nz: -norm(p.fare, minF, maxF), // negate so cheaper is closer
      pareto: isParetoOptimal(raw, i),
      rawDur: p.dur,
      rawFare: p.fare,
    }));
  }, [trains, quota]);

  // Render loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const fov = 500;
    const zoom = Math.min(W, H) * 0.33 * zoomRef.current;
    const rot = rotationRef.current;

    ctx.clearRect(0, 0, W, H);

    // ── Dark gradient background ──────────────────────────────────────────
    const bgGrad = ctx.createRadialGradient(cx, cy * 0.6, 0, cx, cy * 0.6, Math.max(W, H) * 0.8);
    bgGrad.addColorStop(0, "#0d1b2a");
    bgGrad.addColorStop(0.5, "#081018");
    bgGrad.addColorStop(1, "#040c14");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // ── Stars ─────────────────────────────────────────────────────────────
    for (const s of STARS) {
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,220,255,${s.a})`;
      ctx.fill();
    }

    // ── Grid floor (y = -1) ───────────────────────────────────────────────
    const gridSteps = 5;
    const gridAlpha = 0.18;
    ctx.strokeStyle = `rgba(100,160,220,${gridAlpha})`;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= gridSteps; i++) {
      const t = (i / gridSteps) * 2 - 1;
      // Lines parallel to X
      const p0 = project(applyMat3(rot, [t, -1, -1]), cx, cy, fov, zoom);
      const p1 = project(applyMat3(rot, [t, -1, 1]), cx, cy, fov, zoom);
      ctx.beginPath(); ctx.moveTo(p0.sx, p0.sy); ctx.lineTo(p1.sx, p1.sy); ctx.stroke();
      // Lines parallel to Z
      const q0 = project(applyMat3(rot, [-1, -1, t]), cx, cy, fov, zoom);
      const q1 = project(applyMat3(rot, [1, -1, t]), cx, cy, fov, zoom);
      ctx.beginPath(); ctx.moveTo(q0.sx, q0.sy); ctx.lineTo(q1.sx, q1.sy); ctx.stroke();
    }

    // ── Axes ──────────────────────────────────────────────────────────────
    const axes: [string, [number,number,number], [number,number,number], string][] = [
      ["Duration ▶", [-1, -1, -1], [1, -1, -1], "rgba(96,165,250,0.9)"],   // X: blue
      ["Prob ▲",     [-1, -1, -1], [-1, 1, -1], "rgba(52,211,153,0.9)"],   // Y: green
      ["Fare ▶",     [-1, -1, -1], [-1, -1, 1], "rgba(251,191,36,0.9)"],   // Z: amber
    ];

    for (const [label, from3, to3, color] of axes) {
      const pf = project(applyMat3(rot, from3 as [number,number,number]), cx, cy, fov, zoom);
      const pt = project(applyMat3(rot, to3 as [number,number,number]), cx, cy, fov, zoom);
      const axGrad = ctx.createLinearGradient(pf.sx, pf.sy, pt.sx, pt.sy);
      axGrad.addColorStop(0, "rgba(255,255,255,0.05)");
      axGrad.addColorStop(1, color);
      ctx.beginPath();
      ctx.moveTo(pf.sx, pf.sy);
      ctx.lineTo(pt.sx, pt.sy);
      ctx.strokeStyle = axGrad;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Arrow head
      const dx = pt.sx - pf.sx, dy = pt.sy - pf.sy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / len, ny = dy / len;
      const px = -ny, py = nx;
      ctx.beginPath();
      ctx.moveTo(pt.sx, pt.sy);
      ctx.lineTo(pt.sx - nx * 8 + px * 4, pt.sy - ny * 8 + py * 4);
      ctx.lineTo(pt.sx - nx * 8 - px * 4, pt.sy - ny * 8 - py * 4);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // Label
      ctx.font = "bold 10.5px Inter, system-ui";
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.fillText(label, pt.sx + nx * 14, pt.sy + ny * 14 + 4);
    }
    ctx.textAlign = "left";

    // ── Sort points by depth (painter's algorithm) ────────────────────────
    const projected = points.map((p) => {
      const v = applyMat3(rot, [p.nx, p.ny, p.nz]);
      const proj = project(v, cx, cy, fov, zoom);
      return { ...p, ...proj, v };
    });
    projected.sort((a, b) => a.depth - b.depth);

    // ── Draw connecting lines to floor (depth cues) ────────────────────────
    for (const p of projected) {
      const floor = project(applyMat3(rot, [p.nx, -1, p.nz]), cx, cy, fov, zoom);
      const isHov = hoveredTrainId === p.id;
      const isSel = selectedTrain?.id === p.id;
      if (isHov || isSel) {
        ctx.beginPath();
        ctx.moveTo(p.sx, p.sy);
        ctx.lineTo(floor.sx, floor.sy);
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // ── Draw Pareto connectors ─────────────────────────────────────────────
    const paretoPoints = projected.filter((p) => p.pareto);
    if (paretoPoints.length > 1) {
      // Sort by X on screen for a smooth frontier curve
      const sorted = [...paretoPoints].sort((a, b) => a.sx - b.sx);
      ctx.beginPath();
      ctx.moveTo(sorted[0].sx, sorted[0].sy);
      for (let i = 1; i < sorted.length; i++) {
        const mx = (sorted[i - 1].sx + sorted[i].sx) / 2;
        const my = (sorted[i - 1].sy + sorted[i].sy) / 2;
        ctx.quadraticCurveTo(sorted[i - 1].sx, sorted[i - 1].sy, mx, my);
      }
      ctx.lineTo(sorted[sorted.length - 1].sx, sorted[sorted.length - 1].sy);
      ctx.strokeStyle = "rgba(139,92,246,0.45)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── Draw points ────────────────────────────────────────────────────────
    for (const p of projected) {
      const col = probColour(p.prob);
      const isHov = hoveredTrainId === p.id;
      const isSel = selectedTrain?.id === p.id;
      const r = (isSel ? 10 : isHov ? 9 : 7) * Math.max(0.5, Math.min(1.3, (p.depth + 500) / 600));

      // Outer glow
      if (isHov || isSel || p.pareto) {
        const glowR = r * (isSel ? 3.2 : isHov ? 2.8 : 2.2);
        const glowGrad = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, glowR);
        glowGrad.addColorStop(0, isSel ? "rgba(139,92,246,0.55)" : col.glow);
        glowGrad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, glowR, 0, Math.PI * 2);
        ctx.fillStyle = glowGrad;
        ctx.fill();
      }

      // Pareto ring
      if (p.pareto) {
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(139,92,246,0.75)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // 3D sphere shading
      const sphereGrad = ctx.createRadialGradient(
        p.sx - r * 0.3, p.sy - r * 0.35, r * 0.1,
        p.sx, p.sy, r
      );
      sphereGrad.addColorStop(0, isSel ? "#c4b5fd" : "rgba(255,255,255,0.85)");
      sphereGrad.addColorStop(0.3, col.base);
      sphereGrad.addColorStop(1, `${col.base}55`);
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
      ctx.fillStyle = sphereGrad;
      ctx.fill();

      // Selection ring
      if (isSel) {
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r + 2, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(139,92,246,0.95)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // ★ for Pareto
      if (p.pareto) {
        ctx.font = `bold ${Math.max(8, r * 0.9)}px system-ui`;
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("★", p.sx, p.sy);
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "left";
      }
    }

    // ── HUD labels ─────────────────────────────────────────────────────────
    ctx.font = "12px Inter, system-ui";
    ctx.fillStyle = "rgba(148,163,184,0.8)";
    ctx.fillText("🖱 Drag to orbit · Scroll to zoom · Click to book", 14, H - 14);

    // Legend pills
    const legendItems = [
      { color: "#10b981", label: "High clearance (≥72%)" },
      { color: "#f59e0b", label: "Moderate (45-71%)" },
      { color: "#ef4444", label: "Lower odds (<45%)" },
      { color: "rgba(139,92,246,0.9)", label: "★ Pareto-optimal" },
    ];
    let lx = 14;
    const ly = 16;
    for (const item of legendItems) {
      ctx.beginPath();
      ctx.arc(lx + 6, ly, 5, 0, Math.PI * 2);
      ctx.fillStyle = item.color;
      ctx.fill();
      ctx.font = "10.5px Inter, system-ui";
      ctx.fillStyle = "rgba(148,163,184,0.9)";
      ctx.fillText(item.label, lx + 15, ly + 4);
      lx += ctx.measureText(item.label).width + 34;
    }
  }, [points, hoveredTrainId, selectedTrain]);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    });
    obs.observe(canvas);
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    return () => obs.disconnect();
  }, []);

  // Animation loop with inertia
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      // Apply inertia
      const v = velocityRef.current;
      if (!dragRef.current.active && (Math.abs(v.dx) > 0.0001 || Math.abs(v.dy) > 0.0001)) {
        rotationRef.current = mat3Mul(rotY(v.dx), mat3Mul(rotX(v.dy), rotationRef.current));
        v.dx *= 0.93;
        v.dy *= 0.93;
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

  // ── Hit-test (find nearest projected point to mouse) ─────────────────────
  const hitTest = useCallback(
    (mx: number, my: number): typeof points[0] | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      // Physical coords → logical CSS coords
      const W = rect.width;
      const H = rect.height;
      const cx = W / 2;
      const cy = H / 2;
      const fov = 500;
      const zoom = Math.min(W, H) * 0.33 * zoomRef.current;
      const rot = rotationRef.current;

      let best: (typeof points[0]) | null = null;
      let bestDist = 28; // px threshold

      for (const p of points) {
        const v = applyMat3(rot, [p.nx, p.ny, p.nz]);
        const proj = project(v, cx, cy, fov, zoom);
        const d = Math.sqrt((proj.sx - mx) ** 2 + (proj.sy - my) ** 2);
        if (d < bestDist) { bestDist = d; best = p; }
      }
      return best;
    },
    [points]
  );

  // Mouse / Pointer events
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
    velocityRef.current = { dx: 0, dy: 0 };
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

      // Hover hit test
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
    zoomRef.current = Math.max(0.3, Math.min(3.5, zoomRef.current * (1 - e.deltaY * 0.001)));
  }, []);

  // Tooltip positioning — keep card inside viewport
  const tooltipStyle = useMemo((): React.CSSProperties => {
    if (!tooltip) return {};
    const W = canvasRef.current?.offsetWidth || 800;
    const H = canvasRef.current?.offsetHeight || 460;
    const cardW = 280;
    const cardH = 220;
    let left = tooltip.screenX + 18;
    let top = tooltip.screenY - 20;
    if (left + cardW > W - 10) left = tooltip.screenX - cardW - 12;
    if (top + cardH > H - 10) top = H - cardH - 10;
    if (top < 10) top = 10;
    return { left, top, width: cardW };
  }, [tooltip]);

  const col = tooltip ? probColour(tooltip.prob) : null;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        borderRadius: "18px",
        overflow: "hidden",
        border: "1px solid rgba(100,160,255,0.14)",
        boxShadow: "0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
        background: "#040c14",
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px 18px",
          borderBottom: "1px solid rgba(100,160,255,0.1)",
          background: "rgba(13,27,42,0.95)",
          backdropFilter: "blur(10px)",
        }}
      >
        <span style={{ fontSize: "15px", fontWeight: 800, color: "#e2e8f0", letterSpacing: "-0.02em" }}>
          🌐 3D Decision Space
        </span>
        <span style={{
          fontSize: "11px", padding: "3px 10px", borderRadius: "999px",
          background: "rgba(139,92,246,0.15)", color: "#a78bfa",
          border: "1px solid rgba(139,92,246,0.3)", fontWeight: 600,
        }}>
          Fare · Duration · Confirmation Probability
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: "11px", color: "rgba(148,163,184,0.7)" }}>
          {trains.length} trains · {points.filter(p => p.pareto).length} Pareto-optimal ★
        </span>
      </div>

      {/* The 3D canvas */}
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "460px",
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

      {/* Hover / Click tooltip card */}
      {tooltip && col && (
        <div
          style={{
            position: "absolute",
            ...tooltipStyle,
            background: "rgba(10,20,35,0.97)",
            border: `1px solid ${col.base}55`,
            borderRadius: "16px",
            padding: "16px",
            backdropFilter: "blur(20px)",
            boxShadow: `0 0 0 1px ${col.base}22, 0 20px 50px rgba(0,0,0,0.7), 0 0 30px ${col.glow}`,
            pointerEvents: "auto",
            zIndex: 20,
            transition: "box-shadow 0.2s",
          }}
        >
          {/* Train name + Pareto badge */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "10px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "13.5px", fontWeight: 800, color: "#f1f5f9", lineHeight: 1.25 }}>
                {tooltip.train.name}
              </div>
              <div style={{ fontSize: "11px", color: "rgba(148,163,184,0.8)", marginTop: "2px" }}>
                #{tooltip.train.number}
              </div>
            </div>
            {tooltip.isPareto && (
              <span style={{
                fontSize: "10px", padding: "3px 8px", borderRadius: "999px",
                background: "rgba(139,92,246,0.2)", color: "#a78bfa",
                border: "1px solid rgba(139,92,246,0.4)", fontWeight: 700, whiteSpace: "nowrap"
              }}>
                ★ Pareto
              </span>
            )}
          </div>

          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "12px" }}>
            {[
              { icon: "⏱", label: "Duration", value: tooltip.train.duration },
              { icon: "₹", label: "Fare from", value: `₹${tooltip.train.fare.toLocaleString("en-IN")}` },
              { icon: "🎟", label: "Clearance", value: `${Math.round(tooltip.prob * 100)}%` },
            ].map(s => (
              <div key={s.label} style={{
                background: "rgba(255,255,255,0.04)", borderRadius: "10px",
                padding: "9px 10px", border: "1px solid rgba(255,255,255,0.07)"
              }}>
                <div style={{ fontSize: "11px", color: "rgba(148,163,184,0.7)", marginBottom: "2px" }}>{s.icon} {s.label}</div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#f1f5f9" }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Probability bar */}
          <div style={{ marginBottom: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontSize: "10.5px", color: "rgba(148,163,184,0.8)" }}>Confirmation probability</span>
              <span style={{ fontSize: "10.5px", fontWeight: 700, color: col.base }}>{tooltip.probStatus}</span>
            </div>
            <div style={{ height: "6px", borderRadius: "999px", background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: "999px",
                width: `${Math.round(tooltip.prob * 100)}%`,
                background: `linear-gradient(90deg, ${col.base}88, ${col.base})`,
                transition: "width 0.4s ease",
              }} />
            </div>
            <div style={{ fontSize: "10px", color: "rgba(148,163,184,0.6)", marginTop: "4px" }}>
              {tooltip.freqText}
            </div>
          </div>

          {/* Departure / Arrival */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "14px", fontWeight: 800, color: "#f1f5f9" }}>{tooltip.train.departure}</span>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.12)" }} />
            <span style={{ fontSize: "11px", color: "rgba(148,163,184,0.6)" }}>{tooltip.train.duration}</span>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.12)" }} />
            <span style={{ fontSize: "14px", fontWeight: 800, color: "#f1f5f9" }}>{tooltip.train.arrival}</span>
          </div>

          {/* Book button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBookTrain(tooltip.train);
            }}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "10px",
              border: `1px solid ${col.base}66`,
              background: `linear-gradient(135deg, ${col.base}22, ${col.base}14)`,
              color: col.base,
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.01em",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = `${col.base}30`;
              (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 18px ${col.glow}`;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = `linear-gradient(135deg, ${col.base}22, ${col.base}14)`;
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
            }}
          >
            Select &amp; Book this Train →
          </button>
        </div>
      )}
    </div>
  );
}
