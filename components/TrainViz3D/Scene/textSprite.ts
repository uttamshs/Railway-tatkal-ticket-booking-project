import * as THREE from "three";

export interface TextSpriteOptions {
  /** Font size in CSS px used when rasterizing (higher = crisper). */
  fontPx?: number;
  color: string;
  /** Optional rounded pill behind the text. */
  background?: string;
  /** World-space height of the sprite. Width follows the text aspect. */
  worldHeight: number;
  bold?: boolean;
  /** Always draw on top of geometry (for labels that must stay readable). */
  onTop?: boolean;
}

const FONT_STACK = "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
const SCALE = 2; // rasterize at 2× for sharp text on HiDPI screens

/** Rasterizes `text` into a camera-facing sprite. Caller owns disposal (see disposeSprite). */
export function makeTextSprite(text: string, opts: TextSpriteOptions): THREE.Sprite {
  const fontPx = opts.fontPx ?? 26;
  const padX = opts.background ? 12 : 4;
  const padY = opts.background ? 7 : 3;
  const font = `${opts.bold === false ? 500 : 700} ${fontPx * SCALE}px ${FONT_STACK}`;

  const measure = document.createElement("canvas").getContext("2d") as CanvasRenderingContext2D;
  measure.font = font;
  const textW = Math.ceil(measure.measureText(text).width);

  const canvas = document.createElement("canvas");
  canvas.width = textW + padX * 2 * SCALE;
  canvas.height = Math.ceil(fontPx * 1.25) * SCALE + padY * 2 * SCALE;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  if (opts.background) {
    ctx.fillStyle = opts.background;
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, canvas.height / 2.6);
    ctx.fill();
  }
  ctx.font = font;
  ctx.fillStyle = opts.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + SCALE);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: !opts.onTop,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set((canvas.width / canvas.height) * opts.worldHeight, opts.worldHeight, 1);
  if (opts.onTop) sprite.renderOrder = 10;
  return sprite;
}

/** Releases a sprite's texture and material. */
export function disposeSprite(sprite: THREE.Sprite): void {
  const mat = sprite.material as THREE.SpriteMaterial;
  mat.map?.dispose();
  mat.dispose();
}
