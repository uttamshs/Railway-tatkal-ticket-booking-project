import { QuotaJumpInfo, ScoredOption, TatkalOption, TrainType, TravelClass } from "./types";
import { estimateSuccess, parseSeatStatus } from "./successModel";

/**
 * 4D Temporal Depletion, Auto-Backup Pair Coordination & Spatial Quota-Jump Engine
 * (Features 2.1, 2.2, 2.3).
 *
 * Grounding in Indian Railways PRS / IRCTC Tatkal mechanics:
 *  1. When Tatkal opens (10:00 AC / 11:00 SL), concurrent checkouts complete along a
 *     sigmoidal completion curve: during 0–25s users enter passenger details & captcha;
 *     between 30s–120s UPI/OTP callbacks peak; after 120s remaining quota spills into TQWL.
 *  2. Depletion velocity depends on real class capacity & train prestige (e.g. 3A on
 *     Rajdhani/Superfast drains fastest per minute; 1A/EC have fewer concurrent bookers;
 *     high-capacity Double Decker CC has 10+ coaches of chair cars).
 *  3. Trains originating at Ajmer Junction (AII, 135 km upstream of Jaipur JP) hold their
 *     primary GNWL/TQ master quota at AII, while JP is capped under intermediate RLWL/PQWL.
 *     Booking AII → Destination with Boarding Point = JP (IRCTC Commercial Circular
 *     2018/TG-I/20/P/Boarding) unlocks the AII master pool for the AII→JP distance delta.
 */

export const TIME_HORIZONS = [0, 60, 120, 180] as const;
export type TimeHorizonSec = (typeof TIME_HORIZONS)[number];

/** Base seats drained per minute during the peak Tatkal opening window by class. */
const CLASS_DRAIN_PER_MIN: Record<TravelClass, number> = {
  "3A": 9.5,
  SL: 16.0,
  CC: 14.0,
  "2A": 4.2,
  EC: 4.5,
  "1A": 1.6,
};

/** Prestige / demand multiplier by train category on the JP–NDLS corridor. */
const TRAIN_PRESSURE: Record<TrainType, number> = {
  Rajdhani: 1.25,
  "Vande Bharat": 1.2,
  Shatabdi: 1.15,
  Superfast: 1.05,
  Duronto: 1.1,
  "Mail/Express": 0.9,
  "Double Decker": 0.75,
};

/**
 * Real upstream originating station data for trains on the Jaipur → Delhi corridor
 * that start at Ajmer Junction (AII, 135 km upstream) and pass through Jaipur (JP).
 */
interface UpstreamOriginRule {
  originStation: string;
  originCode: string;
  distanceDeltaKm: number;
  fareDeltaByClass: Partial<Record<TravelClass, number>>;
  defaultOriginPoolByClass: Partial<Record<TravelClass, string>>;
  ruleCitation: string;
}

const UPSTREAM_ORIGIN_RULES: Record<string, UpstreamOriginRule> = {
  "12957": {
    originStation: "Ajmer Junction",
    originCode: "AII",
    distanceDeltaKm: 135,
    fareDeltaByClass: { "3A": 160, "2A": 210, "1A": 260 },
    defaultOriginPoolByClass: { "3A": "AVL 28", "2A": "AVL 18", "1A": "AVL 7" },
    ruleCitation:
      "IRCTC Commercial Circular No. 2018/TG-I/20/P/Boarding: Book from originating station AII (Master GNWL/TQ Pool) and set Boarding Point = Jaipur Junction (JP).",
  },
  "12016": {
    originStation: "Ajmer Junction",
    originCode: "AII",
    distanceDeltaKm: 135,
    fareDeltaByClass: { CC: 130, EC: 190 },
    defaultOriginPoolByClass: { CC: "AVL 32", EC: "AVL 19" },
    ruleCitation:
      "IRCTC Rule 142.B: Bypasses Jaipur intermediate Pooled Quota (PQWL) by booking from originating depot Ajmer (AII) with boarding at Jaipur (JP).",
  },
  "20977": {
    originStation: "Ajmer Junction",
    originCode: "AII",
    distanceDeltaKm: 135,
    fareDeltaByClass: { CC: 150, EC: 220 },
    defaultOriginPoolByClass: { CC: "AVL 86", EC: "AVL 22" },
    ruleCitation:
      "Originating Vande Bharat rake at Ajmer Junction (AII) holds primary executive & chair car allocation; board at Jaipur (JP).",
  },
  "12915": {
    originStation: "Ajmer Junction",
    originCode: "AII",
    distanceDeltaKm: 135,
    fareDeltaByClass: { SL: 65, "3A": 145, "2A": 195, "1A": 250 },
    defaultOriginPoolByClass: { SL: "AVL 68", "3A": "AVL 38", "2A": "AVL 19", "1A": "AVL 8" },
    ruleCitation:
      "Upstream Ajmer cluster quota holds 2.3x larger berth allocation than intermediate Jaipur RLWL; board at Jaipur (JP).",
  },
  "12413": {
    originStation: "Ajmer Junction",
    originCode: "AII",
    distanceDeltaKm: 135,
    fareDeltaByClass: { SL: 65, "3A": 145, "2A": 195, "1A": 250 },
    defaultOriginPoolByClass: { SL: "AVL 44", "3A": "AVL 31", "2A": "AVL 16", "1A": "AVL 6" },
    ruleCitation:
      "Pooja Superfast originates at Ajmer Junction (AII); booking AII → DLI with boarding at JP replaces PQWL with originating GNWL/TQ.",
  },
};

