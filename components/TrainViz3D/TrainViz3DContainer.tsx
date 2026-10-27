"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Train } from "../../lib/types";
import { DataBasis, FilterState, ScoreWeights, TatkalOption, TravelClass } from "./lib/types";
import { computeScores, filterOptions } from "./lib/scoringEngine";
import { adaptTrains } from "./lib/realTrainAdapter";
import { boundsKey, computeBounds } from "./lib/bounds";
import { glassPanel, vizCssVars, VizTheme } from "./lib/theme";
import { useLiveSeats, SeatRequest } from "./lib/useLiveSeats";
import { useMediaQuery } from "./lib/useMediaQuery";
import ThreeCanvas, { ThreeSceneHandle } from "./Scene/ThreeCanvas";
import { buildCoordinateCage } from "./Scene/CoordinateCage";
import { buildLightingAndAtmosphere, LightingHandle } from "./Scene/LightingAndAtmosphere";
import { CameraController, CameraPreset } from "./Scene/CameraController";
import { LabelMode, TrainNodeLayer } from "./Scene/TrainNodeLayer";
import { disposeObject } from "./Scene/dispose";

import BestPickCard from "./HUD/BestPickCard";
import WeightSliderPanel from "./HUD/WeightSliderPanel";
import FilterToolbar from "./HUD/FilterToolbar";
import LegendGradient from "./HUD/LegendGradient";
import TrainDetailDrawer from "./HUD/TrainDetailDrawer";
import Linked2DTable from "./HUD/Linked2DTable";
import DataStatusBar from "./HUD/DataStatusBar";
import { BasisBadge } from "./HUD/BasisBadge";
import { MessageState, SceneSkeleton } from "./HUD/States";
import { Icon, IconName } from "./HUD/icons";
import { VIZ_CSS, btnBase, btnActive } from "./HUD/ui";

interface TrainViz3DContainerProps {
  /** Trains for the chosen route (real search results). */
  trains: Train[];
  /** Optional parent-managed live availability map (for backwards compatibility). */
  liveAvailability?: Record<string, string>;
  /** ISO journey date, e.g. "2026-10-28". */
  journeyDate?: string;
  theme: VizTheme;
  /** Called when the user chooses "Book Tatkal now". */
  onBook: (option: TatkalOption) => void;
  className?: string;
  style?: React.CSSProperties;
}

type ViewTab = "3d" | "split" | "table";

const DEFAULT_WEIGHTS: ScoreWeights = { success: 0.5, fare: 0.25, duration: 0.25 };
const PREFETCH_COUNT = 10;
const CLICK_SLOP_PX = 5;

const VIEW_TABS: { id: ViewTab; label: string; icon: IconName }[] = [
  { id: "3d", label: "3D", icon: "cube" },
  { id: "split", label: "Split", icon: "split" },
  { id: "table", label: "List", icon: "list" },
];

const PRESETS: { id: CameraPreset; label: string }[] = [
  { id: "reset", label: "Reset" },
  { id: "top", label: "Top" },
  { id: "front", label: "Front" },
  { id: "side", label: "Side" },
];

const toggleBtn = (active: boolean): React.CSSProperties => ({ ...btnBase, ...(active ? btnActive : {}) });

