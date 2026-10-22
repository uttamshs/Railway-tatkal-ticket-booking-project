import * as THREE from "three";
import { ScoredOption, FilterState } from "../lib/types";
import { CAGE_BOUNDS } from "./CoordinateCage";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Linear map from [srcMin, srcMax] to [dstMin, dstMax]. */
function mapRange(
  value: number,
  srcMin: number,
  srcMax: number,
  dstMin: number,
  dstMax: number
): number {
  if (srcMax === srcMin) return (dstMin + dstMax) / 2;
  return dstMin + ((value - srcMin) / (srcMax - srcMin)) * (dstMax - dstMin);
}

/** Score → THREE.Color using green→yellow→red gradient (standard). */
function scoreToColor(score: number, colorblindMode: boolean): THREE.Color {
  if (colorblindMode) {
    // Viridis approximation: purple → blue → teal → green → yellow
    const stops: [number, THREE.Color][] = [
      [0.0, new THREE.Color(0x440154)],
      [0.25, new THREE.Color(0x31688e)],
      [0.5, new THREE.Color(0x35b779)],
      [0.75, new THREE.Color(0x90d743)],
      [1.0, new THREE.Color(0xfde725)],
    ];
    for (let i = 0; i < stops.length - 1; i++) {
      const [t0, c0] = stops[i];
      const [t1, c1] = stops[i + 1];
      if (score <= t1) {
        const t = (score - t0) / (t1 - t0);
        return c0.clone().lerp(c1, t);
      }
    }
    return stops[stops.length - 1][1].clone();
  }

  // Green (good) → Yellow → Red (bad)
  const color = new THREE.Color();
  if (score >= 0.5) {
    // Green (1.0) to Yellow (0.5)
    const t = (score - 0.5) / 0.5;
    color.setRGB(1 - t, 1, 0);
  } else {
    // Yellow (0.5) to Red (0.0)
    const t = score / 0.5;
    color.setRGB(1, t, 0);
  }
  return color;
}

/** Creates a canvas sprite label for a train node. */
function makeNodeLabel(
  text: string,
  theme: "light" | "dark"
): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 40;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 128, 40);
  ctx.fillStyle = theme === "dark" ? "rgba(5,10,20,0.75)" : "rgba(240,246,255,0.85)";
  ctx.beginPath();
  ctx.roundRect(2, 2, 124, 36, 8);
  ctx.fill();
  ctx.fillStyle = theme === "dark" ? "#c8d8ff" : "#223355";
  ctx.font = "bold 18px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, 64, 27);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.35, 0.11, 1);
  return sprite;
}

/** Creates a rank badge sprite (#1, #2, #3). */
function makeRankBadge(rank: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;

  const colors = ["#ffd700", "#c0c0c0", "#cd7f32"];
  const bg = colors[rank - 1] ?? "#888";

  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.font = "bold 26px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`#${rank}`, 32, 33);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.15, 0.15, 1);
  return sprite;
}

// ─── Node data structure ──────────────────────────────────────────────────────

interface TrainNode {
  id: string;
  group: THREE.Group;
  sphere: THREE.Mesh;
  stem: THREE.Line;
  label: THREE.Sprite;
  paretoRing: THREE.Mesh | null;
  rankBadge: THREE.Sprite | null;
  baseColor: THREE.Color;
  worldPos: THREE.Vector3;
}

// Module-level state (reset on each createTrainNodes call)
let nodes: TrainNode[] = [];
let parentScene: THREE.Scene | null = null;
let rootGroup: THREE.Group | null = null;
let paretoAnimTime = 0;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates all train node markers and adds them to the scene.
 * Call once when scored options change (dispose first if re-calling).
 */