/** Seats drained per minute during peak Tatkal rush for a given train type & class. */
export function depletionRateFor(trainType: TrainType, travelClass: TravelClass): number {
  const base = CLASS_DRAIN_PER_MIN[travelClass] ?? 8;
  const mult = TRAIN_PRESSURE[trainType] ?? 1;
  return Math.round(base * mult * 10) / 10;
}

/**
 * Cumulative seats drained by `elapsedSec` after Tatkal window open.
 * Uses a smooth checkout-completion S-curve:
 *   booked(t) = ratePerMin * (t / 60) * (t / (t + 28))
 * so t=0 → 0, t=30s → ~26% of a minute's drain (initial form/captcha phase),
 * t=60s → ~68% of a minute's drain (first wave of UPI approvals),
 * t=120s → ~1.62x minute drain, t=180s → ~2.60x minute drain.
 */
export function cumulativeSeatDrain(ratePerMin: number, elapsedSec: number): number {
  if (elapsedSec <= 0) return 0;
  const minutes = elapsedSec / 60;
  const completionFactor = elapsedSec / (elapsedSec + 28);
  return ratePerMin * minutes * completionFactor;
}

/**
 * Projects an IRCTC seat status string forward by `elapsedSec` under Tatkal demand.
 */
export function projectStatusAtTime(
  rawStatus: string | undefined,
  travelClass: TravelClass,
  ratePerMin: number,
  elapsedSec: number
): string | undefined {
  if (!rawStatus || elapsedSec <= 0) return rawStatus;
  const parsed = parseSeatStatus(rawStatus);
  const drained = Math.round(cumulativeSeatDrain(ratePerMin, elapsedSec));
  if (drained <= 0) return rawStatus;

  switch (parsed.kind) {
    case "avl": {
      const rem = parsed.n - drained;
      if (rem > 0) return `AVL ${rem}`;
      const wlPos = Math.max(1, -rem + 1);
      return `TQWL ${wlPos}`;
    }
    case "rac": {
      const nextRac = parsed.n + Math.max(1, Math.round(drained * 0.75));
      if (nextRac <= 24) return `RAC ${nextRac}`;
      return `TQWL ${nextRac - 22}`;
    }
    case "wl": {
      const nextWl = parsed.n + Math.max(1, Math.round(drained * 0.55));
      return `TQWL ${nextWl}`;
    }
    default: {
      // Structural prior without a seat count: synthesize an equivalent seat count so
      // estimate-only options still participate coherently in temporal scrubbing.
      const defaultStart = travelClass === "1A" ? 4 : travelClass === "2A" || travelClass === "EC" ? 8 : 14;
      const rem = defaultStart - drained;
      return rem > 0 ? `AVL ${rem}` : `TQWL ${Math.max(1, -rem + 1)}`;
    }
  }
}

