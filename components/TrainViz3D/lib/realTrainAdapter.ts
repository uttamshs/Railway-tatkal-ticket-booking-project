import { Train } from "../../../lib/types";
import { estimateConfirmationProbability } from "../../../lib/probabilityModel";
import { TatkalOption } from "./types";

/** Parses duration string like "4h 40m" or "3h 43m" into decimal hours. */
function parseDurationHours(durationStr: string): number {
  const match = durationStr.match(/(\d+)h\s*(\d*)m?/);
  if (!match) return 4.5;
  const hours = parseInt(match[1] || "0", 10);
  const mins = parseInt(match[2] || "0", 10);
  return Math.round((hours + mins / 60) * 100) / 100;
}

/** Computes accurate IRCTC Tatkal fare based on base fare and class surcharge rules. */
function getTatkalFare(baseFare: number, travelClass: string): number {
  let surcharge = 150;
  if (travelClass === "1A" || travelClass === "EC") surcharge = 500;
  else if (travelClass === "2A") surcharge = 400;
  else if (travelClass === "3A" || travelClass === "CC") surcharge = 300;
  else if (travelClass === "SL") surcharge = 100;
  return baseFare + surcharge;
}

/** Detects TatkalOption["trainType"] from train metadata. */
function normalizeTrainType(t: Train): TatkalOption["trainType"] {
  const raw = (t.trainType || t.name || "").toLowerCase();
  if (raw.includes("rajdhani")) return "Rajdhani";
  if (raw.includes("shatabdi")) return "Shatabdi";
  if (raw.includes("vande")) return "Vande Bharat";
  if (raw.includes("duronto")) return "Duronto";
  if (raw.includes("double")) return "Double Decker";
  if (raw.includes("superfast")) return "Superfast";
  return "Mail/Express";
}

/** Converts live application Train[] into TatkalOption[] for 3D visualization. */
export function adaptTrainsToTatkalOptions(
  trains: Train[],
  liveAvailability: Record<string, string> = {}
): TatkalOption[] {
  const options: TatkalOption[] = [];

  for (const train of trains) {
    const classes = train.classes && train.classes.length > 0 ? train.classes : ["3A", "2A", "SL"];
    const trainType = normalizeTrainType(train);
    const duration = parseDurationHours(train.duration);

    for (const cls of classes) {
      const validClass = (cls as TatkalOption["travelClass"]);
      const isAC = ["1A", "2A", "3A", "CC", "EC"].includes(validClass);
      const tatkalOpenTime = isAC ? "10:00" : "11:00";

      // Live availability lookup
      const liveKey1 = `${train.id}:${cls}`;
      const liveKey2 = `${train.number}:${cls}`;
      const liveStatus = liveAvailability[liveKey1] || liveAvailability[liveKey2];

      // Confirmation probability from empirical corridor model
      const probEstimate = estimateConfirmationProbability(train, cls, "Tatkal");
      const tatkalSuccessChance = probEstimate.probability;

      const fare = getTatkalFare(train.fare || 800, validClass);

      options.push({
        id: `${train.number}-${validClass}`,
        trainNumber: train.number,
        trainName: train.name,
        trainType,
        travelClass: validClass,
        departureTime: train.departure,
        arrivalTime: train.arrival,
        duration,
        fare,
        tatkalSuccessChance,
        tatkalOpenTime,
        fromStation: train.from,
        toStation: train.to,
        seatsHint: liveStatus || undefined,
        amenities: train.amenities && train.amenities.length > 0 ? train.amenities : ["AC", "Charging"],
      });
    }
  }

  return options;
}