function formatJourneyDate(iso?: string): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function TrainViz3DContainer({
  trains,
  journeyDate,
  theme,
  onBook,
  className = "",
  style,
}: TrainViz3DContainerProps) {
  // ─── Data pipeline: real trains + real seat reads → options ────────────────
  const { seats, pending, failed, request } = useLiveSeats(journeyDate);
  const { options, excluded } = useMemo(() => adaptTrains(trains, seats), [trains, seats]);

  const rawBounds = useMemo(() => computeBounds(options), [options]);
  const bKey = boundsKey(rawBounds);
  // Only rebuild the cage when the geometry actually changes, not on every seat read.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bounds = useMemo(() => rawBounds, [bKey]);

  // ─── UI state ───────────────────────────────────────────────────────────────
  const [weights, setWeights] = useState<ScoreWeights>(DEFAULT_WEIGHTS);
  const [filterOverride, setFilterOverride] = useState<FilterState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [colorblind, setColorblind] = useState(false);
  const [labelMode, setLabelMode] = useState<LabelMode>("key");
  const [viewTab, setViewTab] = useState<ViewTab>("3d");
  const [autoRotate, setAutoRotate] = useState(false);
  const [activePreset, setActivePreset] = useState<CameraPreset | null>("reset");
  const [showFilters, setShowFilters] = useState(false);
  const [showWeights, setShowWeights] = useState(false);
  const [sceneHandle, setSceneHandle] = useState<ThreeSceneHandle | null>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [sceneKey, setSceneKey] = useState(0);

  const isNarrow = useMediaQuery("(max-width: 860px)");

  // ─── Scoring & filtering ────────────────────────────────────────────────────
  const allScored = useMemo(() => computeScores(options, weights), [options, weights]);

  const defaultFilter = useMemo<FilterState>(
    () => ({
      classes: new Set<TravelClass>(),
      maxFare: bounds.fareMax,
      minSuccessChance: 0,
      maxDuration: bounds.durationMax,
      departureAfter: "00:00",
      departureBefore: "23:59",
    }),
    [bounds]
  );
  const filter = filterOverride ?? defaultFilter;
  const filteredScored = useMemo(() => filterOptions(allScored, filter), [allScored, filter]);
  const visibleIds = useMemo(() => new Set(filteredScored.map((o) => o.id)), [filteredScored]);
  const bestOption = filteredScored[0] ?? null;
  const selectedOption = useMemo(
    () => (selectedId ? allScored.find((o) => o.id === selectedId) ?? null : null),
    [allScored, selectedId]
  );
  const availableClasses = useMemo(
    () => (["SL", "3A", "2A", "1A", "CC", "EC"] as TravelClass[]).filter((c) => options.some((o) => o.travelClass === c)),
    [options]
  );
  const basisCounts = useMemo(() => {
    const c: Record<DataBasis, number> = { live: 0, baseline: 0, estimate: 0 };
    options.forEach((o) => (c[o.successBasis] += 1));
    return c;
  }, [options]);
  const demoTimetable = useMemo(() => trains.some((t) => t.liveSource === "prototype"), [trains]);

  // Drop a selection whose option no longer exists (e.g. after a data refresh).
  useEffect(() => {
    if (selectedId && !allScored.some((o) => o.id === selectedId)) setSelectedId(null);
  }, [allScored, selectedId]);

  // ─── Live seat requests ─────────────────────────────────────────────────────
  const trainOf = useCallback(
    (o: TatkalOption): Train | undefined =>
      trains.find((t) => t.number === o.trainNumber && t.fromCode === o.fromCode && t.toCode === o.toCode),
    [trains]
  );
  const toRequests = useCallback(
    (list: TatkalOption[]): SeatRequest[] =>
      list.flatMap((o) => {
        const train = trainOf(o);
        return train ? [{ train, cls: o.travelClass }] : [];
      }),
    [trainOf]
  );

  // Read the best-ranked options once per route/date. Ranking uses what we know now.
  const prefetchedFor = useRef("");
  useEffect(() => {
    const signature = `${journeyDate ?? ""}|${trains.map((t) => t.id).join(",")}`;
    if (allScored.length === 0 || prefetchedFor.current === signature) return;
    prefetchedFor.current = signature;
    request(toRequests(allScored.slice(0, PREFETCH_COUNT)));
  }, [allScored, trains, journeyDate, request, toRequests]);

  const refreshTop = useCallback(() => {
    request(toRequests(allScored.slice(0, PREFETCH_COUNT)), true);
  }, [allScored, request, toRequests]);

  const refreshOne = useCallback(
    (o: TatkalOption) => request(toRequests([o]), true),
    [request, toRequests]
  );

  // ─── Three.js objects (all owned here, all disposed here) ───────────────────
  const cameraRef = useRef<CameraController | null>(null);
  const lightingRef = useRef<LightingHandle | null>(null);
  const layerRef = useRef<TrainNodeLayer | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const viewportRef = useRef<HTMLDivElement>(null);
  const downRef = useRef<{ x: number; y: number } | null>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const handleSceneReady = useCallback((h: ThreeSceneHandle) => {
    setSceneError(null);
    setSceneHandle(h);
  }, []);
  const handleSceneDispose = useCallback(() => setSceneHandle(null), []);
  const handleSceneError = useCallback((message: string) => {
    setSceneHandle(null);
    setSceneError(message);
  }, []);

  // Camera + lights + marker layer: created once per WebGL scene.
  useEffect(() => {
    if (!sceneHandle) return;
    const { scene, camera, canvas } = sceneHandle;
    const cam = new CameraController(camera, canvas);
    const onStart = () => setActivePreset(null);
    cam.controls.addEventListener("start", onStart);
    const lighting = buildLightingAndAtmosphere(scene, themeRef.current);
    scene.add(lighting.group);
    const layer = new TrainNodeLayer(scene, { theme: themeRef.current, colorblind: false, labelMode: "key" });
    cameraRef.current = cam;
    lightingRef.current = lighting;
    layerRef.current = layer;
    return () => {
      cam.controls.removeEventListener("start", onStart);
      cam.dispose();
      lighting.dispose();
      layer.dispose();
      cameraRef.current = null;
      lightingRef.current = null;
      layerRef.current = null;
    };
  }, [sceneHandle]);

  // Coordinate cage: rebuilt only for a new theme or new axis ranges.
  useEffect(() => {
    if (!sceneHandle) return;
    const cage = buildCoordinateCage(theme, bounds);
    sceneHandle.scene.add(cage);
    return () => disposeObject(cage);
  }, [sceneHandle, theme, bounds]);

  useEffect(() => {
    lightingRef.current?.updateTheme(theme);
  }, [theme, sceneHandle]);

  // Markers glide to new positions/colours instead of being rebuilt.
  useEffect(() => {
    layerRef.current?.sync(allScored, bounds, { theme, colorblind, labelMode });
  }, [sceneHandle, allScored, bounds, theme, colorblind, labelMode]);

  useEffect(() => {
    layerRef.current?.setView({ visibleIds, hoveredId, selectedId });
  }, [sceneHandle, visibleIds, hoveredId, selectedId]);

  useEffect(() => {
    cameraRef.current?.setAutoRotate(autoRotate && !selectedId);
  }, [autoRotate, selectedId, sceneHandle]);

  const handleAnimate = useCallback((delta: number) => {
    cameraRef.current?.update();
    layerRef.current?.update(delta);
  }, []);

  // ─── Interaction ────────────────────────────────────────────────────────────
  const flyToOption = useCallback(
    (id: string) => {
      setSelectedId(id);
      const cam = cameraRef.current;
      const layer = layerRef.current;
      const option = allScored.find((o) => o.id === id);
      if (option) request(toRequests([option]));
      if (!cam || !layer) return;
      const target = layer.worldPositionOf(id);
      if (!target) return;
      // Keep the user's viewing direction; just move closer to the chosen marker.
      const dir = cam.controls.object.position.clone().sub(cam.controls.target);
      if (dir.lengthSq() < 1e-6) dir.set(1, 0.7, 1);
      cam.flyTo(target.clone().add(dir.normalize().multiplyScalar(1.7)), target);
    },
    [allScored, request, toRequests]
  );

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    cameraRef.current?.preset("reset");
    setActivePreset("reset");
  }, []);

  const pickAt = useCallback(
    (clientX: number, clientY: number): string | null => {
      const handle = sceneHandle;
      const layer = layerRef.current;
      if (!handle || !layer) return null;
      const rect = handle.canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      raycasterRef.current.setFromCamera(ndc, handle.camera);
      return layer.pick(raycasterRef.current);
    },
    [sceneHandle]
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    downRef.current = e.target === sceneHandle?.canvas ? { x: e.clientX, y: e.clientY } : null;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !sceneHandle) return;
    if (e.target !== sceneHandle.canvas) {
      if (hoveredId) setHoveredId(null);
      return;
    }
    const id = pickAt(e.clientX, e.clientY);
    sceneHandle.canvas.style.cursor = id ? "pointer" : "grab";
    if (id !== hoveredId) setHoveredId(id);
    if (id) {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (rect) setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const down = downRef.current;
    downRef.current = null;
    if (!down || e.target !== sceneHandle?.canvas) return;
    // A drag (orbit/pan) is not a click.
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_SLOP_PX) return;
    const id = pickAt(e.clientX, e.clientY);
    if (id) flyToOption(id);
    else if (selectedId) clearSelection();
  };

  const onViewportKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return; // never hijack sliders / buttons inside the HUD
    if (e.key === "Escape") {
      if (selectedId) clearSelection();
      return;
    }
    const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
    const backward = e.key === "ArrowLeft" || e.key === "ArrowUp";
    if (!forward && !backward) return;
    e.preventDefault();
    if (filteredScored.length === 0) return;
    const idx = filteredScored.findIndex((o) => o.id === selectedId);
    const next = idx === -1 ? 0 : (idx + (forward ? 1 : -1) + filteredScored.length) % filteredScored.length;
    flyToOption(filteredScored[next].id);
  };

  const onPreset = (preset: CameraPreset) => {
    setActivePreset(preset);
    cameraRef.current?.preset(preset);
  };

  // ─── Derived presentation ───────────────────────────────────────────────────
  const route = useMemo(() => {
    if (trains.length === 0) return "";
    const dests = [...new Set(trains.map((t) => t.toCode))];
    return `${trains[0].from} → ${dests.length === 1 ? trains[0].to : dests.join(" · ")}`;
  }, [trains]);
  const dateText = formatJourneyDate(journeyDate);
  const hoveredOption = hoveredId ? allScored.find((o) => o.id === hoveredId) ?? null : null;

  const showScene = viewTab !== "table";
  const hasData = options.length > 0;

  // The control stack lives over the scene on desktop and inside the side panel otherwise.
  const controls = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <BestPickCard best={bestOption} onBook={onBook} onSelect={flyToOption} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="tv3d-btn" data-active={showWeights} aria-pressed={showWeights} onClick={() => setShowWeights((v) => !v)} style={{ ...toggleBtn(showWeights), background: showWeights ? "var(--viz-accent)" : "var(--viz-panel)" , color: showWeights ? "var(--viz-on-accent)" : "var(--viz-text)" }}>
          <Icon name="sliders" size={13} /> Weights
        </button>
        <button type="button" className="tv3d-btn" data-active={showFilters} aria-pressed={showFilters} onClick={() => setShowFilters((v) => !v)} style={{ ...toggleBtn(showFilters), background: showFilters ? "var(--viz-accent)" : "var(--viz-panel)", color: showFilters ? "var(--viz-on-accent)" : "var(--viz-text)" }}>
          <Icon name="filter" size={13} /> Filters{filterOverride ? " •" : ""}
        </button>
      </div>
      {showWeights && <WeightSliderPanel weights={weights} onChange={setWeights} />}
      {showFilters && (
        <FilterToolbar
          filter={filter}
          bounds={bounds}
          availableClasses={availableClasses}
          isFiltered={filterOverride !== null}
          onChange={setFilterOverride}
          onReset={() => setFilterOverride(null)}
        />
      )}
    </div>
  );

  const sidePanel = (
    <div
      className="tv3d-scroll"
      style={{
        flex: isNarrow ? "none" : viewTab === "table" ? 1 : viewTab === "split" ? "0 0 38%" : "0 0 360px",
        display: viewTab === "3d" && !selectedOption && !isNarrow ? "none" : "flex",
        flexDirection: "column",
        gap: 12,
        padding: 14,
        overflowY: "auto",
        borderLeft: isNarrow ? "none" : "1px solid var(--viz-line)",
        borderTop: isNarrow ? "1px solid var(--viz-line)" : "none",
        background: "var(--viz-panel-solid)",
        minWidth: 0,
      }}
    >
      {(!showScene || isNarrow) && controls}
      {selectedOption && (
        <TrainDetailDrawer
          option={selectedOption}
          journeyDate={journeyDate}
          seatsPending={pending > 0}
          onClose={clearSelection}
          onBook={onBook}
          onRefreshSeats={refreshOne}
        />
      )}
      {(viewTab !== "3d" || !selectedOption || isNarrow) && (viewTab !== "3d" || isNarrow) && (
        <Linked2DTable
          options={filteredScored}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelectOption={flyToOption}
          onHoverOption={setHoveredId}
        />
      )}
    </div>
  );

  return (
    <div
      className={`tv3d train-viz-3d-root ${className}`}
      data-theme={theme}
      style={{
        ...vizCssVars(theme),
        display: "flex",
        flexDirection: "column",
        width: "100%",
        borderRadius: 20,
        overflow: "hidden",
        border: "1px solid var(--viz-line)",
        background: "var(--viz-bg)",
        color: "var(--viz-text)",
        boxShadow: "var(--viz-shadow)",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        position: "relative",
        ...style,
      }}
    >
      <style>{VIZ_CSS}</style>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10,
          padding: "10px 20px", background: "var(--viz-panel-solid)", borderBottom: "1px solid var(--viz-line)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div
            aria-hidden="true"
            style={{ width: 34, height: 34, borderRadius: 9, background: "var(--viz-accent)", color: "var(--viz-on-accent)", display: "grid", placeItems: "center", flexShrink: 0 }}
          >
            <Icon name="target" size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--viz-text)" }}>Tatkal Decision Landscape</h2>
            <p style={{ margin: 0, fontSize: 12, color: "var(--viz-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {route || "Choose a route"}{dateText ? ` · ${dateText}` : ""} · {filteredScored.length} of {options.length} options
            </p>
          </div>
        </div>

        <div role="tablist" aria-label="View" style={{ display: "flex", gap: 4, background: "var(--viz-inset)", padding: 3, borderRadius: 10, border: "1px solid var(--viz-line)" }}>
          {VIEW_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={viewTab === t.id}
              className="tv3d-btn"
              data-active={viewTab === t.id}
              onClick={() => setViewTab(t.id)}
              style={{ ...toggleBtn(viewTab === t.id), border: "1px solid transparent", fontWeight: 700 }}
            >
              <Icon name={t.icon} size={13} /> {t.label}
            </button>
          ))}
        </div>

        {showScene && (
          <div role="group" aria-label="Camera" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className="tv3d-btn" data-active={activePreset === p.id} aria-pressed={activePreset === p.id} onClick={() => onPreset(p.id)} style={toggleBtn(activePreset === p.id)}>
                {p.label}
              </button>
            ))}
            <button type="button" className="tv3d-btn" data-active={autoRotate} aria-pressed={autoRotate} title="Auto-rotate the scene" onClick={() => setAutoRotate((v) => !v)} style={toggleBtn(autoRotate)}>
              <Icon name="rotate" size={13} /> Spin
            </button>
          </div>
        )}
      </header>

      <DataStatusBar counts={basisCounts} pending={pending} failed={failed} excluded={excluded} demoTimetable={demoTimetable} onRefresh={refreshTop} />

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: isNarrow ? "column" : "row",
          position: "relative",
          width: "100%",
          height: isNarrow ? "auto" : "min(74vh, 780px)",
          minHeight: isNarrow ? 0 : 560,
        }}
      >
        {showScene && (
          <div
            ref={viewportRef}
            tabIndex={0}
            role="application"
            aria-label="3D comparison of trains. Use arrow keys to step through trains, Escape to clear."
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={() => setHoveredId(null)}
            onKeyDown={onViewportKeyDown}
            style={{ flex: 1, position: "relative", minHeight: isNarrow ? 420 : 0, minWidth: 0, outlineOffset: -2 }}
          >
            {!sceneError && (
              <ThreeCanvas
                key={sceneKey}
                theme={theme}
                onSceneReady={handleSceneReady}
                onSceneDispose={handleSceneDispose}
                onError={handleSceneError}
                onAnimate={handleAnimate}
                style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
              />
            )}

            {!sceneHandle && !sceneError && <SceneSkeleton />}

            {!isNarrow && (
              <div style={{ position: "absolute", top: 14, left: 14, width: 320, maxWidth: "calc(100% - 28px)", maxHeight: "calc(100% - 100px)", overflowY: "auto", zIndex: 5 }} className="tv3d-scroll">
                {controls}
              </div>
            )}

            <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", width: "min(560px, calc(100% - 28px))", zIndex: 5 }}>
              <LegendGradient
                theme={theme}
                colorblindMode={colorblind}
                onToggleColorblind={() => setColorblind((v) => !v)}
                labelMode={labelMode}
                onToggleLabels={() => setLabelMode((m) => (m === "key" ? "all" : "key"))}
              />
            </div>

            {hoveredOption && !isNarrow && (
              <div
                role="tooltip"
                style={{
                  ...glassPanel, position: "absolute", pointerEvents: "none", zIndex: 7, padding: "8px 12px", fontSize: 12, width: 236, borderRadius: 10,
                  left: Math.min((hoverPos?.x ?? 0) + 16, (viewportRef.current?.clientWidth ?? 800) - 252),
                  top: Math.min((hoverPos?.y ?? 0) + 16, (viewportRef.current?.clientHeight ?? 600) - 150),
                  background: "var(--viz-panel-solid)",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{hoveredOption.trainName}</div>
                <div style={{ color: "var(--viz-muted)", marginBottom: 6 }}>
                  {hoveredOption.trainNumber} · {hoveredOption.travelClass} · Rank #{hoveredOption.rank}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 10px", fontVariantNumeric: "tabular-nums" }}>
                  <span style={{ color: "var(--viz-muted)" }}>Fare</span>
                  <strong>{hoveredOption.fareBasis === "estimated" ? "≈" : ""}₹{hoveredOption.fare.toLocaleString("en-IN")}</strong>
                  <span style={{ color: "var(--viz-muted)" }}>Time</span>
                  <strong>{hoveredOption.departureTime} → {hoveredOption.arrivalTime} ({hoveredOption.duration.toFixed(1)}h)</strong>
                  <span style={{ color: "var(--viz-muted)" }}>Success</span>
                  <strong>{hoveredOption.successBasis === "estimate" ? "≈" : ""}{hoveredOption.tatkalSuccessChance}%</strong>
                  <span style={{ color: "var(--viz-muted)" }}>Seats</span>
                  <strong>{hoveredOption.seatsHint ?? "—"}</strong>
                </div>
                <div style={{ marginTop: 6 }}><BasisBadge basis={hoveredOption.successBasis} /></div>
              </div>
            )}

            {sceneError && (
              <MessageState
                tone="error"
                title="3D view unavailable"
                detail={`${sceneError} The ranked list below shows the same data.`}
                actionLabel="Retry 3D"
                onAction={() => {
                  setSceneError(null);
                  setSceneKey((k) => k + 1);
                }}
              />
            )}
          </div>
        )}

        {sidePanel}

        {!hasData && (
          <MessageState
            title={trains.length === 0 ? "No trains to compare yet" : "No comparable options"}
            detail={
              trains.length === 0
                ? "Search a route and date first. The landscape appears as soon as trains are found."
                : `${excluded.length} option${excluded.length === 1 ? " was" : "s were"} excluded because required details (fare, duration, class or an open booking status) are missing.`
            }
          />
        )}
      </div>
    </div>
  );
}
