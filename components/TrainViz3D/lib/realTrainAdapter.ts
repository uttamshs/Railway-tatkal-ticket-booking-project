import { Train } from "../../../lib/types";
import { TatkalOption, TravelClass, TrainType } from "./types";
import { estimateSuccess } from "./successModel";
import { cheapestOf, estimateBaseFare, tatkalCharge } from "./fares";

/** One seat-availability reading returned by /api/availability. */
export interface SeatReading {
  status: string;
  basis: "live" | "baseline";
  checkedAt?: string;
  /** Total fare reported by the provider (already includes the Tatkal charge). */
  fare?: number;
}

export type SeatMap = Record<string, SeatReading>;

export interface ExcludedOption {
  label: string;
  reason: string;
}

export interface AdaptResult {
  options: TatkalOption[];
  excluded: ExcludedOption[];
}

const SUPPORTED_CLASSES: TravelClass[] = ["SL", "3A", "2A", "1A", "CC", "EC"];
const AC_CLASSES: TravelClass[] = ["1A", "2A", "3A", "CC", "EC"];

export const seatKey = (
  t: Pick<Train, "number" | "fromCode" | "toCode">,
  cls: string
): string => `${t.number}:${t.fromCode}:${t.toCode}:${cls}`;

/** "4h 40m" | "4h" | "40m" → decimal hours, or null when unparseable. */
export function parseDurationHours(text: string | undefined): number | null {
  if (!text) return null;
  const m = text.match(/^\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*$/i);
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  const h = parseInt(m[1] ?? "0", 10);
  const min = parseInt(m[2] ?? "0", 10);
  return Math.round((h + min / 60) * 100) / 100;
}

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Duration derived from departure/arrival when the feed's duration text is unusable. */
function durationFromTimes(dep: string, arr: string): number | null {
  if (!HHMM.test(dep) || !HHMM.test(arr)) return null;
  let diff = toMinutes(arr) - toMinutes(dep);
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 100) / 100;
}

function normalizeTrainType(t: Train): TrainType {
  const raw = `${t.trainType ?? ""} ${t.name ?? ""}`.toLowerCase();
  if (raw.includes("rajdhani")) return "Rajdhani";
  if (raw.includes("shatabdi")) return "Shatabdi";
  if (raw.includes("vande")) return "Vande Bharat";
  if (raw.includes("duronto")) return "Duronto";
  if (raw.includes("double")) return "Double Decker";
  if (raw.includes("superfast")) return "Superfast";
  return "Mail/Express";
}

/**
 * Converts the application's real `Train[]` (+ any seat readings we have fetched)
 * into comparable options. A train/class that lacks a required number is EXCLUDED
 * and reported — it is never filled with a made-up default.
 */
export function adaptTrains(trains: Train[], seats: SeatMap = {}): AdaptResult {
  const options: TatkalOption[] = [];
  const excluded: ExcludedOption[] = [];
  const usedIds = new Set<string>();

  for (const train of trains) {
    const label = `${train.number} ${train.name}`;
    const classes = (train.classes ?? []).filter((c): c is TravelClass =>
      SUPPORTED_CLASSES.includes(c as TravelClass)
    );
    if (classes.length === 0) {
      excluded.push({ label, reason: "no supported classes listed" });
      continue;
    }
    if (!HHMM.test(train.departure ?? "") || !HHMM.test(train.arrival ?? "")) {
      excluded.push({ label, reason: "departure/arrival time unavailable" });
      continue;
    }
    const duration =
      parseDurationHours(train.duration) ?? durationFromTimes(train.departure, train.arrival);
    if (duration === null) {
      excluded.push({ label, reason: "duration unavailable" });
      continue;
    }
    if (!(train.fare > 0)) {
      excluded.push({ label, reason: "fare unavailable" });
      continue;
    }

    const cheapest = cheapestOf(classes);
    const trainType = normalizeTrainType(train);
    const timetableIsDemo = train.liveSource === "prototype";

    for (const cls of classes) {
      const reading = seats[seatKey(train, cls)];
      const estimate = estimateSuccess(reading?.status, reading?.basis, cls);
      if (estimate === null) {
        excluded.push({ label: `${label} (${cls})`, reason: `status: ${reading?.status}` });
        continue;
      }

      const hasLiveFare = reading?.basis === "live" && typeof reading.fare === "number" && reading.fare > 0;
      const baseFare = estimateBaseFare(train.fare, cheapest, cls);
      const fare = hasLiveFare ? (reading!.fare as number) : baseFare + tatkalCharge(baseFare, cls);

      let id = `${train.number}-${cls}`;
      if (usedIds.has(id)) id = `${id}-${train.toCode}`;
      usedIds.add(id);

      options.push({
        id,
        trainNumber: train.number,
        trainName: train.name,
        trainType,
        travelClass: cls,
        departureTime: train.departure,
        arrivalTime: train.arrival,
        fare,
        fareBasis: hasLiveFare ? "live" : "estimated",
        duration,
        tatkalSuccessChance: estimate.chance,
        successBasis: estimate.basis,
        successNote: estimate.note,
        tatkalOpenTime: AC_CLASSES.includes(cls) ? "10:00" : "11:00",
        fromStation: train.from,
        toStation: train.to,
        fromCode: train.fromCode,
        toCode: train.toCode,
        seatsHint: reading?.status && estimate.basis !== "estimate" ? reading.status : undefined,
        seatsCheckedAt: reading?.checkedAt,
        timetableIsDemo,
        amenities: train.amenities ?? [],
      });
    }
  }

  return { options, excluded };
}
