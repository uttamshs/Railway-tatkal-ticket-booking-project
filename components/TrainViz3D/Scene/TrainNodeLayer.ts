import * as THREE from "three";
import { ScoredOption } from "../lib/types";
import { VizBounds, optionToWorld, toWorld, WORLD_MIN } from "../lib/bounds";
import { PALETTES, VizTheme, scoreToHex } from "../lib/theme";
import { disposeSprite, makeTextSprite } from "./textSprite";

export type LabelMode = "key" | "all";

export interface NodeStyle {
  theme: VizTheme;
  colorblind: boolean;
  labelMode: LabelMode;
  showQuotaJumps: boolean;
}

export interface NodeViewState {
  /** Options passing the filters. Everything else is "ghosted" (faded, not removed). */
  visibleIds: Set<string>;
  hoveredId: string | null;
  selectedId: string | null;
  /** Plan A and Backup B option IDs for the live 3D tether arc (Feature 2.2). */
  planAId: string | null;
  backupBId: string | null;
  /** Rapid Focus / Panic Mode (Feature 2.4): isolates Survivor Triad. */
  focusMode: boolean;
  survivorIds: Set<string>;
}

export type PickResult =
  | { kind: "option"; id: string }
  | { kind: "quotaJump"; id: string }
  | null;

/** Half-height (in success-%) of the uncertainty whisker per data basis. */
const UNCERTAINTY_PCT = { live: 6, baseline: 15, estimate: 25 } as const;
/** Base opacity: estimate-only markers are drawn lighter so they never read as hard facts. */
const BASE_OPACITY = { live: 1, baseline: 0.82, estimate: 0.68 } as const;

const GHOST_OPACITY = 0.1;
const FOCUS_GHOST_OPACITY = 0.04;
const DIM_OPACITY = 0.3;
const TETHER_SEGMENTS = 28;
const QUOTA_ARC_SEGMENTS = 20;

interface Node {
  id: string;
  option: ScoredOption;
  group: THREE.Group;
  sphereMat: THREE.MeshPhongMaterial;
  sphere: THREE.Mesh;
  hit: THREE.Mesh;
  stem: THREE.Line;
  stemMat: THREE.LineBasicMaterial;
  whisker: THREE.LineSegments;
  whiskerMat: THREE.LineBasicMaterial;
  /** Feature 2.1: downward 60s depletion velocity vector below the sphere. */
  velocityTail: THREE.LineSegments;
  velocityTailMat: THREE.LineBasicMaterial;
  label: THREE.Sprite;
  labelKey: string;
  ring: THREE.Mesh | null;
  ringMat: THREE.MeshBasicMaterial | null;
  badge: THREE.Sprite | null;
  badgeKey: string;
  /** Feature 2.3: rising Quota-Jump vector arc + diamond satellite in node-local space. */
  quotaGroup: THREE.Group | null;
  quotaArc: THREE.Line | null;
  quotaArcMat: THREE.LineBasicMaterial | null;
  quotaSat: THREE.Mesh | null;
  quotaSatMat: THREE.MeshPhongMaterial | null;
  quotaHit: THREE.Mesh | null;
  quotaLabel: THREE.Sprite | null;
  quotaKey: string;
  targetPos: THREE.Vector3;
  radius: number;
  scale: number;
  opacity: number;
}

/**
 * Owns every train marker in the scene: creation, in-place updates (markers glide
 * when data or time-scrubber changes), 60s velocity drop-tails (2.1), Plan A -> Backup B
 * 3D tether arc (2.2), Quota-Jump vector arcs & diamond satellites (2.3), Rapid Focus
 * triad isolation (2.4), picking, and disposal.
 */
export class TrainNodeLayer {
  private readonly root = new THREE.Group();
  private nodes = new Map<string, Node>();
  private bounds: VizBounds | null = null;
  private style: NodeStyle;
  private view: NodeViewState = {
    visibleIds: new Set(),
    hoveredId: null,
    selectedId: null,
    planAId: null,
    backupBId: null,
    focusMode: false,
    survivorIds: new Set(),
  };
  private time = 0;

