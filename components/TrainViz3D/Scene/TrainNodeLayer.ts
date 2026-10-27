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
}

export interface NodeViewState {
  /** Options passing the filters. Everything else is "ghosted" (faded, not removed). */
  visibleIds: Set<string>;
  hoveredId: string | null;
  selectedId: string | null;
}

/** Half-height (in success-%) of the uncertainty whisker per data basis. */
const UNCERTAINTY_PCT = { live: 6, baseline: 15, estimate: 25 } as const;
/** Base opacity: estimate-only markers are drawn lighter so they never read as hard facts. */
const BASE_OPACITY = { live: 1, baseline: 0.82, estimate: 0.68 } as const;

const GHOST_OPACITY = 0.1;
const DIM_OPACITY = 0.3;

interface Node {
  id: string;
  option: ScoredOption;
  group: THREE.Group;
  sphereMat: THREE.MeshPhongMaterial;
  sphere: THREE.Mesh;
  hit: THREE.Mesh;
  stem: THREE.Line;
  stemMat: THREE.LineBasicMaterial;
  whisker: THREE.Line;
  whiskerMat: THREE.LineBasicMaterial;
  label: THREE.Sprite;
  ring: THREE.Mesh | null;
  ringMat: THREE.MeshBasicMaterial | null;
  badge: THREE.Sprite | null;
  targetPos: THREE.Vector3;
  radius: number;
  scale: number;
  opacity: number;
}

/**
 * Owns every train marker in the scene: creation, in-place updates (markers glide
 * when data changes), hover/selection/ghost states, picking and disposal.
 * Geometries shared by all markers are created once per layer.
 */
export class TrainNodeLayer {
  private readonly root = new THREE.Group();
  private nodes = new Map<string, Node>();
  private bounds: VizBounds | null = null;
  private style: NodeStyle;
  private view: NodeViewState = { visibleIds: new Set(), hoveredId: null, selectedId: null };
  private time = 0;

