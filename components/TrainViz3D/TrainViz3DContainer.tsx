"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { TatkalOption, ScoreWeights, FilterState, ScoredOption } from "./lib/types";
import { mockTatkalOptions } from "./lib/mockTatkalData";
import { computeScores, filterOptions } from "./lib/scoringEngine";
import { Train } from "../../lib/types";
import { adaptTrainsToTatkalOptions } from "./lib/realTrainAdapter";
import ThreeCanvas, { ThreeSceneHandle } from "./Scene/ThreeCanvas";
import { buildCoordinateCage, CAGE_BOUNDS } from "./Scene/CoordinateCage";
import { buildLightingAndAtmosphere } from "./Scene/LightingAndAtmosphere";
import { CameraController } from "./Scene/CameraController";
import {
  createTrainNodes,
  updateTrainNodes,
  animateTrainNodes,
  disposeTrainNodes,
} from "./Scene/TrainNodeMesh";

import BestPickCard from "./HUD/BestPickCard";
import WeightSliderPanel from "./HUD/WeightSliderPanel";
import FilterToolbar from "./HUD/FilterToolbar";
import LegendGradient from "./HUD/LegendGradient";
import TrainDetailDrawer from "./HUD/TrainDetailDrawer";
import Linked2DTable from "./HUD/Linked2DTable";

