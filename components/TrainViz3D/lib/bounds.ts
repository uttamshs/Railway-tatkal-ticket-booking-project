import { TatkalOption } from "./types";

/** Data extents + "nice" tick values for the three axes. */
export interface VizBounds {
  fareMin: number;
  fareMax: number;
  successMin: number;
  successMax: number;
  durationMin: number;
  durationMax: number;
  fareTicks: number[];
  successTicks: number[];
  durationTicks: number[];
}

/** World-space extent of every axis (cube from −1 to +1). */
export const WORLD_MIN = -1;
export const WORLD_MAX = 1;

/** Rounds a raw step up to 1 / 2 / 2.5 / 5 × 10^k. */
export function niceStep(rawStep: number): number {
  if (!isFinite(rawStep) || rawStep <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const frac = rawStep / pow;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
  return nice * pow;
}

function niceRange(lo: number, hi: number, targetTicks: number, floorAtZero: boolean) {
  let min = lo;
  let max = hi;
  if (max - min < 1e-9) {
    // All values identical: open a symmetric window so the axis is still readable.
    const pad = Math.max(Math.abs(min) * 0.1, 1);
    min -= pad;
    max += pad;
  }
  const step = niceStep((max - min) / targetTicks);
  let niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  if (floorAtZero && niceMin < 0) niceMin = 0;
  const ticks: number[] = [];
  // Rounding to 1e-6 avoids 0.30000000000000004-style tick values.
  for (let v = niceMin; v <= niceMax + step / 1000; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { min: niceMin, max: niceMax, ticks };
}

/** Fits the cage to the data actually on screen (no wasted empty space). */
export function computeBounds(options: TatkalOption[]): VizBounds {
  const successTicks = [0, 25, 50, 75, 100];
  if (options.length === 0) {
    return {
      fareMin: 0, fareMax: 1000, successMin: 0, successMax: 100, durationMin: 0, durationMax: 6,
      fareTicks: [0, 250, 500, 750, 1000], successTicks, durationTicks: [0, 2, 4, 6],
    };
  }
  const fares = options.map((o) => o.fare);
  const durs = options.map((o) => o.duration);
  const f = niceRange(Math.min(...fares), Math.max(...fares), 4, true);
  const d = niceRange(Math.min(...durs), Math.max(...durs), 4, true);
  return {
    fareMin: f.min, fareMax: f.max, successMin: 0, successMax: 100,
    durationMin: d.min, durationMax: d.max,
    fareTicks: f.ticks, successTicks, durationTicks: d.ticks,
  };
}

/** Stable string key — changes only when the cage geometry must be rebuilt. */
export function boundsKey(b: VizBounds): string {
  return [b.fareMin, b.fareMax, b.durationMin, b.durationMax].join("|");
}

/** Linear map of `value` from [min, max] to world space. */
export function toWorld(value: number, min: number, max: number): number {
  if (max === min) return (WORLD_MIN + WORLD_MAX) / 2;
  return WORLD_MIN + ((value - min) / (max - min)) * (WORLD_MAX - WORLD_MIN);
}

/** World-space position of an option inside the cage. */
export function optionToWorld(
  o: Pick<TatkalOption, "fare" | "tatkalSuccessChance" | "duration">,
  b: VizBounds
): [number, number, number] {
  return [
    toWorld(o.fare, b.fareMin, b.fareMax),
    toWorld(o.tatkalSuccessChance, b.successMin, b.successMax),
    toWorld(o.duration, b.durationMin, b.durationMax),
  ];
}
