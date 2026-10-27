import { DataBasis, TatkalOption, TravelClass } from "./types";

/**
 * Tatkal success model.
 *
 * The visualizer's Y axis is "how likely am I to end up with a CONFIRMED Tatkal
 * berth on this train + class". Nothing public gives that number directly, so it is
 * a transparent estimate driven by the REAL seat status string when we have one:
 *
 *   AVL n  → n / (n + h)      h = "half-chance seats" for the class (below)
 *   RAC n  → 82 − 1.5·n       (RAC passengers get a berth in practice), clamped 40–85
 *   WL n   → 35 · e^(−n/10)   (Tatkal waitlists rarely clear), clamped 2–35
 *   closed → excluded from the comparison
 *   none   → structural prior per class (flat-ish, flagged "estimate")
 *
 * `h` is the number of free seats at which a booker has roughly even odds against
 * the crowd hitting the quota in the first minutes. Premium classes have fewer seats
 * and fewer simultaneous bookers per seat, hence the spread.
 */

export type SeatStatus =
  | { kind: "avl"; n: number }
  | { kind: "rac"; n: number }
  | { kind: "wl"; n: number }
  | { kind: "closed" }
  | { kind: "unknown" };

/** Free seats at which odds are ~50% (see header comment). */
const HALF_CHANCE_SEATS: Record<TravelClass, number> = {
  "1A": 6,
  EC: 10,
  "2A": 10,
  "3A": 15,
  CC: 15,
  SL: 25,
};

/** Structural prior (%) when there is no seat data at all. Deliberately modest. */
const PRIOR_CHANCE: Record<TravelClass, number> = {
  "1A": 35,
  EC: 38,
  "2A": 36,
  "3A": 33,
  CC: 40,
  SL: 28,
};

/** Statuses that carry no seat count and must not be read as data. */
const GENERIC = /^(avl(ailable)?|refresh live|live check required|checking.*|—|-)$/i;

/** Parses an IRCTC-style availability string. Never invents a number. */
export function parseSeatStatus(raw: string | undefined | null): SeatStatus {
  const s = (raw ?? "").trim();
  if (!s || GENERIC.test(s)) return { kind: "unknown" };

  if (/not operating|not available|regret|no seats?|cancel+ed|departed|closed|not run|train not/i.test(s)) {
    return { kind: "closed" };
  }

  // "AVAILABLE-0012", "AVL 14", "AVL-14", "CURR_AVBL-0012"
  let m = s.match(/(?:AVAILABLE|AVL|CURR_AVBL)[\s_-]*0*(\d+)/i);
  if (m) return { kind: "avl", n: parseInt(m[1], 10) };

  m = s.match(/RAC[\s_/-]*0*(\d+)/i);
  if (m) return { kind: "rac", n: parseInt(m[1], 10) };

  // "WL 8", "GNWL12/WL 8", "TQWL 3", "RLWL4" — the LAST number is the current position
  if (/WL/i.test(s)) {
    const nums = s.match(/\d+/g);
    if (nums && nums.length > 0) return { kind: "wl", n: parseInt(nums[nums.length - 1], 10) };
  }

  return { kind: "unknown" };
}

export interface SuccessEstimate {
  chance: number; // 0–100, integer
  basis: DataBasis;
  note: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * @param status  Raw status string from the availability API (if any)
 * @param seatBasis  "live" | "baseline" when `status` came from the API, else undefined
 * @returns the estimate, or null when the option is closed (should be excluded)
 */
export function estimateSuccess(
  status: string | undefined,
  seatBasis: "live" | "baseline" | undefined,
  travelClass: TatkalOption["travelClass"]
): SuccessEstimate | null {
  const parsed = parseSeatStatus(status);
  const basis: DataBasis = seatBasis ?? "estimate";
  const tag = basis === "live" ? "Live" : "Baseline (not a live read)";

  switch (parsed.kind) {
    case "closed":
      return null;
    case "avl": {
      const h = HALF_CHANCE_SEATS[travelClass];
      const chance = clamp(Math.round((parsed.n / (parsed.n + h)) * 100), 3, 97);
      return {
        chance,
        basis: seatBasis ?? "estimate",
        note: `${tag}: ${parsed.n} seat${parsed.n === 1 ? "" : "s"} free → ${chance}% (≈50% at ${h} seats for ${travelClass}).`,
      };
    }
    case "rac": {
      const chance = clamp(Math.round(82 - 1.5 * parsed.n), 40, 85);
      return {
        chance,
        basis: seatBasis ?? "estimate",
        note: `${tag}: RAC ${parsed.n} → ${chance}% (RAC holders usually get a berth).`,
      };
    }
    case "wl": {
      const chance = clamp(Math.round(35 * Math.exp(-parsed.n / 10)), 2, 35);
      return {
        chance,
        basis: seatBasis ?? "estimate",
        note: `${tag}: WL ${parsed.n} → ${chance}% (Tatkal waitlists rarely clear).`,
      };
    }
    default:
      return {
        chance: PRIOR_CHANCE[travelClass],
        basis: "estimate",
        note: `Estimate only — no seat count yet. Using the typical Tatkal prior for ${travelClass}.`,
      };
  }
}
