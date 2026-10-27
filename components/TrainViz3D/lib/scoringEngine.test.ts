import {
  normalizeMinMax,
  computeScores,
  computeParetoFrontier,
  filterOptions,
} from "./scoringEngine";
import { TatkalOption, ScoreWeights, FilterState } from "./types";
import { PALETTES, contrastRatio } from "./theme";
import { parseSeatStatus, estimateSuccess } from "./successModel";
import { computeBounds } from "./bounds";
import { rebalance } from "../HUD/WeightSliderPanel";

const MOCK_OPTIONS: TatkalOption[] = [
  {
    id: "T1",
    trainNumber: "12957",
    trainName: "Rajdhani",
    trainType: "Rajdhani",
    travelClass: "3A",
    departureTime: "06:00",
    arrivalTime: "10:30",
    fare: 1500,
    fareBasis: "live",
    duration: 4.5,
    tatkalSuccessChance: 85,
    successBasis: "live",
    successNote: "42 seats confirmed available (live check).",
    seatsHint: "AVL 42",
    tatkalOpenTime: "10:00",
    fromStation: "Jaipur Junction",
    fromCode: "JP",
    toStation: "New Delhi",
    toCode: "NDLS",
    amenities: ["AC"],
    timetableIsDemo: false,
  },
  {
    id: "T2",
    trainNumber: "12016",
    trainName: "Shatabdi",
    trainType: "Shatabdi",
    travelClass: "CC",
    departureTime: "07:00",
    arrivalTime: "11:45",
    fare: 900,
    fareBasis: "live",
    duration: 4.75,
    tatkalSuccessChance: 70,
    successBasis: "live",
    successNote: "12 seats confirmed available (live check).",
    seatsHint: "AVL 12",
    tatkalOpenTime: "10:00",
    fromStation: "Jaipur Junction",
    fromCode: "JP",
    toStation: "New Delhi",
    toCode: "NDLS",
    amenities: ["AC"],
    timetableIsDemo: false,
  },
  {
    id: "T3",
    trainNumber: "12903",
    trainName: "Mail Express",
    trainType: "Mail/Express",
    travelClass: "SL",
    departureTime: "08:00",
    arrivalTime: "14:00",
    fare: 400,
    fareBasis: "estimated",
    duration: 6.0,
    tatkalSuccessChance: 90,
    successBasis: "baseline",
    successNote: "80 seats confirmed available (timetable baseline).",
    seatsHint: "AVL 80",
    tatkalOpenTime: "11:00",
    fromStation: "Jaipur Junction",
    fromCode: "JP",
    toStation: "New Delhi",
    toCode: "NDLS",
    amenities: ["Fan"],
    timetableIsDemo: false,
  },
  {
    id: "T4", // Dominated option: expensive, slow, low chance
    trainNumber: "99999",
    trainName: "Slow Train",
    trainType: "Mail/Express",
    travelClass: "SL",
    departureTime: "09:00",
    arrivalTime: "16:00",
    fare: 2000,
    fareBasis: "estimated",
    duration: 7.0,
    tatkalSuccessChance: 20,
    successBasis: "estimate",
    successNote: "Waitlist 45.",
    seatsHint: "WL 45",
    tatkalOpenTime: "11:00",
    fromStation: "Jaipur Junction",
    fromCode: "JP",
    toStation: "New Delhi",
    toCode: "NDLS",
    amenities: [],
    timetableIsDemo: false,
  },
];

