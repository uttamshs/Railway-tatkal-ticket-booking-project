import { TravelClass } from "./types";

/**
 * Tatkal fare rules (IRCTC):
 *   Tatkal charge = pct × base fare, clamped to [min, max].
 *     SL            10%   ₹100 – ₹200
 *     CC            30%   ₹125 – ₹225
 *     3A            30%   ₹300 – ₹400
 *     2A            30%   ₹400 – ₹500
 *     1A / EC       30%   ₹400 – ₹500
 *
 * The timetable feed gives ONE fare per train (the cheapest class it offers), so
 * the other classes are scaled by typical base-fare ratios. Those are estimates and
 * are flagged `fareBasis: "estimated"` in the UI. A live fare from the availability
 * API always wins over the estimate.
 */

const TATKAL_RULES: Record<TravelClass, { pct: number; min: number; max: number }> = {
  SL: { pct: 0.1, min: 100, max: 200 },
  CC: { pct: 0.3, min: 125, max: 225 },
  "3A": { pct: 0.3, min: 300, max: 400 },
  "2A": { pct: 0.3, min: 400, max: 500 },
  "1A": { pct: 0.3, min: 400, max: 500 },
  EC: { pct: 0.3, min: 400, max: 500 },
};

/** Typical base-fare multiple of each class relative to Sleeper. */
const CLASS_FARE_RATIO: Record<TravelClass, number> = {
  SL: 1,
  CC: 2.4,
  "3A": 2.6,
  "2A": 3.7,
  EC: 4.6,
  "1A": 6.4,
};

export function tatkalCharge(baseFare: number, cls: TravelClass): number {
  const r = TATKAL_RULES[cls];
  return Math.min(r.max, Math.max(r.min, Math.round(baseFare * r.pct)));
}

/**
 * Estimates the base fare of `cls` from the train's single (cheapest-class) fare.
 * @param cheapestFare  train.fare from the timetable feed
 * @param cheapestClass the cheapest class that train offers (reference for the ratio)
 */
export function estimateBaseFare(
  cheapestFare: number,
  cheapestClass: TravelClass,
  cls: TravelClass
): number {
  if (cls === cheapestClass) return cheapestFare;
  return Math.round((cheapestFare * CLASS_FARE_RATIO[cls]) / CLASS_FARE_RATIO[cheapestClass]);
}

/** Returns the class with the lowest typical fare among `classes`. */
export function cheapestOf(classes: TravelClass[]): TravelClass {
  return classes.reduce((a, b) => (CLASS_FARE_RATIO[b] < CLASS_FARE_RATIO[a] ? b : a));
}
