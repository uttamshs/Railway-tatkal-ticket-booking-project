import * as THREE from "three";

/** World-space extents for each axis (matches mapRange usage in TrainNodeMesh) */
export const CAGE_BOUNDS = {
  fareMin: 0,
  fareMax: 4500,
  successMin: 0,
  successMax: 100,
  durationMin: 3,
  durationMax: 7,
  worldMin: -1,
  worldMax: 1,
};

const AXIS_LENGTH = 2; // total world-space length per axis (−1 to +1)

/** Creates a CanvasTexture sprite with text label. */
function makeTextSprite(
  text: string,
  options: {
    fontSize?: number;
    color?: string;
    bgColor?: string;
    padding?: number;
  } = {}
): THREE.Sprite {
  const {
    fontSize = 28,
    color = "#e0e8ff",
    bgColor = "rgba(0,0,0,0)",
    padding = 8,
  } = options;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = `bold ${fontSize}px Inter, sans-serif`;
  const measured = ctx.measureText(text);
  const w = Math.ceil(measured.width) + padding * 2;
  const h = fontSize + padding * 2;
  canvas.width = w;
  canvas.height = h;

  ctx.font = `bold ${fontSize}px Inter, sans-serif`;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = color;
  ctx.fillText(text, padding, fontSize + padding * 0.5 - 4);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  const aspect = w / h;
  sprite.scale.set(aspect * 0.18, 0.18, 1);
  return sprite;
}

/** Draws a single axis line with tick marks. */
function buildAxis(
  dir: THREE.Vector3,
  color: number,
  origin: THREE.Vector3,
  ticks: number
): THREE.Group {
  const group = new THREE.Group();

  // Main axis line
  const points = [
    origin.clone(),
    origin.clone().add(dir.clone().multiplyScalar(AXIS_LENGTH)),
  ];
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
  group.add(new THREE.Line(geo, mat));

  // Tick marks
  const tickSize = 0.04;
  const perpA =
    Math.abs(dir.x) < 0.9
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);
  const perpB = new THREE.Vector3().crossVectors(dir, perpA).normalize();

  for (let i = 0; i <= ticks; i++) {
    const t = i / ticks;
    const pos = origin.clone().add(dir.clone().multiplyScalar(t * AXIS_LENGTH));
    const tickPts = [
      pos.clone().add(perpB.clone().multiplyScalar(-tickSize)),
      pos.clone().add(perpB.clone().multiplyScalar(tickSize)),
    ];
    const tGeo = new THREE.BufferGeometry().setFromPoints(tickPts);
    const tMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
    });
    group.add(new THREE.Line(tGeo, tMat));
  }

  return group;
}

/** Builds the entire coordinate cage, grid, and axis labels. Returns a Group. */
export function buildCoordinateCage(theme: "light" | "dark"): THREE.Group {
  const root = new THREE.Group();
  root.name = "CoordinateCage";

  const labelColor = theme === "dark" ? "#c8d8ff" : "#334466";
  const gridColor = theme === "dark" ? 0x334466 : 0x99aacc;
  const origin = new THREE.Vector3(-1, -1, -1);

  // ── Axis lines ────────────────────────────────────────────────────────
  // X = Fare (red), Y = Success (green), Z = Duration (blue)
  const xAxis = buildAxis(new THREE.Vector3(1, 0, 0), 0xff4444, origin, 4);
  const yAxis = buildAxis(new THREE.Vector3(0, 1, 0), 0x44ff88, origin, 5);
  const zAxis = buildAxis(new THREE.Vector3(0, 0, 1), 0x4488ff, origin, 4);

  root.add(xAxis, yAxis, zAxis);

  // ── Floor grid (XZ plane at Y = -1) ──────────────────────────────────
  const gridLines = 10;
  const step = AXIS_LENGTH / gridLines;
  const gridMat = new THREE.LineBasicMaterial({
    color: gridColor,
    transparent: true,
    opacity: 0.15,
  });

  for (let i = 0; i <= gridLines; i++) {
    const t = -1 + i * step;

    // Lines parallel to Z
    const p1 = [new THREE.Vector3(-1, -1, t), new THREE.Vector3(1, -1, t)];
    const g1 = new THREE.BufferGeometry().setFromPoints(p1);
    root.add(new THREE.Line(g1, gridMat.clone()));

    // Lines parallel to X
    const p2 = [new THREE.Vector3(t, -1, -1), new THREE.Vector3(t, -1, 1)];
    const g2 = new THREE.BufferGeometry().setFromPoints(p2);
    root.add(new THREE.Line(g2, gridMat.clone()));
  }

  // ── Axis label sprites ────────────────────────────────────────────────
  // X (Fare) label — at end of X axis
  const fareLabel = makeTextSprite("Fare (₹0–₹4500)", { color: labelColor, fontSize: 24 });
  fareLabel.position.set(1.25, -1, -1);
  root.add(fareLabel);

  // Y (Success) label — at top of Y axis
  const successLabel = makeTextSprite("Success (0–100%)", { color: labelColor, fontSize: 24 });
  successLabel.position.set(-1, 1.25, -1);
  root.add(successLabel);

  // Z (Duration) label — at end of Z axis
  const durationLabel = makeTextSprite("Duration (3–7h)", { color: labelColor, fontSize: 24 });
  durationLabel.position.set(-1, -1, 1.25);
  root.add(durationLabel);

  // ── Origin corner tick labels ─────────────────────────────────────────
  const fareMinLabel = makeTextSprite("₹0", { color: labelColor, fontSize: 18 });
  fareMinLabel.position.set(-1, -1.2, -1);
  root.add(fareMinLabel);

  const fareMaxLabel = makeTextSprite("₹4500", { color: labelColor, fontSize: 18 });
  fareMaxLabel.position.set(1, -1.2, -1);
  root.add(fareMaxLabel);

  const durMinLabel = makeTextSprite("3h", { color: labelColor, fontSize: 18 });
  durMinLabel.position.set(-1.15, -1.2, -1);
  root.add(durMinLabel);

  const durMaxLabel = makeTextSprite("7h", { color: labelColor, fontSize: 18 });
  durMaxLabel.position.set(-1.15, -1.2, 1);
  root.add(durMaxLabel);

  return root;
}