export function runTests(): boolean {
  let passed = 0;
  let failed = 0;

  function assert(desc: string, condition: boolean) {
    if (condition) {
      passed++;
    } else {
      failed++;
      console.error(`FAIL: ${desc}`);
    }
  }

  // Test 1: Normalization min-max bounds [0, 1]
  const fares = [1000, 2000, 3000];
  const normFare = normalizeMinMax(fares, false); // cheaper is better
  assert("Cheapest gets highest score 1.0", normFare[0] === 1.0);
  assert("Most expensive gets score 0.0", normFare[2] === 0.0);
  assert("Mid gets score 0.5", normFare[1] === 0.5);

  // Test 2: Zero variance safety (no NaN)
  const equalFares = [1000, 1000, 1000];
  const normEqual = normalizeMinMax(equalFares, false);
  assert("Zero variance returns 0.5 without NaN", normEqual.every((v) => v === 0.5));

  // Test 3: Composite scoring ranking
  const weights: ScoreWeights = { success: 0.5, fare: 0.25, duration: 0.25 };
  const scored = computeScores(MOCK_OPTIONS, weights);
  assert("Returns correct number of scored options", scored.length === 4);
  assert("Sorted by rank ascending", scored[0].rank === 1 && scored[1].rank === 2);
  assert("Composite score is between 0 and 1", scored.every((s) => s.compositeScore >= 0 && s.compositeScore <= 1));

  // Test 4: Pareto frontier dominance
  const paretoIds = computeParetoFrontier(MOCK_OPTIONS);
  assert("T4 (strictly dominated) is not in Pareto frontier", !paretoIds.has("T4"));
  assert("T1 or T2 or T3 are Pareto optimal", paretoIds.size >= 1);

  // Test 5: Filtering
  const filter: FilterState = {
    classes: new Set(["3A", "CC"]),
    maxFare: 2000,
    minSuccessChance: 60,
    maxDuration: 5.0,
    departureAfter: "00:00",
    departureBefore: "23:59",
  };
  const filtered = filterOptions(scored, filter);
  assert("Filtering by class 3A/CC returns only matching trains", filtered.every((f) => f.travelClass === "3A" || f.travelClass === "CC"));
  assert("Filtering excluded SL class", !filtered.some((f) => f.travelClass === "SL"));

  // Test 6: WCAG AA Theme Contrast Checks (>= 4.5:1)
  for (const [mode, p] of Object.entries(PALETTES)) {
    const textOnPanel = contrastRatio(p.text, p.panelSolid);
    const mutedOnPanel = contrastRatio(p.muted, p.panelSolid);
    const onAccentRatio = contrastRatio(p.onAccent, p.accent);
    assert(`${mode}: text on panelSolid >= 4.5 (got ${textOnPanel.toFixed(2)})`, textOnPanel >= 4.5);
    assert(`${mode}: muted on panelSolid >= 4.5 (got ${mutedOnPanel.toFixed(2)})`, mutedOnPanel >= 4.5);
    assert(`${mode}: onAccent on accent >= 4.5 (got ${onAccentRatio.toFixed(2)})`, onAccentRatio >= 4.5);
  }

  // Test 7: Seat status parser & success estimator
  const avl = parseSeatStatus("AVL 48");
  assert("Parses AVL 48", avl.kind === "avl" && avl.n === 48);
  const rac = parseSeatStatus("RAC 14/RAC 9");
  assert("Parses RAC 14/RAC 9", rac.kind === "rac" && rac.n === 14);
  const wl = parseSeatStatus("GNWL 32/WL 18");
  assert("Parses GNWL 32/WL 18 (takes current 18)", wl.kind === "wl" && wl.n === 18);
  const estLive = estimateSuccess("AVL 48", "live", "3A");
  assert("Live AVL 48 gives high chance and live basis", estLive !== null && estLive.chance >= 75 && estLive.basis === "live");

  // Test 8: Dynamic bounds & Weight rebalancer
  const b = computeBounds(MOCK_OPTIONS);
  assert("Bounds cover fare range", b.fareMin <= 400 && b.fareMax >= 2000);
  const reb = rebalance({ success: 0.5, fare: 0.25, duration: 0.25 }, "success", 0.8);
  const sum = reb.success + reb.fare + reb.duration;
  assert("Rebalanced weights sum to 1.0", Math.abs(sum - 1.0) < 1e-6);

  console.log(`ScoringEngine & Theme tests: ${passed} passed, ${failed} failed.`);
  return failed === 0;
}