interface TrainViz3DContainerProps {
  options?: TatkalOption[];
  trains?: Train[];
  liveAvailability?: Record<string, string>;
  journeyDate?: string;
  onRefreshAvailability?: (train: Train, cls: string) => Promise<void>;
  onBook?: (option: TatkalOption) => void;
  theme?: "light" | "dark";
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_WEIGHTS: ScoreWeights = {
  success: 0.5,
  fare: 0.25,
  duration: 0.25,
};

const DEFAULT_FILTER: FilterState = {
  classes: new Set(),
  maxFare: 4500,
  minSuccessChance: 0,
  maxDuration: 7.5,
  departureAfter: "00:00",
  departureBefore: "23:59",
};

export default function TrainViz3DContainer({
  options = mockTatkalOptions,
  trains,
  liveAvailability = {},
  journeyDate,
  onRefreshAvailability,
  onBook,
  theme = "dark",
  className = "",
  style,
}: TrainViz3DContainerProps) {
  // ─── Real-Time Live Availability Cache ──────────────────────────────────────
  const [liveSeatStatus, setLiveSeatStatus] = useState<Record<string, string>>(liveAvailability);

  useEffect(() => {
    if (liveAvailability && Object.keys(liveAvailability).length > 0) {
      setLiveSeatStatus(prev => ({ ...prev, ...liveAvailability }));
    }
  }, [liveAvailability]);

  // Fetch live availability from /api/availability in real time
  const fetchLiveAvailability = useCallback(async (trainNumber: string, cls: string) => {
    const key = `${trainNumber}:${cls}`;
    if (liveSeatStatus[key] && !liveSeatStatus[key].includes("Check")) return;
    try {
      const qDate = journeyDate || new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/availability?train=${encodeURIComponent(trainNumber)}&from=JP&to=NDLS&date=${encodeURIComponent(qDate)}&class=${encodeURIComponent(cls)}&quota=TQ`, { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        const status = d?.status || "AVL Available";
        setLiveSeatStatus(prev => ({ ...prev, [key]: status }));
      }
    } catch {
      setLiveSeatStatus(prev => ({ ...prev, [key]: "AVL Available" }));
    }
  }, [journeyDate, liveSeatStatus]);

  // Pre-fetch live availability for top corridor trains on load
  useEffect(() => {
    if (trains && trains.length > 0) {
      trains.slice(0, 4).forEach(t => {
        const cls = t.classes[0] || "3A";
        fetchLiveAvailability(t.number, cls);
      });
    }
  }, [trains, fetchLiveAvailability]);

  // Derive active options from real trains if passed, or fall back to mock data
  const activeOptions = useMemo(() => {
    if (trains && trains.length > 0) {
      return adaptTrainsToTatkalOptions(trains, liveSeatStatus);
    }
    return options;
  }, [trains, liveSeatStatus, options]);

  // ─── State ──────────────────────────────────────────────────────────────────
  const [weights, setWeights] = useState<ScoreWeights>(DEFAULT_WEIGHTS);
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [colorblindMode, setColorblindMode] = useState<boolean>(false);
  const [viewTab, setViewTab] = useState<"3d" | "split" | "table">("3d");
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<string>("iso");
  const [showFilters, setShowFilters] = useState<boolean>(true);
  const [showWeights, setShowWeights] = useState<boolean>(false);

  // ─── Three.js Scene References ──────────────────────────────────────────────
  const sceneHandleRef = useRef<ThreeSceneHandle | null>(null);
  const cameraControllerRef = useRef<CameraController | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2(-999, -999));
  const cageGroupRef = useRef<THREE.Group | null>(null);

  // ─── Scoring & Filtering Computations ───────────────────────────────────────
  const allScored = useMemo(() => {
    return computeScores(activeOptions, weights);
  }, [activeOptions, weights]);

  const filteredScored = useMemo(() => {
    return filterOptions(allScored, filter);
  }, [allScored, filter]);

  const bestOption = useMemo(() => {
    return filteredScored.length > 0 ? filteredScored[0] : null;
  }, [filteredScored]);

  const selectedOption = useMemo(() => {
    if (!selectedId) return null;
    return allScored.find((o) => o.id === selectedId) || null;
  }, [allScored, selectedId]);

  // ─── Initialize 3D Scene Objects ────────────────────────────────────────────
  const handleSceneReady = useCallback(
    (handle: ThreeSceneHandle) => {
      sceneHandleRef.current = handle;
      const { scene, camera, canvas } = handle;

      // 1. Camera Controller with OrbitControls
      const controller = new CameraController(camera, canvas);
      cameraControllerRef.current = controller;

      // 2. Lighting & Atmosphere
      const lighting = buildLightingAndAtmosphere(scene);
      scene.add(lighting.group);

      // 3. Coordinate Cage & Axes
      const cage = buildCoordinateCage(theme);
      cageGroupRef.current = cage;
      scene.add(cage);

      // 4. Create Train Nodes
      createTrainNodes(scene, allScored, colorblindMode, theme);
    },
    [allScored, colorblindMode, theme]
  );

  // ─── Rebuild Train Nodes when Scored Options or Theme changes ───────────────
  useEffect(() => {
    const handle = sceneHandleRef.current;
    if (!handle) return;
    createTrainNodes(handle.scene, allScored, colorblindMode, theme);
  }, [allScored, colorblindMode, theme]);

  // ─── Update Visible Nodes on Filter Change ───────────────────────────────────
  useEffect(() => {
    updateTrainNodes(allScored, filter, colorblindMode);
  }, [allScored, filter, colorblindMode]);

  // ─── Per-Frame Animation Loop ───────────────────────────────────────────────
  const handleAnimate = useCallback(
    (delta: number) => {
      if (cameraControllerRef.current) {
        if (autoRotate && !selectedId) {
          cameraControllerRef.current.controls.autoRotate = true;
          cameraControllerRef.current.controls.autoRotateSpeed = 1.0;
        } else {
          cameraControllerRef.current.controls.autoRotate = false;
        }
        cameraControllerRef.current.update();
      }
      animateTrainNodes(delta);
    },
    [autoRotate, selectedId]
  );

  // ─── Camera Fly to Selected Option ──────────────────────────────────────────
  const flyToOption = useCallback(
    (id: string) => {
      setSelectedId(id);
      const opt = allScored.find((o) => o.id === id);
      if (!opt || !cameraControllerRef.current) return;

      // Ensure real-time live availability is actively retrieved on selection
      fetchLiveAvailability(opt.trainNumber, opt.travelClass);

      const mapRange = (val: number, sMin: number, sMax: number, dMin: number, dMax: number) =>
        sMax === sMin ? (dMin + dMax) / 2 : dMin + ((val - sMin) / (sMax - sMin)) * (dMax - dMin);

      const x = mapRange(opt.fare, CAGE_BOUNDS.fareMin, CAGE_BOUNDS.fareMax, CAGE_BOUNDS.worldMin, CAGE_BOUNDS.worldMax);
      const y = mapRange(opt.tatkalSuccessChance, CAGE_BOUNDS.successMin, CAGE_BOUNDS.successMax, CAGE_BOUNDS.worldMin, CAGE_BOUNDS.worldMax);
      const z = mapRange(opt.duration, CAGE_BOUNDS.durationMin, CAGE_BOUNDS.durationMax, CAGE_BOUNDS.worldMin, CAGE_BOUNDS.worldMax);

      const targetPos = new THREE.Vector3(x, y, z);
      const camOffset = new THREE.Vector3(x + 1.2, y + 0.8, z + 1.2);
      cameraControllerRef.current.flyTo(camOffset, targetPos);
    },
    [allScored]
  );

  // ─── Pointer Event Raycasting (Hover & Click) ──────────────────────────────
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const handle = sceneHandleRef.current;
    if (!handle) return;
    const rect = e.currentTarget.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, handle.camera);
    const intersects = raycasterRef.current.intersectObjects(handle.scene.children, true);
    const hitSphere = intersects.find((hit) => hit.object.userData?.optionId);
    if (hitSphere) {
      setHoveredId(hitSphere.object.userData.optionId);
    } else {
      setHoveredId(null);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const handle = sceneHandleRef.current;
    if (!handle) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(new THREE.Vector2(x, y), handle.camera);
    const intersects = raycasterRef.current.intersectObjects(handle.scene.children, true);
    const hitSphere = intersects.find((hit) => hit.object.userData?.optionId);
    if (hitSphere) {
      flyToOption(hitSphere.object.userData.optionId);
    }
  };

  // ─── Camera Presets Handler ─────────────────────────────────────────────────
  const handlePreset = (preset: "iso" | "top" | "front" | "side") => {
    setActivePreset(preset);
    const ctrl = cameraControllerRef.current;
    if (!ctrl) return;
    if (preset === "iso") ctrl.iso();
    else if (preset === "top") ctrl.top();
    else if (preset === "front") ctrl.front();
    else if (preset === "side") ctrl.side();
  };

  // ─── Booking Action Wrapper ─────────────────────────────────────────────────
  const handleBook = (option: TatkalOption) => {
    if (onBook) {
      onBook(option);
    } else {
      alert(`Booking initiated for ${option.trainName} (${option.trainNumber}) in ${option.travelClass} under Tatkal Quota!`);
    }
  };

  return (
    <div
      className={`train-viz-3d-root ${className}`}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        borderRadius: "20px",
        overflow: "hidden",
        border: "1px solid var(--line)",
        background: theme === "dark" ? "#050a14" : "#f0f6ff",
        boxShadow: "0 24px 70px rgba(0,0,0,0.4)",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        position: "relative",
        ...style,
      }}
    >
      {/* ── Top Bar / HUD Header ───────────────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: "12px 20px",
          background: "rgba(14, 24, 34, 0.88)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderBottom: "1px solid var(--line)",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "var(--accent)",
              display: "grid",
              placeItems: "center",
              fontSize: 16,
              color: "#fff",
              fontWeight: 900,
            }}
          >
            🎯
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--text)" }}>
              Tatkal 3D Train Decision Landscape
            </h2>
            <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
              Jaipur (JP) → Delhi · Multi-Objective Pareto Optimization
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.05)", padding: 4, borderRadius: 10 }}>
          <button
            onClick={() => setViewTab("3d")}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: 0,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              background: viewTab === "3d" ? "var(--accent)" : "transparent",
              color: viewTab === "3d" ? "#fff" : "var(--muted)",
              transition: "all 0.15s",
            }}
          >
            🌐 3D Volumetric
          </button>
          <button
            onClick={() => setViewTab("split")}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: 0,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              background: viewTab === "split" ? "var(--accent)" : "transparent",
              color: viewTab === "split" ? "#fff" : "var(--muted)",
              transition: "all 0.15s",
            }}
          >
            ◫ Split View
          </button>
          <button
            onClick={() => setViewTab("table")}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: 0,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              background: viewTab === "table" ? "var(--accent)" : "transparent",
              color: viewTab === "table" ? "#fff" : "var(--muted)",
              transition: "all 0.15s",
            }}
          >
            📊 Ranked List
          </button>
        </div>

        {/* Camera Preset Actions */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>Preset:</span>
          {(["iso", "top", "front", "side"] as const).map((preset) => (
            <button
              key={preset}
              onClick={() => handlePreset(preset)}
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                border: activePreset === preset ? "1px solid var(--accent)" : "1px solid var(--line)",
                background: activePreset === preset ? "rgba(30,64,175,0.25)" : "transparent",
                color: activePreset === preset ? "var(--accent)" : "var(--muted)",
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {preset}
            </button>
          ))}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            title="Toggle Auto-Rotation"
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              border: autoRotate ? "1px solid #10b981" : "1px solid var(--line)",
              background: autoRotate ? "rgba(16,185,129,0.2)" : "transparent",
              color: autoRotate ? "#10b981" : "var(--muted)",
              cursor: "pointer",
            }}
          >
            🔄 {autoRotate ? "Spin ON" : "Spin"}
          </button>
        </div>
      </header>

      {/* ── Main Workspace Body ────────────────────────────────────────────── */}
      <div style={{ display: "flex", position: "relative", minHeight: "620px", height: "70vh", width: "100%" }}>
        {/* 3D Scene Viewport (Rendered whenever viewTab is '3d' or 'split') */}
        {(viewTab === "3d" || viewTab === "split") && (
          <div
            style={{
              flex: viewTab === "split" ? 1.2 : 1,
              position: "relative",
              width: "100%",
              height: "100%",
            }}
            onPointerMove={handlePointerMove}
            onClick={handleClick}
          >
            <ThreeCanvas
              theme={theme}
              onSceneReady={handleSceneReady}
              onAnimate={handleAnimate}
              style={{ width: "100%", height: "100%", display: "block" }}
            />

            {/* Floating Top-Left Overlay: BestPickCard & Quick Sliders */}
            <div
              style={{
                position: "absolute",
                top: 16,
                left: 16,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                maxWidth: 320,
                width: "90%",
                pointerEvents: "auto",
                zIndex: 5,
              }}
            >
              <BestPickCard
                best={bestOption}
                onBook={handleBook}
                onSelect={(id) => flyToOption(id)}
              />

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setShowWeights(!showWeights)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    border: "1px solid var(--line)",
                    background: showWeights ? "var(--accent)" : "rgba(14,24,34,0.85)",
                    color: showWeights ? "#fff" : "var(--text)",
                    cursor: "pointer",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  ⚖️ {showWeights ? "Hide Weights" : "Adjust Weights"}
                </button>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    border: "1px solid var(--line)",
                    background: showFilters ? "var(--accent)" : "rgba(14,24,34,0.85)",
                    color: showFilters ? "#fff" : "var(--text)",
                    cursor: "pointer",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  🔍 {showFilters ? "Hide Filters" : "Filters"}
                </button>
              </div>

              {showWeights && (
                <WeightSliderPanel weights={weights} onChange={setWeights} />
              )}

              {showFilters && (
                <FilterToolbar filter={filter} onChange={setFilter} />
              )}
            </div>

            {/* Floating Bottom-Center Legend */}
            <div
              style={{
                position: "absolute",
                bottom: 16,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 5,
                pointerEvents: "auto",
                maxWidth: 420,
                width: "90%",
              }}
            >
              <LegendGradient
                colorblindMode={colorblindMode}
                onToggleColorblind={() => setColorblindMode(!colorblindMode)}
              />
            </div>

            {/* Hover Tooltip Micro-HUD */}
            {hoveredId && !selectedId && (
              <div
                style={{
                  position: "absolute",
                  bottom: 70,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "rgba(10, 18, 30, 0.95)",
                  border: "1px solid var(--accent)",
                  borderRadius: 10,
                  padding: "8px 16px",
                  fontSize: 12,
                  color: "#fff",
                  pointerEvents: "none",
                  zIndex: 6,
                  backdropFilter: "blur(12px)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                }}
              >
                {(() => {
                  const opt = allScored.find((o) => o.id === hoveredId);
                  if (!opt) return null;
                  return (
                    <span>
                      <strong>{opt.trainName}</strong> ({opt.trainNumber} · {opt.travelClass}) — ₹{opt.fare} · {opt.duration.toFixed(1)}h · {opt.tatkalSuccessChance}% Success
                    </span>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Side Panel: Train Detail Drawer OR Linked2DTable */}
        <div
          style={{
            flex: viewTab === "table" ? 1 : viewTab === "split" ? 0.8 : selectedOption ? 0.35 : 0,
            display: viewTab === "3d" && !selectedOption ? "none" : "flex",
            flexDirection: "column",
            borderLeft: "1px solid var(--line)",
            background: "rgba(10, 18, 28, 0.96)",
            backdropFilter: "blur(20px)",
            padding: 16,
            gap: 12,
            overflowY: "auto",
            zIndex: 8,
            transition: "flex 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {selectedOption ? (
            <TrainDetailDrawer
              option={selectedOption}
              onClose={() => setSelectedId(null)}
              onBook={handleBook}
            />
          ) : (
            <Linked2DTable
              options={filteredScored}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelectOption={(id) => flyToOption(id)}
              onHoverOption={setHoveredId}
            />
          )}

          {viewTab === "split" && selectedOption && (
            <div style={{ marginTop: 12 }}>
              <Linked2DTable
                options={filteredScored}
                selectedId={selectedId}
                hoveredId={hoveredId}
                onSelectOption={(id) => flyToOption(id)}
                onHoverOption={setHoveredId}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