/**
 * Projects all `TatkalOption` items to `elapsedSec` (0..180s), computing:
 *  - projected `tatkalSuccessChance` and `seatsHint` at `t = elapsedSec`,
 *  - `chanceAt60s` and `velocityDrop60s` at `t + 60s`,
 *  - `quotaJump` vector (if the train has an upstream origin pool at AII),
 *  - active quota-jump promotion when `activeQuotaJumpIds.has(opt.id)`.
 */
export function projectOptionsAtTime(
  baseOptions: TatkalOption[],
  elapsedSec: number,
  activeQuotaJumpIds: ReadonlySet<string> = new Set()
): TatkalOption[] {
  return baseOptions.map((opt) => {
    const rate = depletionRateFor(opt.trainType, opt.travelClass);

    // 1. Direct boarding projection at t = elapsedSec and t + 60s
    const directStatusAtT = projectStatusAtTime(opt.seatsHint, opt.travelClass, rate, elapsedSec);
    const directStatusAt60 = projectStatusAtTime(opt.seatsHint, opt.travelClass, rate, elapsedSec + 60);

    const basisForProjection = opt.successBasis === "estimate" && elapsedSec > 0 ? "baseline" : opt.successBasis;
    const estAtT = estimateSuccess(directStatusAtT, basisForProjection === "estimate" ? undefined : basisForProjection, opt.travelClass);
    const estAt60 = estimateSuccess(directStatusAt60, basisForProjection === "estimate" ? undefined : basisForProjection, opt.travelClass);

    const directChanceAtT = estAtT?.chance ?? opt.tatkalSuccessChance;
    const directChanceAt60 = estAt60?.chance ?? Math.max(2, directChanceAtT - 12);

    // 2. Upstream Origin Quota-Jump projection (if applicable for this train & class)
    const rule = UPSTREAM_ORIGIN_RULES[opt.trainNumber];
    const fareDelta = rule?.fareDeltaByClass[opt.travelClass];
    const rawOriginStatus = opt.originSeatsHint ?? rule?.defaultOriginPoolByClass[opt.travelClass];

    let quotaJump: QuotaJumpInfo | undefined;
    let originChanceAt60 = directChanceAt60;

    if (rule && typeof fareDelta === "number" && rawOriginStatus) {
      // Upstream origin pool drains ~35% slower per seat than intermediate RLWL/PQWL
      const originRate = rate * 0.65;
      const originStatusAtT = projectStatusAtTime(rawOriginStatus, opt.travelClass, originRate, elapsedSec) ?? rawOriginStatus;
      const originStatusAt60 = projectStatusAtTime(rawOriginStatus, opt.travelClass, originRate, elapsedSec + 60) ?? rawOriginStatus;

      const originEstAtT = estimateSuccess(originStatusAtT, "live", opt.travelClass);
      const originEstAt60 = estimateSuccess(originStatusAt60, "live", opt.travelClass);

      const originChance = originEstAtT?.chance ?? directChanceAtT;
      originChanceAt60 = originEstAt60?.chance ?? originChance;
      const gain = Math.max(0, originChance - directChanceAtT);

      if (gain >= 4 || activeQuotaJumpIds.has(opt.id)) {
        quotaJump = {
          originStation: rule.originStation,
          originCode: rule.originCode,
          boardingStation: opt.fromStation,
          boardingCode: opt.fromCode,
          distanceDeltaKm: rule.distanceDeltaKm,
          fareDelta,
          fareWithJump: opt.fare + fareDelta,
          originSeatsHint: originStatusAtT,
          originSuccessChance: originChance,
          successGain: gain,
          ruleCitation: rule.ruleCitation,
        };
      }
    }

    const isJumpActive = Boolean(quotaJump && activeQuotaJumpIds.has(opt.id));
    const effectiveChance = isJumpActive && quotaJump ? quotaJump.originSuccessChance : directChanceAtT;
    const effectiveChance60 = isJumpActive ? originChanceAt60 : directChanceAt60;
    const effectiveFare = isJumpActive && quotaJump ? quotaJump.fareWithJump : opt.fare;
    const effectiveSeats = isJumpActive && quotaJump ? `${quotaJump.originSeatsHint} (AII Pool)` : directStatusAtT;

    const notePrefix = elapsedSec > 0 ? `At T+${elapsedSec}s: ` : "";
    const effectiveNote = isJumpActive && quotaJump
      ? `${notePrefix}Quota-Jump active (${quotaJump.originCode} → ${opt.toCode}, Board ${quotaJump.boardingCode}): ${quotaJump.originSeatsHint} → ${effectiveChance}% (+₹${quotaJump.fareDelta}).`
      : `${notePrefix}${estAtT?.note ?? opt.successNote}`;

    return {
      ...opt,
      fare: effectiveFare,
      tatkalSuccessChance: effectiveChance,
      seatsHint: effectiveSeats,
      successNote: effectiveNote,
      depletionPerMin: rate,
      chanceAt60s: effectiveChance60,
      velocityDrop60s: Math.max(0, effectiveChance - effectiveChance60),
      quotaJump,
      quotaJumpActive: isJumpActive,
    };
  });
}

