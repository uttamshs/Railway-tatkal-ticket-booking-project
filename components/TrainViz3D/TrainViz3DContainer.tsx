"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Train } from "../../lib/types";
import { DataBasis, FilterState, ScoreWeights, TatkalOption, TravelClass } from "./lib/types";
import { computeScores, filterOptions } from "./lib/scoringEngine";
import { adaptTrains } from "./lib/realTrainAdapter";
import { TIME_HORIZONS, projectOptionsAtTime, selectBackupPair } from "./lib/temporalModel";
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
import TemporalScrubberBar from "./HUD/TemporalScrubberBar";
import IntentStrip, { RelaxAction } from "./HUD/IntentStrip";
import { EMPHASIS_WEIGHTS, VizIntent } from "./lib/vizIntent";
import { BasisBadge } from "./HUD/BasisBadge";
import { MessageState, SceneSkeleton } from "./HUD/States";
import { Icon, IconName } from "./HUD/icons";
import { VIZ_CSS, btnBase, btnActive, btnPrimary } from "./HUD/ui";

interface TrainViz3DContainerProps {
  /** Trains for the chosen route (real search results). */
  trains: Train[];
  /** Optional parent-managed live availability map (for backwards compatibility). */
  liveAvailability?: Record<string, string>;
  /** ISO journey date, e.g. "2026-10-28". */
  journeyDate?: string;
  theme: VizTheme;
  /** Called when the user chooses "Book Tatkal now". Passes primary option + locked Backup B. */
  onBook: (option: TatkalOption, backupOption?: TatkalOption | null) => void;
  /**
   * Optional Express-intent hand-off (route/date are handled by the host; this carries the filters).
   * Applied once per `intent.nonce`; absent = the visualizer behaves exactly as before.
   */
  intent?: VizIntent | null;
  /** Called when the user clears the applied intent, so the host can forget it too. */
  onClearIntent?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

type ViewTab = "3d" | "split" | "table";

const DEFAULT_WEIGHTS: ScoreWeights = { success: 0.5, fare: 0.25, duration: 0.25 };
const PREFETCH_COUNT = 24;
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
  intent,
  onClearIntent,
  className = "",
  style,
}: TrainViz3DContainerProps) {
  // --- Data pipeline: real trains + real seat reads → base options ---
  const { seats, pending, failed, request } = useLiveSeats(journeyDate);
  const { options: baseOptions, excluded } = useMemo(() => adaptTrains(trains, seats), [trains, seats]);

  // --- 2.1, 2.2, 2.3, 2.4 State ---
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeQuotaJumpIds, setActiveQuotaJumpIds] = useState<Set<string>>(() => new Set());
  const [showQuotaVectors, setShowQuotaVectors] = useState<boolean>(true);
  const [pinnedPlanAId, setPinnedPlanAId] = useState<string | null>(null);
  const [pinnedBackupBId, setPinnedBackupBId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState<boolean>(false);

  // Project options forward to T + elapsedSec and compute Quota-Jump vectors
  const options = useMemo(
    () => projectOptionsAtTime(baseOptions, elapsedSec, activeQuotaJumpIds),
    [baseOptions, elapsedSec, activeQuotaJumpIds]
  );

  // Keep cage bounds stable across temporal scrubbing by fitting to baseOptions + max quota jump fare
  const rawBounds = useMemo(() => {
    const withMaxJump = options.map((o) =>
      o.quotaJump ? { ...o, fare: Math.max(o.fare, o.quotaJump.fareWithJump) } : o
    );
    return computeBounds(withMaxJump);
  }, [options]);
  const bKey = boundsKey(rawBounds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bounds = useMemo(() => rawBounds, [bKey]);

  // --- UI state ---
  const [weights, setWeights] = useState<ScoreWeights>(DEFAULT_WEIGHTS);
  const [filterOverride, setFilterOverride] = useState<FilterState | null>(null);
  // Express intent (home-page prompt bar): kept separate from `filterOverride` so that numeric limits the
  // user did NOT mention keep tracking live data bounds instead of freezing at the first load.
  const [intentFilter, setIntentFilter] = useState<VizIntent | null>(null);
  const [intentVisible, setIntentVisible] = useState(false);
  const appliedIntentNonce = useRef<number | null>(null);
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

  // --- Express intent: apply once per launch ---
  useEffect(() => {
    if (!intent || appliedIntentNonce.current === intent.nonce) return;
    appliedIntentNonce.current = intent.nonce;
    setFilterOverride(null);
    setIntentFilter(intent);
    setIntentVisible(true);
    if (intent.emphasis) setWeights(EMPHASIS_WEIGHTS[intent.emphasis]);
  }, [intent]);

  const clearIntent = useCallback(() => {
    if (intentFilter?.emphasis) setWeights(DEFAULT_WEIGHTS);
    setFilterOverride(null);
    setIntentFilter(null);
    setIntentVisible(false);
    onClearIntent?.();
  }, [intentFilter, onClearIntent]);

  // --- Temporal simulation playback timer (Feature 2.1) ---
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setElapsedSec((prev) => {
        const idx = TIME_HORIZONS.indexOf(prev as (typeof TIME_HORIZONS)[number]);
        if (idx === -1 || idx >= TIME_HORIZONS.length - 1) {
          setIsPlaying(false);
          return TIME_HORIZONS[TIME_HORIZONS.length - 1];
        }
        return TIME_HORIZONS[idx + 1];
      });
    }, 1350);
    return () => clearInterval(id);
  }, [isPlaying]);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((playing) => {
      if (!playing && elapsedSec >= TIME_HORIZONS[TIME_HORIZONS.length - 1]) {
        setElapsedSec(0);
      }
      return !playing;
    });
  }, [elapsedSec]);

  // --- Scoring, Filtering & Real-Time Backup Pair Coordination (2.2) ---
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
  const filter = useMemo<FilterState>(() => {
    if (filterOverride) return filterOverride;
    if (!intentFilter) return defaultFilter;
    return {
      classes: new Set<TravelClass>(intentFilter.classes ?? []),
      maxFare: intentFilter.maxFare ?? defaultFilter.maxFare,
      minSuccessChance: intentFilter.minSuccess ?? 0,
      maxDuration: intentFilter.maxDuration ?? defaultFilter.maxDuration,
      departureAfter: intentFilter.departureAfter ?? "00:00",
      departureBefore: intentFilter.departureBefore ?? "23:59",
    };
  }, [filterOverride, intentFilter, defaultFilter]);
  const filteredScored = useMemo(() => filterOptions(allScored, filter), [allScored, filter]);
  const visibleIds = useMemo(() => new Set(filteredScored.map((o) => o.id)), [filteredScored]);

  // --- Express intent: truthful live summary + one-tap relaxations ---
  const timeConstrained = filter.departureAfter !== "00:00" || filter.departureBefore !== "23:59";
  const filterChips = useMemo(() => {
    const chips: string[] = [];
    if (filter.classes.size > 0) {
      const order: TravelClass[] = ["1A", "2A", "3A", "CC", "EC", "SL"];
      chips.push(order.filter((c) => filter.classes.has(c)).join(" · "));
    }
    if (timeConstrained) {
      chips.push(
        filter.departureAfter !== "00:00" && filter.departureBefore !== "23:59"
          ? `Departs ${filter.departureAfter}–${filter.departureBefore}`
          : filter.departureAfter !== "00:00"
            ? `Departs after ${filter.departureAfter}`
            : `Departs before ${filter.departureBefore}`
      );
    }
    if (filter.maxFare < bounds.fareMax) chips.push(`Fare ≤ ₹${Math.round(filter.maxFare).toLocaleString("en-IN")}`);
    if (filter.maxDuration < bounds.durationMax) chips.push(`Journey ≤ ${Number(filter.maxDuration.toFixed(2))}h`);
    if (filter.minSuccessChance > 0) chips.push(`Odds ≥ ${filter.minSuccessChance}%`);
    return chips;
  }, [filter, bounds, timeConstrained]);

  const relaxActions = useMemo<RelaxAction[]>(() => {
    if (!intentFilter || allScored.length === 0 || filteredScored.length > 0) return [];
    const candidates: { key: string; label: string; patch: Partial<FilterState> }[] = [];
    if (filter.classes.size > 0) candidates.push({ key: "classes", label: "Any class", patch: { classes: new Set<TravelClass>() } });
    if (timeConstrained) candidates.push({ key: "time", label: "Any departure time", patch: { departureAfter: "00:00", departureBefore: "23:59" } });
    if (filter.maxFare < bounds.fareMax) candidates.push({ key: "fare", label: "No fare limit", patch: { maxFare: bounds.fareMax } });
    if (filter.maxDuration < bounds.durationMax) candidates.push({ key: "duration", label: "Any journey length", patch: { maxDuration: bounds.durationMax } });
    if (filter.minSuccessChance > 0) candidates.push({ key: "odds", label: "Any odds", patch: { minSuccessChance: 0 } });
    return candidates
      .map((c) => ({
        key: c.key,
        label: c.label,
        gain: filterOptions(allScored, { ...filter, ...c.patch }).length,
        onClick: () => setFilterOverride({ ...filter, ...c.patch }),
      }))
      .filter((a) => a.gain > 0)
      .sort((a, b) => b.gain - a.gain)
      .slice(0, 2);
  }, [intentFilter, allScored, filteredScored.length, filter, bounds, timeConstrained]);

  const { planA, backupB, shouldPivot, pivotReason } = useMemo(
    () => selectBackupPair(filteredScored, pinnedPlanAId, pinnedBackupBId),
    [filteredScored, pinnedPlanAId, pinnedBackupBId]
  );

  // Survivor Triad for Rapid Focus Mode (2.4): Plan A, Backup B, and next Pareto survivor
  const survivorTriad = useMemo(() => {
    const list: typeof filteredScored = [];
    if (planA) list.push(planA);
    if (backupB && !list.some((x) => x.id === backupB.id)) list.push(backupB);
    for (const o of filteredScored) {
      if (list.length >= 3) break;
      if (!list.some((x) => x.id === o.id) && (o.paretoOptimal || o.rank <= 4)) {
        list.push(o);
      }
    }
    return list;
  }, [planA, backupB, filteredScored]);

  const survivorIds = useMemo(() => new Set(survivorTriad.map((o) => o.id)), [survivorTriad]);

  const selectedOption = useMemo(
    () => (selectedId ? allScored.find((o) => o.id === selectedId) ?? null : null),
    [allScored, selectedId]
  );
  const availableClasses = useMemo(
    () =>
      (["SL", "3A", "2A", "1A", "CC", "EC"] as TravelClass[]).filter((c) =>
        options.some((o) => o.travelClass === c)
      ),
    [options]
  );
  const basisCounts = useMemo(() => {
    const c: Record<DataBasis, number> = { live: 0, baseline: 0, estimate: 0 };
    options.forEach((o) => (c[o.successBasis] += 1));
    return c;
  }, [options]);
  const demoTimetable = useMemo(() => trains.some((t) => t.liveSource === "prototype"), [trains]);

  const highOddsCount = useMemo(
    () => filteredScored.filter((o) => o.tatkalSuccessChance >= 70).length,
    [filteredScored]
  );
  const quotaEligibleIds = useMemo(
    () => options.filter((o) => Boolean(o.quotaJump)).map((o) => o.id),
    [options]
  );
  const activeQuotaJumpCount = useMemo(
    () => quotaEligibleIds.filter((id) => activeQuotaJumpIds.has(id)).length,
    [quotaEligibleIds, activeQuotaJumpIds]
  );

  const toggleQuotaJumpFor = useCallback((id: string) => {
    setActiveQuotaJumpIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllQuotaJumps = useCallback(() => {
    setActiveQuotaJumpIds((prev) => {
      const allOn = quotaEligibleIds.length > 0 && quotaEligibleIds.every((id) => prev.has(id));
      return allOn ? new Set() : new Set(quotaEligibleIds);
    });
  }, [quotaEligibleIds]);

  // Drop a selection whose option no longer exists.
  useEffect(() => {
    if (selectedId && !allScored.some((o) => o.id === selectedId)) setSelectedId(null);
  }, [allScored, selectedId]);

  // --- Live seat requests ---
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

  const initialTatkalRequests = useMemo(() => {
    const tatkalClasses = ["SL", "3A", "2A", "1A", "CC", "EC"] as const;
    return trains.flatMap((train) => {
      const advertised = new Set((train.classes ?? []).filter((cls) => tatkalClasses.includes(cls as typeof tatkalClasses[number])));
      const classes = advertised.size > 0
        ? tatkalClasses.filter((cls) => advertised.has(cls))
        : tatkalClasses;
      return classes.map((cls) => ({ train, cls }));
    });
  }, [trains]);
  useEffect(() => {
    request(initialTatkalRequests);
  }, [initialTatkalRequests, journeyDate, request]);

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

  // --- Three.js objects (all owned here, all disposed here) ---
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

  useEffect(() => {
    if (!sceneHandle) return;
    const { scene, camera, canvas } = sceneHandle;
    const cam = new CameraController(camera, canvas);
    const onStart = () => setActivePreset(null);
    cam.controls.addEventListener("start", onStart);
    const lighting = buildLightingAndAtmosphere(scene, themeRef.current);
    scene.add(lighting.group);
    const layer = new TrainNodeLayer(scene, {
      theme: themeRef.current,
      colorblind: false,
      labelMode: "key",
      showQuotaJumps: true,
    });
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

  useEffect(() => {
    if (!sceneHandle) return;
    const cage = buildCoordinateCage(theme, bounds);
    sceneHandle.scene.add(cage);
    return () => disposeObject(cage);
  }, [sceneHandle, theme, bounds]);

  useEffect(() => {
    lightingRef.current?.updateTheme(theme);
  }, [theme, sceneHandle]);

  useEffect(() => {
    layerRef.current?.sync(allScored, bounds, {
      theme,
      colorblind,
      labelMode,
      showQuotaJumps: showQuotaVectors,
    });
  }, [sceneHandle, allScored, bounds, theme, colorblind, labelMode, showQuotaVectors]);

  useEffect(() => {
    layerRef.current?.setView({
      visibleIds,
      hoveredId,
      selectedId,
      planAId: planA?.id ?? null,
      backupBId: backupB?.id ?? null,
      focusMode,
      survivorIds,
    });
  }, [sceneHandle, visibleIds, hoveredId, selectedId, planA, backupB, focusMode, survivorIds]);

  useEffect(() => {
    cameraRef.current?.setAutoRotate(autoRotate && !selectedId);
  }, [autoRotate, selectedId, sceneHandle]);

  const handleAnimate = useCallback((delta: number) => {
    cameraRef.current?.update();
    layerRef.current?.update(delta);
  }, []);

  // --- Interaction ---
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
      const dir = cam.controls.object.position.clone().sub(cam.controls.target);
      if (dir.lengthSq() < 1e-6) dir.set(1, 0.7, 1);
      cam.flyTo(target.clone().add(dir.normalize().multiplyScalar(1.7)), target);
    },
    [allScored, request, toRequests]
  );

  const handleToggleFocusMode = useCallback(() => {
    setFocusMode((prev) => {
      const next = !prev;
      if (next) {
        // Collapse secondary drawers to eliminate cognitive load
        setShowWeights(false);
        setShowFilters(false);
        // Frame the centroid of the Survivor Triad
        const cam = cameraRef.current;
        const layer = layerRef.current;
        if (cam && layer && survivorTriad.length > 0) {
          const centroid = new THREE.Vector3();
          let count = 0;
          for (const s of survivorTriad) {
            const p = layer.worldPositionOf(s.id);
            if (p) {
              centroid.add(p);
              count++;
            }
          }
          if (count > 0) {
            centroid.divideScalar(count);
            cam.flyTo(centroid.clone().add(new THREE.Vector3(1.45, 0.95, 1.65)), centroid);
          }
        }
      } else {
        cameraRef.current?.preset("reset");
      }
      return next;
    });
  }, [survivorTriad]);

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    cameraRef.current?.preset("reset");
    setActivePreset("reset");
  }, []);

  const pickAt = useCallback(
    (clientX: number, clientY: number) => {
      const handle = sceneHandle;
      const layer = layerRef.current;
      if (!handle || !layer) return null;
      const rect = handle.canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      raycasterRef.current.setFromCamera(ndc, handle.camera);
      return layer.pickResult(raycasterRef.current);
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
    const res = pickAt(e.clientX, e.clientY);
    const id = res?.id ?? null;
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
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_SLOP_PX) return;
    const res = pickAt(e.clientX, e.clientY);
    if (res) {
      if (res.kind === "quotaJump") {
        toggleQuotaJumpFor(res.id);
      }
      flyToOption(res.id);
    } else if (selectedId) {
      clearSelection();
    }
  };

  const onViewportKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Escape") {
      if (selectedId) clearSelection();
      else if (focusMode) setFocusMode(false);
      return;
    }
    const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
    const backward = e.key === "ArrowLeft" || e.key === "ArrowUp";
    if (!forward && !backward) return;
    e.preventDefault();
    const list = focusMode ? survivorTriad : filteredScored;
    if (list.length === 0) return;
    const idx = list.findIndex((o) => o.id === selectedId);
    const next = idx === -1 ? 0 : (idx + (forward ? 1 : -1) + list.length) % list.length;
    flyToOption(list[next].id);
  };

  const onPreset = (preset: CameraPreset) => {
    setActivePreset(preset);
    cameraRef.current?.preset(preset);
  };

  const handlePromoteBackup = useCallback(
    (backupId: string) => {
      setPinnedPlanAId(backupId);
      if (planA) setPinnedBackupBId(planA.id);
      flyToOption(backupId);
    },
    [planA, flyToOption]
  );

  // --- Derived presentation ---
  const route = useMemo(() => {
    if (trains.length === 0) return "";
    const dests = [...new Set(trains.map((t) => t.toCode))];
    return `${trains[0].from} → ${dests.length === 1 ? trains[0].to : dests.join(" · ")}`;
  }, [trains]);
  const dateText = formatJourneyDate(journeyDate);
  const hoveredOption = hoveredId ? allScored.find((o) => o.id === hoveredId) ?? null : null;

  const showScene = viewTab !== "table";
  const hasData = options.length > 0;

  const controls = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <BestPickCard
        best={planA}
        backup={backupB}
        shouldPivot={shouldPivot}
        pivotReason={pivotReason}
        elapsedSec={elapsedSec}
        onBook={onBook}
        onSelect={flyToOption}
        onPromoteBackup={handlePromoteBackup}
        onToggleQuotaJump={toggleQuotaJumpFor}
      />
      {!focusMode && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="tv3d-btn"
            data-active={showWeights}
            aria-pressed={showWeights}
            onClick={() => setShowWeights((v) => !v)}
            style={{
              ...toggleBtn(showWeights),
              background: showWeights ? "var(--viz-accent)" : "var(--viz-panel)",
              color: showWeights ? "var(--viz-on-accent)" : "var(--viz-text)",
            }}
          >
            <Icon name="sliders" size={13} /> Weights
          </button>
          <button
            type="button"
            className="tv3d-btn"
            data-active={showFilters}
            aria-pressed={showFilters}
            onClick={() => setShowFilters((v) => !v)}
            style={{
              ...toggleBtn(showFilters),
              background: showFilters ? "var(--viz-accent)" : "var(--viz-panel)",
              color: showFilters ? "var(--viz-on-accent)" : "var(--viz-text)",
            }}
          >
            <Icon name="filter" size={13} /> Filters{filterOverride || intentFilter ? " •" : ""}
          </button>
        </div>
      )}
      {!focusMode && showWeights && <WeightSliderPanel weights={weights} onChange={setWeights} />}
      {!focusMode && showFilters && (
        <FilterToolbar
          filter={filter}
          bounds={bounds}
          availableClasses={availableClasses}
          isFiltered={filterOverride !== null || intentFilter !== null}
          onChange={setFilterOverride}
          onReset={() => {
            if (intentFilter) clearIntent();
            else setFilterOverride(null);
          }}
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
          backupOption={backupB}
          elapsedSec={elapsedSec}
          journeyDate={journeyDate}
          seatsPending={pending > 0}
          onClose={clearSelection}
          onBook={onBook}
          onRefreshSeats={refreshOne}
          onToggleQuotaJump={toggleQuotaJumpFor}
          onPinBackup={(id) => setPinnedBackupBId(id)}
        />
      )}
      {(viewTab !== "3d" || !selectedOption || isNarrow) && (viewTab !== "3d" || isNarrow) && (
        <Linked2DTable
          options={focusMode ? survivorTriad : filteredScored}
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
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          padding: "10px 20px",
          background: "var(--viz-panel-solid)",
          borderBottom: "1px solid var(--viz-line)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div
            aria-hidden="true"
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: "var(--viz-accent)",
              color: "var(--viz-on-accent)",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <Icon name="target" size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--viz-text)" }}>
              Tatkal Decision Landscape
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "var(--viz-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {route || "Choose a route"}
              {dateText ? ` · ${dateText}` : ""} · {filteredScored.length} of {options.length} options
              {elapsedSec > 0 ? ` · Projected @ T+${elapsedSec}s` : ""}
            </p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="View"
          style={{
            display: "flex",
            gap: 4,
            background: "var(--viz-inset)",
            padding: 3,
            borderRadius: 10,
            border: "1px solid var(--viz-line)",
          }}
        >
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
              <button
                key={p.id}
                type="button"
                className="tv3d-btn"
                data-active={activePreset === p.id}
                aria-pressed={activePreset === p.id}
                onClick={() => onPreset(p.id)}
                style={toggleBtn(activePreset === p.id)}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              className="tv3d-btn"
              data-active={autoRotate}
              aria-pressed={autoRotate}
              title="Auto-rotate the scene"
              onClick={() => setAutoRotate((v) => !v)}
              style={toggleBtn(autoRotate)}
            >
              <Icon name="rotate" size={13} /> Spin
            </button>
          </div>
        )}
      </header>

      <DataStatusBar
        counts={basisCounts}
        pending={pending}
        failed={failed}
        excluded={excluded}
        demoTimetable={demoTimetable}
        onRefresh={refreshTop}
      />

      {/* ── Express intent summary: what the prompt bar applied, with one-tap recovery if nothing matches ── */}
      {intentFilter && intentVisible && (
        <IntentStrip
          intent={intentFilter}
          filterChips={filterChips}
          matchCount={filteredScored.length}
          totalCount={allScored.length}
          relaxActions={relaxActions}
          onEditFilters={() => {
            setFocusMode(false);
            setShowFilters(true);
          }}
          onClear={clearIntent}
        />
      )}

      {/* ── Unified Temporal Scrubber + Quota-Jump + Rapid Focus Strip (2.1, 2.3, 2.4) ── */}
      <TemporalScrubberBar
        elapsedSec={elapsedSec}
        isPlaying={isPlaying}
        onSelectTime={(sec) => {
          setIsPlaying(false);
          setElapsedSec(sec);
        }}
        onTogglePlay={handleTogglePlay}
        highOddsCount={highOddsCount}
        totalVisible={filteredScored.length}
        quotaJumpCount={quotaEligibleIds.length}
        activeQuotaJumpCount={activeQuotaJumpCount}
        showQuotaVectors={showQuotaVectors}
        onToggleQuotaVectors={() => setShowQuotaVectors((v) => !v)}
        onToggleAllQuotaJumps={toggleAllQuotaJumps}
        focusMode={focusMode}
        onToggleFocusMode={handleToggleFocusMode}
      />

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
              <div
                style={{
                  position: "absolute",
                  top: 14,
                  left: 14,
                  width: 325,
                  maxWidth: "calc(100% - 28px)",
                  maxHeight: "calc(100% - 100px)",
                  overflowY: "auto",
                  zIndex: 5,
                }}
                className="tv3d-scroll"
              >
                {controls}
              </div>
            )}

            {/* ── 2.4: Rapid Focus Survivor Triad Bar (Top-Right when Focus Mode is active) ── */}
            {focusMode && survivorTriad.length > 0 && !isNarrow && (
              <div
                style={{
                  ...glassPanel,
                  position: "absolute",
                  top: 14,
                  right: 14,
                  width: 310,
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "1.5px solid var(--viz-accent)",
                  zIndex: 5,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "var(--viz-accent)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <Icon name="focus" size={12} /> RAPID FOCUS: TOP {survivorTriad.length} SURVIVORS
                  </span>
                  <button
                    type="button"
                    className="tv3d-btn"
                    onClick={() => setFocusMode(false)}
                    style={{ ...btnBase, minHeight: 20, padding: "1px 6px", fontSize: 10 }}
                  >
                    Exit
                  </button>
                </div>
                {survivorTriad.map((s, idx) => {
                  const roleTag = s.id === planA?.id ? "PLAN A" : s.id === backupB?.id ? "BACKUP B" : `#${idx + 1} PARETO`;
                  return (
                    <div
                      key={s.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "6px 8px",
                        borderRadius: 8,
                        background: "var(--viz-inset)",
                        border: "1px solid var(--viz-line)",
                        fontSize: 11.5,
                      }}
                    >
                      <div
                        onClick={() => flyToOption(s.id)}
                        style={{ cursor: "pointer", minWidth: 0 }}
                        title="Click to focus in 3D"
                      >
                        <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ fontSize: 9.5, fontWeight: 800, color: "var(--viz-accent)" }}>{roleTag}</span>
                          <span>
                            {s.trainNumber} · {s.travelClass}
                          </span>
                        </div>
                        <div style={{ fontSize: 10.5, color: "var(--viz-muted)", fontVariantNumeric: "tabular-nums" }}>
                          ₹{s.fare} · {s.tatkalSuccessChance}% odds · {s.duration.toFixed(1)}h
                        </div>
                      </div>
                      <button
                        type="button"
                        className="tv3d-btn"
                        data-active="true"
                        onClick={() => onBook(s, s.id === planA?.id ? backupB : planA)}
                        style={{ ...btnPrimary, width: "auto", minHeight: 26, padding: "4px 10px", fontSize: 11 }}
                      >
                        Book
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div
              style={{
                position: "absolute",
                bottom: 12,
                left: "50%",
                transform: "translateX(-50%)",
                width: "min(620px, calc(100% - 28px))",
                zIndex: 5,
              }}
            >
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
                  ...glassPanel,
                  position: "absolute",
                  pointerEvents: "none",
                  zIndex: 7,
                  padding: "9px 12px",
                  fontSize: 12,
                  width: 252,
                  borderRadius: 10,
                  left: Math.min((hoverPos?.x ?? 0) + 16, (viewportRef.current?.clientWidth ?? 800) - 268),
                  top: Math.min((hoverPos?.y ?? 0) + 16, (viewportRef.current?.clientHeight ?? 600) - 180),
                  background: "var(--viz-panel-solid)",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{hoveredOption.trainName}</div>
                <div style={{ color: "var(--viz-muted)", marginBottom: 6 }}>
                  {hoveredOption.trainNumber} · {hoveredOption.travelClass} · Rank #{hoveredOption.rank}
                  {hoveredOption.id === planA?.id ? " · Plan A" : hoveredOption.id === backupB?.id ? " · Backup B" : ""}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: "2px 10px",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <span style={{ color: "var(--viz-muted)" }}>Fare</span>
                  <strong>
                    {hoveredOption.fareBasis === "estimated" ? "≈" : ""}₹{hoveredOption.fare.toLocaleString("en-IN")}
                  </strong>
                  <span style={{ color: "var(--viz-muted)" }}>Time</span>
                  <strong>
                    {hoveredOption.departureTime} → {hoveredOption.arrivalTime} ({hoveredOption.duration.toFixed(1)}h)
                  </strong>
                  <span style={{ color: "var(--viz-muted)" }}>
                    Odds {elapsedSec > 0 ? `@ +${elapsedSec}s` : ""}
                  </span>
                  <strong>
                    {hoveredOption.tatkalSuccessChance}% (hold {hoveredOption.chanceAt60s ?? hoveredOption.tatkalSuccessChance}% @ +60s)
                  </strong>
                  <span style={{ color: "var(--viz-muted)" }}>Seats</span>
                  <strong>{hoveredOption.seatsHint ?? "—"}</strong>
                </div>
                {hoveredOption.quotaJump && !hoveredOption.quotaJumpActive && (
                  <div style={{ marginTop: 5, fontSize: 11, color: "var(--viz-good)", fontWeight: 700 }}>
                    ⚡ {hoveredOption.quotaJump.originCode} Quota-Jump: +{hoveredOption.quotaJump.successGain}% (+₹
                    {hoveredOption.quotaJump.fareDelta})
                  </div>
                )}
                <div style={{ marginTop: 6 }}>
                  <BasisBadge basis={hoveredOption.successBasis} />
                </div>
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