  // Shared resources
  private readonly sphereGeo = new THREE.SphereGeometry(1, 20, 14);
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
  private readonly badgeTextures = new Map<number, THREE.CanvasTexture>();
  private readonly selection: THREE.Mesh;
  private readonly selectionMat: THREE.MeshBasicMaterial;

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
    scene.add(this.root);
  }

  // ─── Data sync ────────────────────────────────────────────────────────────

  /** Reconciles markers with `options` (adds, removes and updates in place). */
  sync(options: ScoredOption[], bounds: VizBounds, style: NodeStyle): void {
    const themeChanged = style.theme !== this.style.theme;
    this.style = style;
    this.bounds = bounds;
    this.selectionMat.color.setHex(PALETTES[style.theme].selectionRing);

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

  private makeLabel(opt: ScoredOption): THREE.Sprite {
    const p = PALETTES[this.style.theme];
    return makeTextSprite(`${opt.trainNumber} · ${opt.travelClass}`, {
      fontPx: 22,
      color: p.labelText,
      background: p.labelBg,
      worldHeight: 0.082,
      onTop: true,
    });
  }

  private badgeTexture(rank: number): THREE.CanvasTexture {
    let tex = this.badgeTextures.get(rank);
    if (!tex) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 128;
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      const fills = ["#ffd54a", "#dfe5ec", "#e0a066"];
      ctx.beginPath();
      ctx.arc(64, 64, 58, 0, Math.PI * 2);
      ctx.fillStyle = fills[rank - 1] ?? "#999";
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(15,23,42,0.85)";
      ctx.stroke();
      ctx.fillStyle = "#0f172a";
      ctx.font = "800 54px Inter, ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`#${rank}`, 64, 68);
      tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.badgeTextures.set(rank, tex);
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
    const whisker = new THREE.Line(this.whiskerGeo, whiskerMat);

    const label = this.makeLabel(opt);

    group.add(stem, whisker, sphere, hit, label);
    this.root.add(group);

    const node: Node = {
      id: opt.id, option: opt, group, sphereMat, sphere, hit, stem, stemMat, whisker, whiskerMat, label,
      ring: null, ringMat: null, badge: null,
      targetPos: new THREE.Vector3(x, y, z), radius: 0.05, scale: 1, opacity: 0,
    };
    this.applyOptionGeometry(node, opt, true);
    return node;
  }

  /** Radius, stem, whisker, ring and badge — everything derived from the option's numbers. */
  private applyOptionGeometry(node: Node, opt: ScoredOption, snap: boolean): void {
    const bounds = this.bounds as VizBounds;
    const [x, y, z] = optionToWorld(opt, bounds);
    node.targetPos.set(x, y, z);
    if (snap) node.group.position.copy(node.targetPos);

    node.radius = 0.042 + opt.compositeScore * 0.04;
    node.hit.scale.setScalar(Math.max(node.radius * 2.4, 0.1));
    node.label.position.set(0, node.radius + 0.12, 0);

    // Whisker spans the uncertainty band around the success %, relative to the node.
    const u = UNCERTAINTY_PCT[opt.successBasis];
    const lo = Math.max(0, opt.tatkalSuccessChance - u);
    const hi = Math.min(100, opt.tatkalSuccessChance + u);
    const loWorld = toWorld(lo, bounds.successMin, bounds.successMax);
    const hiWorld = toWorld(hi, bounds.successMin, bounds.successMax);
    node.whisker.position.set(0, loWorld - y, 0);
    node.whisker.scale.set(1, hiWorld - loWorld, 1);

    // Pareto ring
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

    // Rank badge (#1–#3)
    if (opt.rank <= 3) {
      if (node.badge) disposeBadge(node.badge);
      node.badge = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.badgeTexture(opt.rank), transparent: true, depthWrite: false, depthTest: false })
      );
      node.badge.renderOrder = 11;
      node.badge.scale.set(0.15, 0.15, 1);
      node.group.add(node.badge);
    } else if (node.badge) {
      node.group.remove(node.badge);
      disposeBadge(node.badge);
      node.badge = null;
    }
    if (node.badge) node.badge.position.set(node.radius + 0.1, node.radius + 0.1, 0);
  }

  private updateNode(node: Node, opt: ScoredOption, themeChanged: boolean): void {
    node.option = opt;
    const color = this.colorFor(opt);
    const p = PALETTES[this.style.theme];
    node.sphereMat.color.copy(color);
    node.sphereMat.emissive.copy(color).multiplyScalar(p.emissiveMix);
    node.stemMat.color.copy(color);
    this.applyOptionGeometry(node, opt, false);

    if (themeChanged) {
      node.group.remove(node.label);
      disposeSprite(node.label);
      node.label = this.makeLabel(opt);
      node.group.add(node.label);
      node.label.position.set(0, node.radius + 0.12, 0);
      node.whiskerMat.color.set(p.labelText);
      node.ringMat?.color.setHex(p.paretoRing);
    }
  }

  // ─── Per-frame update ─────────────────────────────────────────────────────

  update(delta: number): void {
    this.time += delta;
    const k = 1 - Math.exp(-delta * 9); // frame-rate independent smoothing
    const { visibleIds, hoveredId, selectedId } = this.view;
    const focusId = hoveredId ?? selectedId;
    const pulse = Math.sin(this.time * 2.5);

    for (const node of this.nodes.values()) {
      const ghost = !visibleIds.has(node.id);
      const isSel = node.id === selectedId;
      const isHover = node.id === hoveredId;
      const basis = node.option.successBasis;

      const targetScale = isSel ? 1.55 : isHover ? 1.35 : 1;
      node.scale += (targetScale - node.scale) * k;

      let targetOpacity: number = BASE_OPACITY[basis];
      if (ghost) targetOpacity = GHOST_OPACITY;
      else if (focusId && node.id !== focusId) targetOpacity = Math.min(targetOpacity, DIM_OPACITY);
      node.opacity += (targetOpacity - node.opacity) * k;

      node.group.position.lerp(node.targetPos, k);
      node.sphere.scale.setScalar(node.radius * node.scale);

      node.stem.scale.y = Math.max(node.group.position.y - WORLD_MIN, 0.001);

      node.sphereMat.opacity = node.opacity;
      node.stemMat.opacity = node.opacity * 0.4;
      node.whiskerMat.opacity = node.opacity * 0.55;

      const showLabel =
        !ghost && (this.style.labelMode === "all" || node.option.rank <= 3 || node.option.paretoOptimal || isHover || isSel);
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

  /** Returns the id of the nearest interactive (non-ghost) marker under the ray, if any. */
  pick(raycaster: THREE.Raycaster): string | null {
    const targets: THREE.Object3D[] = [];
    for (const node of this.nodes.values()) {
      if (this.view.visibleIds.has(node.id)) targets.push(node.hit);
    }
    const hit = raycaster.intersectObjects(targets, false)[0];
    return hit ? (hit.object.userData.optionId as string) : null;
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
    node.ringMat?.dispose();
    disposeSprite(node.label);
    if (node.badge) disposeBadge(node.badge);
    this.root.remove(node.group);
  }

  dispose(): void {
    for (const node of this.nodes.values()) this.disposeNode(node);
    this.nodes.clear();
    this.sphereGeo.dispose();
    this.hitGeo.dispose();
    this.hitMat.dispose();
    this.ringGeo.dispose();
    this.stemGeo.dispose();
    this.whiskerGeo.dispose();
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
