import { TatkalOption, ScoreWeights, ScoredOption, FilterState } from "./types";

/**
 * Normalizes an array of numbers to [0, 1] using min-max scaling.
 * @param values - Raw numeric values
 * @param higherIsBetter - If true, higher raw value → higher normalized score.
 *                         If false (e.g. fare, duration), lower raw value → higher score.
 * @returns Normalized scores in [0, 1].
 *          If all values are equal (zero variance), returns 0.5 for all to avoid NaN.
 */
export function normalizeMinMax(
  values: number[],
  higherIsBetter: boolean
): number[] {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  // Zero-variance guard: return 0.5 for all to avoid NaN
  if (range === 0) {
    return values.map(() => 0.5);
  }

  return values.map((v) => {
    const raw = (v - min) / range; // [0, 1] where 1=max raw value
    return higherIsBetter ? raw : 1 - raw;
  });
}

/**
 * Computes Pareto-optimal set using three objectives:
 *   - Minimize fare
 *   - Minimize duration
 *   - Maximize tatkalSuccessChance
 *
 * Option A dominates B if:
 *   fare(A) <= fare(B) AND duration(A) <= duration(B) AND success(A) >= success(B)
 *   with at least one strict inequality.
 *
 * @returns Set of IDs that are Pareto-optimal (not dominated by any other).
 */
export function computeParetoFrontier(options: TatkalOption[]): Set<string> {
  const paretoIds = new Set<string>();

  for (let i = 0; i < options.length; i++) {
    const a = options[i];
    let dominated = false;

    for (let j = 0; j < options.length; j++) {
      if (i === j) continue;
      const b = options[j];

      // Does B dominate A?
      const bDominatesOnFare = b.fare <= a.fare;
      const bDominatesOnDuration = b.duration <= a.duration;
      const bDominatesOnSuccess = b.tatkalSuccessChance >= a.tatkalSuccessChance;

      const bStrictlyBetterOnFare = b.fare < a.fare;
      const bStrictlyBetterOnDuration = b.duration < a.duration;
      const bStrictlyBetterOnSuccess = b.tatkalSuccessChance > a.tatkalSuccessChance;

      if (
        bDominatesOnFare &&
        bDominatesOnDuration &&
        bDominatesOnSuccess &&
        (bStrictlyBetterOnFare || bStrictlyBetterOnDuration || bStrictlyBetterOnSuccess)
      ) {
        dominated = true;
        break;
      }
    }

    if (!dominated) {
      paretoIds.add(a.id);
    }
  }

  return paretoIds;
}

/**
 * Computes composite scores for all train options.
 *
 * Normalization:
 *   - Fare:     lower is better → inverted min-max
 *   - Duration: lower is better → inverted min-max
 *   - Success:  higher is better → direct min-max
 *
 * Composite score = weights.success * normSuccess
 *                 + weights.fare * normFare
 *                 + weights.duration * normDuration
 *
 * Results are sorted descending by compositeScore; rank is 1-indexed.
 */
export function computeScores(
  options: TatkalOption[],
  weights: ScoreWeights
): ScoredOption[] {
  if (options.length === 0) return [];

  const fares = options.map((o) => o.fare);
  const durations = options.map((o) => o.duration);
  const successes = options.map((o) => o.tatkalSuccessChance);

  const normFares = normalizeMinMax(fares, false); // lower fare = higher score
  const normDurations = normalizeMinMax(durations, false); // lower duration = higher score
  const normSuccesses = normalizeMinMax(successes, true); // higher success = higher score

  // Clamp weights sum — normalize just in case
  const totalWeight = weights.success + weights.fare + weights.duration;
  const wSuccess = totalWeight > 0 ? weights.success / totalWeight : 1 / 3;
  const wFare = totalWeight > 0 ? weights.fare / totalWeight : 1 / 3;
  const wDuration = totalWeight > 0 ? weights.duration / totalWeight : 1 / 3;

  const paretoIds = computeParetoFrontier(options);

  const scored: ScoredOption[] = options.map((opt, idx) => ({
    ...opt,
    normFare: normFares[idx],
    normDuration: normDurations[idx],
    normSuccess: normSuccesses[idx],
    compositeScore:
      wSuccess * normSuccesses[idx] +
      wFare * normFares[idx] +
      wDuration * normDurations[idx],
    paretoOptimal: paretoIds.has(opt.id),
    rank: 0, // assigned after sorting
  }));

  // Sort descending by compositeScore, assign 1-indexed rank
  scored.sort((a, b) => b.compositeScore - a.compositeScore);
  scored.forEach((opt, idx) => {
    opt.rank = idx + 1;
  });

  return scored;
}

/**
 * Filters scored options according to FilterState.
 * Returns a subset (preserving existing rank order) of options that match all criteria.
 */
export function filterOptions(
  options: ScoredOption[],
  filter: FilterState
): ScoredOption[] {
  return options.filter((opt) => {
    // Class filter: if the set is empty, allow all; otherwise must be in set
    if (filter.classes.size > 0 && !filter.classes.has(opt.travelClass)) {
      return false;
    }

    if (opt.fare > filter.maxFare) return false;
    if (opt.tatkalSuccessChance < filter.minSuccessChance) return false;
    if (opt.duration > filter.maxDuration) return false;

    // Departure time window (HH:MM string comparison works for same-day)
    if (
      filter.departureAfter &&
      opt.departureTime < filter.departureAfter
    ) {
      return false;
    }
    if (
      filter.departureBefore &&
      opt.departureTime > filter.departureBefore
    ) {
      return false;
    }

    return true;
  });
}