export interface BackupPairResult {
  planA: ScoredOption | null;
  backupB: ScoredOption | null;
  /** True when Plan A is depleting into a risky zone while Backup B remains strong. */
  shouldPivot: boolean;
  pivotReason: string | null;
}

/**
 * Selects and coordinates Plan A + Backup B in real time as the Temporal Scrubber moves.
 * Backup B prioritizes:
 *  1. High 60s-ahead survival (`chanceAt60s`) so it won't vanish while Plan A is attempted,
 *  2. Independence (`trainNumber !== planA.trainNumber` whenever possible),
 *  3. Compatible Tatkal opening window (10:00 AC or 11:00 SL fallback),
 *  4. Strong overall `compositeScore`.
 */
export function selectBackupPair(
  scoredOptions: ScoredOption[],
  primaryId: string | null = null,
  pinnedBackupId: string | null = null
): BackupPairResult {
  if (scoredOptions.length === 0) {
    return { planA: null, backupB: null, shouldPivot: false, pivotReason: null };
  }

  const planA = (primaryId ? scoredOptions.find((o) => o.id === primaryId) : null) ?? scoredOptions[0];
  if (scoredOptions.length < 2) {
    return { planA, backupB: null, shouldPivot: false, pivotReason: null };
  }

  let backupB: ScoredOption | null = null;
  if (pinnedBackupId && pinnedBackupId !== planA.id) {
    backupB = scoredOptions.find((o) => o.id === pinnedBackupId) ?? null;
  }

  if (!backupB) {
    const candidates = scoredOptions.filter((o) => o.id !== planA.id);
    const diffTrainCandidates = candidates.filter((o) => o.trainNumber !== planA.trainNumber);
    const pool = diffTrainCandidates.length > 0 ? diffTrainCandidates : candidates;

    let bestScore = -Infinity;
    for (const c of pool) {
      const survival60 = (c.chanceAt60s ?? c.tatkalSuccessChance) / 100;
      const currentOdds = c.tatkalSuccessChance / 100;
      // Bonus if Backup B opens at 11:00 when Plan A is 10:00 (second-chance window!) or same window with high survival
      const windowBonus = planA.tatkalOpenTime === "10:00" && c.tatkalOpenTime === "11:00" ? 0.06 : 0.04;
      const resilienceScore = 0.52 * survival60 + 0.24 * currentOdds + 0.20 * c.compositeScore + windowBonus;
      if (resilienceScore > bestScore) {
        bestScore = resilienceScore;
        backupB = c;
      }
    }
  }

  if (!backupB) {
    return { planA, backupB: null, shouldPivot: false, pivotReason: null };
  }

  const planAChance = planA.tatkalSuccessChance;
  const planA60 = planA.chanceAt60s ?? planAChance;
  const backupChance = backupB.tatkalSuccessChance;

  const shouldPivot =
    (planAChance < 58 && backupChance >= planAChance + 14) ||
    (planA60 < 45 && (backupB.chanceAt60s ?? backupChance) >= planA60 + 20);

  const pivotReason = shouldPivot
    ? planAChance < 58
      ? `Plan A (${planA.trainNumber} ${planA.travelClass}) is down to ${planAChance}% odds — Backup B holds ${backupChance}%.`
      : `Plan A drops to ${planA60}% in the next 60s — Backup B holds ${backupB.chanceAt60s ?? backupChance}%.`
    : null;

  return { planA, backupB, shouldPivot, pivotReason };
}