  // Shared geometries & materials
  private readonly sphereGeo = new THREE.SphereGeometry(1, 20, 14);
  private readonly octaGeo = new THREE.OctahedronGeometry(1, 0);
  private readonly hitGeo = new THREE.SphereGeometry(1, 8, 6);
  private readonly hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  private readonly ringGeo = new THREE.TorusGeometry(1, 0.13, 8, 44);
  private readonly stemGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -1, 0),
  ]);
  /** Vertical whisker from y=0 to y=1 with small end caps. */
  private readonly whiskerGeo = new THREE.BufferGeometry().setFromPoints(
    [
      [0, 0, 0], [0, 1, 0],
      [-0.025, 0, 0], [0.025, 0, 0],
      [-0.025, 1, 0], [0.025, 1, 0],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z))
  );
  /** Downward velocity tail from y=0 to y=-1 with an arrowhead chevron at y=-1. */
  private readonly velocityTailGeo = new THREE.BufferGeometry().setFromPoints(
    [
      [0, 0, 0], [0, -1, 0],
      [-0.028, -0.86, 0], [0, -1, 0],
      [0.028, -0.86, 0], [0, -1, 0],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z))
  );

  private readonly badgeTextures = new Map<string, THREE.CanvasTexture>();
  private readonly selection: THREE.Mesh;
  private readonly selectionMat: THREE.MeshBasicMaterial;

  /** Feature 2.2: 3D Tether Arc connecting Plan A and Backup B. */
  private readonly tetherGeo: THREE.BufferGeometry;
  private readonly tetherPositions: Float32Array;
  private readonly tetherLine: THREE.Line;
  private readonly tetherMat: THREE.LineBasicMaterial;
  private readonly tetherPulse: THREE.Mesh;
  private readonly tetherPulseMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene, style: NodeStyle) {
    this.style = style;
    this.root.name = "TrainNodes";
    this.selectionMat = new THREE.MeshBasicMaterial({
      color: PALETTES[style.theme].selectionRing,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    this.selection = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 8, 48), this.selectionMat);
    this.selection.rotation.x = Math.PI / 2;
    this.selection.visible = false;
    this.root.add(this.selection);

    // Build Plan A -> Backup B 3D Tether Arc + traveling pulse orb
    this.tetherPositions = new Float32Array((TETHER_SEGMENTS + 1) * 3);
    this.tetherGeo = new THREE.BufferGeometry();
    this.tetherGeo.setAttribute("position", new THREE.BufferAttribute(this.tetherPositions, 3));
    this.tetherMat = new THREE.LineBasicMaterial({
      color: style.theme === "dark" ? 0x38bdf8 : 0x0284c7,
      transparent: true,
      opacity: 0.85,
    });
    this.tetherLine = new THREE.Line(this.tetherGeo, this.tetherMat);
    this.tetherLine.visible = false;
    this.root.add(this.tetherLine);

    this.tetherPulseMat = new THREE.MeshBasicMaterial({
      color: style.theme === "dark" ? 0x8ee3bd : 0x0284c7,
      transparent: true,
      opacity: 0.95,
    });
    this.tetherPulse = new THREE.Mesh(this.sphereGeo, this.tetherPulseMat);
    this.tetherPulse.scale.setScalar(0.026);
    this.tetherPulse.visible = false;
    this.root.add(this.tetherPulse);

    scene.add(this.root);
  }

  // ─── Data sync ────────────────────────────────────────────────────────────

  /** Reconciles markers with `options` (adds, removes and updates in place). */
  sync(options: ScoredOption[], bounds: VizBounds, style: NodeStyle): void {
    const themeChanged = style.theme !== this.style.theme;
    this.style = style;
    this.bounds = bounds;
    this.selectionMat.color.setHex(PALETTES[style.theme].selectionRing);
    this.tetherMat.color.setHex(style.theme === "dark" ? 0x38bdf8 : 0x0284c7);
    this.tetherPulseMat.color.setHex(style.theme === "dark" ? 0x8ee3bd : 0x0284c7);

    const seen = new Set<string>();
    for (const opt of options) {
      seen.add(opt.id);
      const existing = this.nodes.get(opt.id);
      if (existing) this.updateNode(existing, opt, themeChanged);
      else this.nodes.set(opt.id, this.createNode(opt));
    }
    for (const [id, node] of this.nodes) {
      if (!seen.has(id)) {
        this.disposeNode(node);
        this.nodes.delete(id);
      }
    }
  }

  setView(view: NodeViewState): void {
    this.view = view;
  }

  // ─── Node construction ────────────────────────────────────────────────────

  private colorFor(opt: ScoredOption): THREE.Color {
    return new THREE.Color(scoreToHex(opt.compositeScore, this.style.colorblind, this.style.theme));
  }

  private labelTextFor(opt: ScoredOption): string {
    const jumpTag = opt.quotaJumpActive && opt.quotaJump ? ` ⚡${opt.quotaJump.originCode}` : "";
    return `${opt.trainNumber} · ${opt.travelClass}${jumpTag}`;
  }

  private makeLabel(text: string): THREE.Sprite {
    const p = PALETTES[this.style.theme];
    return makeTextSprite(text, {
      fontPx: 22,
      color: p.labelText,
      background: p.labelBg,
      worldHeight: 0.082,
      onTop: true,
    });
  }

  private badgeTexture(key: string): THREE.CanvasTexture {
    let tex = this.badgeTextures.get(key);
    if (!tex) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 128;
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      const isBackup = key === "B";
      const rank = parseInt(key, 10);
      const fills = ["#ffd54a", "#dfe5ec", "#e0a066"];
      ctx.beginPath();
      ctx.arc(64, 64, 58, 0, Math.PI * 2);
      ctx.fillStyle = isBackup ? "#38bdf8" : (fills[rank - 1] ?? "#999");
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(15,23,42,0.85)";
      ctx.stroke();
      ctx.fillStyle = "#0f172a";
      ctx.font = "800 50px Inter, ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(isBackup ? "B" : `#${rank}`, 64, 68);
      tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.badgeTextures.set(key, tex);
    }
    return tex;
  }

  private createNode(opt: ScoredOption): Node {
    const bounds = this.bounds as VizBounds;
    const [x, y, z] = optionToWorld(opt, bounds);
    const color = this.colorFor(opt);
    const p = PALETTES[this.style.theme];

    const group = new THREE.Group();
    group.position.set(x, y, z);

    const sphereMat = new THREE.MeshPhongMaterial({
      color,
      emissive: color.clone().multiplyScalar(p.emissiveMix),
      shininess: 60,
      transparent: true,
    });
    const sphere = new THREE.Mesh(this.sphereGeo, sphereMat);
    const hit = new THREE.Mesh(this.hitGeo, this.hitMat);
    hit.userData.optionId = opt.id;

    const stemMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.4 });
    const stem = new THREE.Line(this.stemGeo, stemMat);

    const whiskerMat = new THREE.LineBasicMaterial({ color: new THREE.Color(p.labelText), transparent: true, opacity: 0.55 });
    const whisker = new THREE.LineSegments(this.whiskerGeo, whiskerMat);

    const velocityTailMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.85 });
    const velocityTail = new THREE.LineSegments(this.velocityTailGeo, velocityTailMat);
    velocityTail.visible = false;

    const labelKey = this.labelTextFor(opt);
    const label = this.makeLabel(labelKey);

    group.add(stem, whisker, velocityTail, sphere, hit, label);
    this.root.add(group);

    const node: Node = {
      id: opt.id,
      option: opt,
      group,
      sphereMat,
      sphere,
      hit,
      stem,
      stemMat,
      whisker,
      whiskerMat,
      velocityTail,
      velocityTailMat,
      label,
      labelKey,
      ring: null,
      ringMat: null,
      badge: null,
      badgeKey: "",
      quotaGroup: null,
      quotaArc: null,
      quotaArcMat: null,
      quotaSat: null,
      quotaSatMat: null,
      quotaHit: null,
      quotaLabel: null,
      quotaKey: "",
      targetPos: new THREE.Vector3(x, y, z),
      radius: 0.05,
      scale: 1,
      opacity: 0,
    };
    this.applyOptionGeometry(node, opt, true);
    return node;
  }

  /** Radius, stem, whisker, velocity tail, ring, badge, and quota-jump vector. */
  private applyOptionGeometry(node: Node, opt: ScoredOption, snap: boolean): void {
    const bounds = this.bounds as VizBounds;
    const [x, y, z] = optionToWorld(opt, bounds);
    node.targetPos.set(x, y, z);
    if (snap) node.group.position.copy(node.targetPos);

    node.radius = 0.042 + opt.compositeScore * 0.04;
    node.hit.scale.setScalar(Math.max(node.radius * 2.4, 0.1));
    node.label.position.set(0, node.radius + 0.12, 0);

    // 1. Whisker spans the uncertainty band around the success %, relative to the node.
    const u = UNCERTAINTY_PCT[opt.successBasis];
    const lo = Math.max(0, opt.tatkalSuccessChance - u);
    const hi = Math.min(100, opt.tatkalSuccessChance + u);
    const loWorld = toWorld(lo, bounds.successMin, bounds.successMax);
    const hiWorld = toWorld(hi, bounds.successMin, bounds.successMax);
    node.whisker.position.set(0, loWorld - y, 0);
    node.whisker.scale.set(1, Math.max(0.001, hiWorld - loWorld), 1);

    // 2. Feature 2.1: 60s Velocity Drop-Tail
    const drop = opt.velocityDrop60s ?? 0;
    if (drop >= 4) {
      const chance60 = Math.max(0, opt.tatkalSuccessChance - drop);
      const y60 = toWorld(chance60, bounds.successMin, bounds.successMax);
      const tailLen = Math.max(0.02, y - y60);
      node.velocityTail.position.set(0, -node.radius * 0.6, 0);
      node.velocityTail.scale.set(1, tailLen, 1);
      node.velocityTailMat.color.setHex(drop >= 14 ? 0xef4444 : 0xf59e0b);
      node.velocityTail.visible = true;
    } else {
      node.velocityTail.visible = false;
    }

    // 3. Pareto ring
    if (opt.paretoOptimal && !node.ring) {
      node.ringMat = new THREE.MeshBasicMaterial({
        color: PALETTES[this.style.theme].paretoRing,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
      });
      node.ring = new THREE.Mesh(this.ringGeo, node.ringMat);
      node.ring.rotation.x = Math.PI / 2;
      node.group.add(node.ring);
    } else if (!opt.paretoOptimal && node.ring) {
      node.group.remove(node.ring);
      node.ringMat?.dispose();
      node.ring = null;
      node.ringMat = null;
    }

    // 4. Feature 2.3: Rising 3D Quota-Jump Vector Arc & Pickable Diamond Satellite
    const qj = opt.quotaJump;
    const showQj = Boolean(this.style.showQuotaJumps && qj && qj.successGain >= 6 && !opt.quotaJumpActive);
    if (showQj && qj) {
      const jumpX = Math.min(1.05, toWorld(qj.fareWithJump, bounds.fareMin, bounds.fareMax));
      const jumpY = Math.min(1.0, toWorld(qj.originSuccessChance, bounds.successMin, bounds.successMax));
      const dx = jumpX - x;
      const dy = jumpY - y;
      const nextKey = `${dx.toFixed(3)}|${dy.toFixed(3)}|${qj.originCode}|${qj.successGain}|${this.style.theme}`;

      if (!node.quotaGroup) {
        node.quotaGroup = new THREE.Group();
        node.group.add(node.quotaGroup);
      }

      if (node.quotaKey !== nextKey) {
        this.clearQuotaChildren(node);
        node.quotaKey = nextKey;

        // Rising quadratic Bezier curve from (0,0,0) to (dx, dy, 0)
        const ctrl = new THREE.Vector3(dx * 0.35, dy * 0.78 + 0.08, 0.04);
        const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), ctrl, new THREE.Vector3(dx, dy, 0));
        const arcGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(QUOTA_ARC_SEGMENTS));
        const accentHex = this.style.theme === "dark" ? 0x34d399 : 0x059669;
        node.quotaArcMat = new THREE.LineBasicMaterial({ color: accentHex, transparent: true, opacity: 0.85 });
        node.quotaArc = new THREE.Line(arcGeo, node.quotaArcMat);

        node.quotaSatMat = new THREE.MeshPhongMaterial({
          color: accentHex,
          emissive: new THREE.Color(accentHex).multiplyScalar(0.35),
          shininess: 80,
          transparent: true,
          opacity: 0.95,
        });
        node.quotaSat = new THREE.Mesh(this.octaGeo, node.quotaSatMat);
        node.quotaSat.position.set(dx, dy, 0);
        node.quotaSat.scale.setScalar(0.036);

        node.quotaHit = new THREE.Mesh(this.hitGeo, this.hitMat);
        node.quotaHit.position.set(dx, dy, 0);
        node.quotaHit.scale.setScalar(0.095);
        node.quotaHit.userData.quotaOptionId = opt.id;

        const p = PALETTES[this.style.theme];
        node.quotaLabel = makeTextSprite(`⚡ ${qj.originCode} +${qj.successGain}%`, {
          fontPx: 20,
          color: this.style.theme === "dark" ? "#8ee3bd" : "#047857",
          background: p.labelBg,
          worldHeight: 0.068,
          onTop: true,
        });
        node.quotaLabel.position.set(dx, dy + 0.085, 0);

        node.quotaGroup.add(node.quotaArc, node.quotaSat, node.quotaHit, node.quotaLabel);
      }
      node.quotaGroup.visible = true;
    } else if (node.quotaGroup) {
      node.quotaGroup.visible = false;
    }
  }

  private clearQuotaChildren(node: Node): void {
    if (!node.quotaGroup) return;
    if (node.quotaArc) {
      node.quotaArc.geometry.dispose();
      node.quotaArcMat?.dispose();
      node.quotaGroup.remove(node.quotaArc);
      node.quotaArc = null;
      node.quotaArcMat = null;
    }
    if (node.quotaSat) {
      node.quotaSatMat?.dispose();
      node.quotaGroup.remove(node.quotaSat);
      node.quotaSat = null;
      node.quotaSatMat = null;
    }
    if (node.quotaHit) {
      node.quotaGroup.remove(node.quotaHit);
      node.quotaHit = null;
    }
    if (node.quotaLabel) {
      disposeSprite(node.quotaLabel);
      node.quotaGroup.remove(node.quotaLabel);
      node.quotaLabel = null;
    }
  }

  private syncBadge(node: Node, desiredKey: string): void {
    if (node.badgeKey === desiredKey) {
      if (node.badge) node.badge.position.set(node.radius + 0.1, node.radius + 0.1, 0);
      return;
    }
    node.badgeKey = desiredKey;
    if (node.badge) {
      node.group.remove(node.badge);
      disposeBadge(node.badge);
      node.badge = null;
    }
    if (desiredKey) {
      node.badge = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.badgeTexture(desiredKey),
          transparent: true,
          depthWrite: false,
          depthTest: false,
        })
      );
      node.badge.renderOrder = 11;
      node.badge.scale.set(0.15, 0.15, 1);
      node.badge.position.set(node.radius + 0.1, node.radius + 0.1, 0);
      node.group.add(node.badge);
    }
  }

  private updateNode(node: Node, opt: ScoredOption, themeChanged: boolean): void {
    node.option = opt;
    const color = this.colorFor(opt);
    const p = PALETTES[this.style.theme];
    node.sphereMat.color.copy(color);
    node.sphereMat.emissive.copy(color).multiplyScalar(p.emissiveMix);
    node.stemMat.color.copy(color);
    this.applyOptionGeometry(node, opt, false);

    const nextLabelKey = this.labelTextFor(opt);
    if (themeChanged || nextLabelKey !== node.labelKey) {
      node.labelKey = nextLabelKey;
      node.group.remove(node.label);
      disposeSprite(node.label);
      node.label = this.makeLabel(nextLabelKey);
      node.group.add(node.label);
      node.label.position.set(0, node.radius + 0.12, 0);
    }
    if (themeChanged) {
      node.whiskerMat.color.set(p.labelText);
      node.ringMat?.color.setHex(p.paretoRing);
    }
  }

  // ─── Per-frame update ─────────────────────────────────────────────────────

  update(delta: number): void {
    this.time += delta;
    const k = 1 - Math.exp(-delta * 9); // frame-rate independent smoothing
    const { visibleIds, hoveredId, selectedId, planAId, backupBId, focusMode, survivorIds } = this.view;
    const focusId = hoveredId ?? selectedId;
    const pulse = Math.sin(this.time * 2.5);

    for (const node of this.nodes.values()) {
      const passesFilter = visibleIds.has(node.id);
      const isSurvivor = !focusMode || survivorIds.has(node.id);
      const ghost = !passesFilter || !isSurvivor;
      const isSel = node.id === selectedId;
      const isHover = node.id === hoveredId;
      const isPlanA = node.id === planAId;
      const isBackupB = node.id === backupBId;
      const basis = node.option.successBasis;

      // Sync badge: #1-#3 or "B" for Backup B
      const desiredBadge =
        node.option.rank <= 3 ? String(node.option.rank) : isBackupB ? "B" : "";
      this.syncBadge(node, desiredBadge);

      const targetScale = isSel ? 1.55 : isHover ? 1.35 : focusMode && isSurvivor ? 1.22 : 1;
      node.scale += (targetScale - node.scale) * k;

      let targetOpacity: number = BASE_OPACITY[basis];
      if (!passesFilter) targetOpacity = GHOST_OPACITY;
      else if (focusMode && !isSurvivor) targetOpacity = FOCUS_GHOST_OPACITY;
      else if (focusId && node.id !== focusId && !isPlanA && !isBackupB) {
        targetOpacity = Math.min(targetOpacity, DIM_OPACITY);
      }
      node.opacity += (targetOpacity - node.opacity) * k;

      node.group.position.lerp(node.targetPos, k);
      node.sphere.scale.setScalar(node.radius * node.scale);

      node.stem.scale.y = Math.max(node.group.position.y - WORLD_MIN, 0.001);

      node.sphereMat.opacity = node.opacity;
      node.stemMat.opacity = node.opacity * 0.4;
      node.whiskerMat.opacity = node.opacity * 0.55;
      node.velocityTailMat.opacity = node.opacity * 0.85;

      const showLabel =
        !ghost &&
        (this.style.labelMode === "all" ||
          focusMode ||
          node.option.rank <= 3 ||
          isPlanA ||
          isBackupB ||
          node.option.paretoOptimal ||
          isHover ||
          isSel);
      const labelMat = node.label.material as THREE.SpriteMaterial;
      labelMat.opacity += ((showLabel ? Math.min(1, node.opacity + 0.2) : 0) - labelMat.opacity) * k;
      node.label.visible = labelMat.opacity > 0.02;

      if (node.ring && node.ringMat) {
        node.ring.scale.setScalar(node.radius * node.scale * (1.9 + 0.12 * pulse));
        node.ringMat.opacity = node.opacity * (0.65 + 0.25 * pulse);
      }
      if (node.badge) {
        const mat = node.badge.material as THREE.SpriteMaterial;
        mat.opacity = ghost ? 0 : Math.min(1, node.opacity + 0.15);
        node.badge.visible = !ghost;
      }

      // Update Quota-Jump satellite animation & visibility
      if (node.quotaGroup && node.quotaGroup.visible) {
        const qOpacity = ghost ? 0.04 : node.opacity;
        if (node.quotaArcMat) node.quotaArcMat.opacity = qOpacity * 0.82;
        if (node.quotaSatMat) node.quotaSatMat.opacity = qOpacity * 0.95;
        if (node.quotaSat) {
          node.quotaSat.rotation.y = this.time * 1.6;
          node.quotaSat.scale.setScalar(0.036 * (isHover || isSel ? 1.3 : 1 + 0.08 * pulse));
        }
        if (node.quotaLabel) {
          const showQLabel = !ghost && (isHover || isSel || isPlanA || isBackupB || focusMode || node.option.rank <= 2);
          const qMat = node.quotaLabel.material as THREE.SpriteMaterial;
          qMat.opacity = showQLabel ? Math.min(1, qOpacity + 0.15) : 0;
          node.quotaLabel.visible = showQLabel;
        }
      }
    }

    // Update Feature 2.2: 3D Plan A -> Backup B Tether Arc
    const nodeA = planAId ? this.nodes.get(planAId) : undefined;
    const nodeB = backupBId ? this.nodes.get(backupBId) : undefined;
    if (nodeA && nodeB && nodeA.id !== nodeB.id && visibleIds.has(nodeA.id) && visibleIds.has(nodeB.id)) {
      const pA = nodeA.group.position;
      const pB = nodeB.group.position;
      const mid = new THREE.Vector3(
        (pA.x + pB.x) * 0.5,
        Math.min(1.12, Math.max(pA.y, pB.y) + 0.22),
        (pA.z + pB.z) * 0.5
      );
      for (let i = 0; i <= TETHER_SEGMENTS; i++) {
        const t = i / TETHER_SEGMENTS;
        const inv = 1 - t;
        const x = inv * inv * pA.x + 2 * inv * t * mid.x + t * t * pB.x;
        const y = inv * inv * pA.y + 2 * inv * t * mid.y + t * t * pB.y;
        const z = inv * inv * pA.z + 2 * inv * t * mid.z + t * t * pB.z;
        this.tetherPositions[i * 3] = x;
        this.tetherPositions[i * 3 + 1] = y;
        this.tetherPositions[i * 3 + 2] = z;
      }
      this.tetherGeo.attributes.position.needsUpdate = true;
      this.tetherLine.visible = true;

      // Traveling pulse along the tether from Plan A -> Backup B
      const tPulse = (this.time * 0.45) % 1;
      const invP = 1 - tPulse;
      this.tetherPulse.position.set(
        invP * invP * pA.x + 2 * invP * tPulse * mid.x + tPulse * tPulse * pB.x,
        invP * invP * pA.y + 2 * invP * tPulse * mid.y + tPulse * tPulse * pB.y,
        invP * invP * pA.z + 2 * invP * tPulse * mid.z + tPulse * tPulse * pB.z
      );
      this.tetherPulse.visible = true;
    } else {
      this.tetherLine.visible = false;
      this.tetherPulse.visible = false;
    }

    const sel = selectedId ? this.nodes.get(selectedId) : undefined;
    this.selection.visible = !!sel;
    if (sel) {
      this.selection.position.copy(sel.group.position);
      this.selection.scale.setScalar(sel.radius * sel.scale * 2.5);
      this.selection.rotation.z = this.time * 1.2;
    }
  }

  // ─── Picking & queries ────────────────────────────────────────────────────

  /** Returns the nearest interactive marker or Quota-Jump diamond under the ray. */
  pickResult(raycaster: THREE.Raycaster): PickResult {
    const targets: THREE.Object3D[] = [];
    for (const node of this.nodes.values()) {
      const activeInFocus = !this.view.focusMode || this.view.survivorIds.has(node.id);
      if (this.view.visibleIds.has(node.id) && activeInFocus) {
        targets.push(node.hit);
        if (node.quotaGroup?.visible && node.quotaHit) {
          targets.push(node.quotaHit);
        }
      }
    }
    const hit = raycaster.intersectObjects(targets, false)[0];
    if (!hit) return null;
    if (hit.object.userData.quotaOptionId) {
      return { kind: "quotaJump", id: hit.object.userData.quotaOptionId as string };
    }
    return hit.object.userData.optionId
      ? { kind: "option", id: hit.object.userData.optionId as string }
      : null;
  }

  pick(raycaster: THREE.Raycaster): string | null {
    const res = this.pickResult(raycaster);
    return res ? res.id : null;
  }

  worldPositionOf(id: string): THREE.Vector3 | null {
    const node = this.nodes.get(id);
    return node ? node.targetPos.clone() : null;
  }

  // ─── Disposal ─────────────────────────────────────────────────────────────

  private disposeNode(node: Node): void {
    node.sphereMat.dispose();
    node.stemMat.dispose();
    node.whiskerMat.dispose();
    node.velocityTailMat.dispose();
    node.ringMat?.dispose();
    disposeSprite(node.label);
    if (node.badge) disposeBadge(node.badge);
    this.clearQuotaChildren(node);
    this.root.remove(node.group);
  }

  dispose(): void {
    for (const node of this.nodes.values()) this.disposeNode(node);
    this.nodes.clear();
    this.sphereGeo.dispose();
    this.octaGeo.dispose();
    this.hitGeo.dispose();
    this.hitMat.dispose();
    this.ringGeo.dispose();
    this.stemGeo.dispose();
    this.whiskerGeo.dispose();
    this.velocityTailGeo.dispose();
    this.tetherGeo.dispose();
    this.tetherMat.dispose();
    this.tetherPulseMat.dispose();
    this.selection.geometry.dispose();
    this.selectionMat.dispose();
    this.badgeTextures.forEach((t) => t.dispose());
    this.badgeTextures.clear();
    this.root.removeFromParent();
  }
}

/** Badge sprites share cached textures, so only the material is released. */
function disposeBadge(badge: THREE.Sprite): void {
  (badge.material as THREE.SpriteMaterial).dispose();
}
