/**
 * Provenance of a number shown in the visualizer.
 *  - "live":     read from a live inventory provider just now
 *  - "baseline": static corridor baseline returned by the API (NOT a live read)
 *  - "estimate": no seat data at all — structural prior only
 */
export type DataBasis = "live" | "baseline" | "estimate";

export type TravelClass = "SL" | "3A" | "2A" | "1A" | "CC" | "EC";

export type TrainType =
  | "Rajdhani"
  | "Shatabdi"
  | "Vande Bharat"
  | "Duronto"
  | "Mail/Express"
  | "Double Decker"
  | "Superfast";

/**
 * Spatial Quota-Jump Vector (Feature 2.3):
 * Booking from the train's upstream originating station (e.g. Ajmer Junction AII)
 * while setting Boarding Point = Jaipur Junction (JP) accesses the larger originating
 * master quota pool (GNWL/TQ) for a small distance fare delta.
 */
export interface QuotaJumpInfo {
  originStation: string;
  originCode: string;
  boardingStation: string;
  boardingCode: string;
  distanceDeltaKm: number;
  fareDelta: number;
  fareWithJump: number;
  originSeatsHint: string;
  originSuccessChance: number;
  successGain: number;
  ruleCitation: string;
}

/** TatkalOption represents one train + class combination for comparison. */
export interface TatkalOption {
  id: string; // Unique: trainNumber + "-" + travelClass
  trainNumber: string;
  trainName: string;
  trainType: TrainType;
  travelClass: TravelClass;
  departureTime: string; // "HH:MM"
  arrivalTime: string; // "HH:MM"
  fare: number; // Tatkal fare in ₹
  fareBasis: "live" | "estimated";
  duration: number; // Journey duration in hours (decimal)
  tatkalSuccessChance: number; // 0–100% (at current scrubber time t)
  successBasis: DataBasis;
  successNote: string; // Human-readable explanation of how the chance was derived
  tatkalOpenTime: "10:00" | "11:00"; // AC=10:00, Sleeper=11:00
  fromStation: string;
  toStation: string;
  fromCode: string;
  toCode: string;
  seatsHint?: string; // e.g. "AVL 12" or "WL 3" at current scrubber time t
  originSeatsHint?: string; // Upstream origin pool status at t=0 (if applicable)
  seatsCheckedAt?: string; // ISO timestamp of the seat read
  timetableIsDemo: boolean; // true when the timetable itself is a fallback/demo dataset
  amenities: string[];

  // ── 4D Temporal Depletion & Quota-Jump fields (Features 2.1, 2.2, 2.3) ──
  /** Projected confirmation chance 60s after the current scrubber time (t + 60s). */
  chanceAt60s?: number;
  /** Percentage points lost over the next 60s: max(0, tatkalSuccessChance - chanceAt60s). */
  velocityDrop60s?: number;
  /** Estimated seats drained per minute during the peak Tatkal opening rush. */
  depletionPerMin?: number;
  /** Upstream origin quota-jump vector if this train originates before Jaipur. */
  quotaJump?: QuotaJumpInfo;
  /** True when the user has activated the Quota-Jump for this option. */
  quotaJumpActive?: boolean;
}

export interface ScoreWeights {
  success: number; // 0–1, default 0.50
  fare: number; // 0–1, default 0.25
  duration: number; // 0–1, default 0.25
}

export interface ScoredOption extends TatkalOption {
  normFare: number; // Normalized [0,1] where 1=cheapest
  normDuration: number; // Normalized [0,1] where 1=fastest
  normSuccess: number; // Normalized [0,1] where 1=highest odds
  compositeScore: number; // Weighted composite [0,1] where 1=best
  paretoOptimal: boolean;
  rank: number; // 1-indexed overall rank by compositeScore
}

export interface FilterState {
  classes: Set<TravelClass>;
  maxFare: number;
  minSuccessChance: number;
  maxDuration: number;
  departureAfter: string; // "HH:MM"
  departureBefore: string; // "HH:MM"
}