export function createTrainNodes(
  scene: THREE.Scene,
  scoredOptions: ScoredOption[],
  colorblindMode: boolean,
  theme: "light" | "dark" = "dark"
): void {
  disposeTrainNodes();
  parentScene = scene;
  rootGroup = new THREE.Group();
  rootGroup.name = "TrainNodes";
  nodes = [];

  for (const opt of scoredOptions) {
    const worldX = mapRange(
      opt.fare,
      CAGE_BOUNDS.fareMin,
      CAGE_BOUNDS.fareMax,
      CAGE_BOUNDS.worldMin,
      CAGE_BOUNDS.worldMax
    );
    const worldY = mapRange(
      opt.tatkalSuccessChance,
      CAGE_BOUNDS.successMin,
      CAGE_BOUNDS.successMax,
      CAGE_BOUNDS.worldMin,
      CAGE_BOUNDS.worldMax
    );
    const worldZ = mapRange(
      opt.duration,
      CAGE_BOUNDS.durationMin,
      CAGE_BOUNDS.durationMax,
      CAGE_BOUNDS.worldMin,
      CAGE_BOUNDS.worldMax
    );
    const worldPos = new THREE.Vector3(worldX, worldY, worldZ);

    const baseColor = scoreToColor(opt.compositeScore, colorblindMode);

    // Sphere radius scaled by composite score
    const radius = 0.04 + opt.compositeScore * 0.04;
    const sphereGeo = new THREE.SphereGeometry(radius, 16, 12);
    const sphereMat = new THREE.MeshPhongMaterial({
      color: baseColor,
      emissive: baseColor.clone().multiplyScalar(0.3),
      shininess: 60,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.position.copy(worldPos);
    sphere.userData.optionId = opt.id;

    // Vertical stem line from node to floor (Y = -1)
    const stemPts = [worldPos.clone(), new THREE.Vector3(worldX, -1, worldZ)];
    const stemGeo = new THREE.BufferGeometry().setFromPoints(stemPts);
    const stemMat = new THREE.LineBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity: 0.35,
    });
    const stem = new THREE.Line(stemGeo, stemMat);

    // Label sprite above sphere
    const label = makeNodeLabel(opt.id, theme);
    label.position.set(worldX, worldY + radius + 0.1, worldZ);

    // Pareto ring (torus)
    let paretoRing: THREE.Mesh | null = null;
    if (opt.paretoOptimal) {
      const torusGeo = new THREE.TorusGeometry(radius * 1.8, radius * 0.25, 8, 32);
      const torusMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      });
      paretoRing = new THREE.Mesh(torusGeo, torusMat);
      paretoRing.position.copy(worldPos);
      paretoRing.rotation.x = Math.PI / 2;
    }

    // Rank badge (#1, #2, #3)
    let rankBadge: THREE.Sprite | null = null;
    if (opt.rank <= 3) {
      rankBadge = makeRankBadge(opt.rank);
      rankBadge.position.set(worldX + radius + 0.08, worldY + radius + 0.08, worldZ);
    }

    const group = new THREE.Group();
    group.add(sphere, stem, label);
    if (paretoRing) group.add(paretoRing);
    if (rankBadge) group.add(rankBadge);

    rootGroup.add(group);

    nodes.push({
      id: opt.id,
      group,
      sphere,
      stem,
      label,
      paretoRing,
      rankBadge,
      baseColor,
      worldPos,
    });
  }

  scene.add(rootGroup);
}

/**
 * Updates node visibility, opacity, and scale based on filter state.
 * Does NOT rebuild geometry — just mutates materials.
 */
export function updateTrainNodes(
  scoredOptions: ScoredOption[],
  filterState: FilterState,
  colorblindMode: boolean
): void {
  const visibleIds = new Set(
    scoredOptions
      .filter((opt) => {
        if (filterState.classes.size > 0 && !filterState.classes.has(opt.travelClass))
          return false;
        if (opt.fare > filterState.maxFare) return false;
        if (opt.tatkalSuccessChance < filterState.minSuccessChance) return false;
        if (opt.duration > filterState.maxDuration) return false;
        return true;
      })
      .map((o) => o.id)
  );

  for (const node of nodes) {
    const visible = visibleIds.has(node.id);
    node.group.visible = visible;
    if (visible) {
      const opt = scoredOptions.find((o) => o.id === node.id);
      if (opt) {
        const newColor = scoreToColor(opt.compositeScore, colorblindMode);
        (node.sphere.material as THREE.MeshPhongMaterial).color.copy(newColor);
        (node.sphere.material as THREE.MeshPhongMaterial).emissive.copy(
          newColor.clone().multiplyScalar(0.3)
        );
      }
    }
  }
}

/**
 * Animates pareto rings (call each frame with elapsed time in seconds).
 */
export function animateTrainNodes(delta: number): void {
  paretoAnimTime += delta;
  for (const node of nodes) {
    if (node.paretoRing) {
      const pulse = 0.6 + 0.4 * Math.sin(paretoAnimTime * 2.5);
      (node.paretoRing.material as THREE.MeshBasicMaterial).opacity = pulse;
      const scale = 1 + 0.1 * Math.sin(paretoAnimTime * 2.5);
      node.paretoRing.scale.setScalar(scale);
    }
  }
}

/**
 * Disposes all geometries, materials, and sprites for train nodes.
 */
export function disposeTrainNodes(): void {
  if (!parentScene || !rootGroup) return;

  for (const node of nodes) {
    // Sphere
    (node.sphere.geometry as THREE.SphereGeometry).dispose();
    (node.sphere.material as THREE.Material).dispose();

    // Stem
    node.stem.geometry.dispose();
    (node.stem.material as THREE.Material).dispose();

    // Label
    const labelMat = node.label.material as THREE.SpriteMaterial;
    labelMat.map?.dispose();
    labelMat.dispose();

    // Pareto ring
    if (node.paretoRing) {
      node.paretoRing.geometry.dispose();
      (node.paretoRing.material as THREE.Material).dispose();
    }

    // Rank badge
    if (node.rankBadge) {
      const mat = node.rankBadge.material as THREE.SpriteMaterial;
      mat.map?.dispose();
      mat.dispose();
    }
  }

  parentScene.remove(rootGroup);
  nodes = [];
  rootGroup = null;
  parentScene = null;
}
