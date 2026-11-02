import * as THREE from "three";
import { PALETTES, VizTheme } from "../lib/theme";
import { VizBounds, toWorld, WORLD_MIN, WORLD_MAX } from "../lib/bounds";
import { makeTextSprite } from "./textSprite";

const LO = WORLD_MIN;
const HI = WORLD_MAX;

const inr = (v: number) => `₹${v.toLocaleString("en-IN")}`;
const hours = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}h`;

/** One LineSegments object from flat [x1,y1,z1,x2,y2,z2,...] data. */
function segments(points: number[], color: number, opacity: number): THREE.LineSegments {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  return new THREE.LineSegments(geo, mat);
}

/**
 * Builds the coordinate cage for the current data bounds and theme:
 *  - tick-aligned grid lines on the floor and the two far walls
 *  - three labelled axes on the NEAR edges (visible from the default view)
 *  - tick value labels at every tick + an axis title
 *
 * X = Fare (₹), Y = Tatkal success (%), Z = Duration (h).
 */
export function buildCoordinateCage(theme: VizTheme, bounds: VizBounds): THREE.Group {
  const p = PALETTES[theme];
  const root = new THREE.Group();
  root.name = "CoordinateCage";

  const fx = bounds.fareTicks.map((v) => toWorld(v, bounds.fareMin, bounds.fareMax));
  const sy = bounds.successTicks.map((v) => toWorld(v, bounds.successMin, bounds.successMax));
  const dz = bounds.durationTicks.map((v) => toWorld(v, bounds.durationMin, bounds.durationMax));

  // ── Grid planes (far walls + floor) ---
  const floor: number[] = [];
  fx.forEach((x) => floor.push(x, LO, LO, x, LO, HI));
  dz.forEach((z) => floor.push(LO, LO, z, HI, LO, z));
  root.add(segments(floor, p.gridColor, 0.38));

  const backWall: number[] = []; // z = LO plane (X–Y)
  fx.forEach((x) => backWall.push(x, LO, LO, x, HI, LO));
  sy.forEach((y) => backWall.push(LO, y, LO, HI, y, LO));
  root.add(segments(backWall, p.gridColor, 0.22));

  const leftWall: number[] = []; // x = LO plane (Z–Y)
  dz.forEach((z) => leftWall.push(LO, LO, z, LO, HI, z));
  sy.forEach((y) => leftWall.push(LO, y, LO, LO, y, HI));
  root.add(segments(leftWall, p.gridColor, 0.22));

  // ── Axes on the near edges ---
  root.add(segments([LO, LO, HI, HI, LO, HI], p.axisFare, 1)); // X: fare
  root.add(segments([LO, LO, HI, LO, HI, HI], p.axisSuccess, 1)); // Y: success
  root.add(segments([HI, LO, HI, HI, LO, LO], p.axisDuration, 1)); // Z: duration

  // ── Tick labels ---
  const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
  const tickStyle = { fontPx: 22, color: p.labelText, worldHeight: 0.07, bold: false, onTop: true } as const;

  bounds.fareTicks.forEach((v, i) => {
    const s = makeTextSprite(inr(v), tickStyle);
    s.position.set(fx[i], LO - 0.1, HI + 0.12);
    root.add(s);
  });
  bounds.successTicks.forEach((v, i) => {
    const s = makeTextSprite(`${v}%`, tickStyle);
    s.position.set(LO - 0.14, sy[i], HI + 0.02);
    root.add(s);
  });
  bounds.durationTicks.forEach((v, i) => {
    const s = makeTextSprite(hours(v), tickStyle);
    s.position.set(HI + 0.14, LO - 0.1, dz[i]);
    root.add(s);
  });

  // ── Axis titles ---
  const titleStyle = { fontPx: 26, worldHeight: 0.095, onTop: true } as const;

  const fareTitle = makeTextSprite("Fare (₹)  →", { ...titleStyle, color: hex(p.axisFare) });
  fareTitle.position.set(0, LO - 0.26, HI + 0.2);
  root.add(fareTitle);

  const successTitle = makeTextSprite("Tatkal success (%)  ↑", { ...titleStyle, color: hex(p.axisSuccess) });
  successTitle.position.set(LO - 0.12, HI + 0.16, HI);
  root.add(successTitle);

  const durationTitle = makeTextSprite("Duration (h)  →", { ...titleStyle, color: hex(p.axisDuration) });
  durationTitle.position.set(HI + 0.3, LO - 0.26, 0);
  root.add(durationTitle);

  return root;
}
