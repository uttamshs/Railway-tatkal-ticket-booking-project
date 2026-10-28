import type { ScoreWeights, TravelClass } from "./types";

/**
 * Express-intent hand-off between the home-page prompt bar and the 3D visualizer.
 *
 * The visualizer stays self-contained: it only knows about THIS shape (no app-level imports).
 * Every field is optional — an absent field means "leave the visualizer default alone".
 */
export type IntentEmphasis = "success" | "fare" | "duration";

/** A small human-readable chip (e.g. "JP → Delhi", "Sat, 31 Oct"). `warn` = something was NOT applied. */
export interface IntentChip {
  key: string;
  label: string;
  warn?: boolean;
}

export interface VizIntent {
  /** Changes on every launch so the same prompt can be re-applied deliberately. */
  nonce: number;
  /** Which engine understood the prompt. */
  source: "instant" | "ai";
  classes?: TravelClass[];
  /** "HH:MM" departure window. */
  departureAfter?: string;
  departureBefore?: string;
  maxFare?: number;
  /** Hours. */
  maxDuration?: number;
  /** Percent, 0–100. */
  minSuccess?: number;
  /** What matters most; re-weights the composite score. */
  emphasis?: IntentEmphasis;
  /** Non-filter context chips (route, date, quota, priority) and warnings. Filter chips are derived live. */
  context: IntentChip[];
}

/** Success always keeps a meaningful share — under Tatkal pressure, odds matter most. Each set sums to 1. */
export const EMPHASIS_WEIGHTS: Record<IntentEmphasis, ScoreWeights> = {
  success: { success: 0.6, fare: 0.2, duration: 0.2 },
  fare: { success: 0.3, fare: 0.5, duration: 0.2 },
  duration: { success: 0.3, fare: 0.2, duration: 0.5 },
};

export const EMPHASIS_LABEL: Record<IntentEmphasis, string> = {
  success: "Best odds first",
  fare: "Cheapest first",
  duration: "Fastest first",
};
