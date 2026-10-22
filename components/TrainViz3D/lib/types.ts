/** TatkalOption represents one train+class combination for comparison. */
export interface TatkalOption {
  id: string; // Unique: trainNumber + "-" + travelClass
  trainNumber: string;
  trainName: string;
  trainType:
    | "Rajdhani"
    | "Shatabdi"
    | "Vande Bharat"
    | "Duronto"
    | "Mail/Express"
    | "Double Decker"
    | "Superfast";
  travelClass: "SL" | "3A" | "2A" | "1A" | "CC" | "EC";
  departureTime: string; // "HH:MM"
  arrivalTime: string; // "HH:MM"
  fare: number; // Tatkal fare in ₹
  duration: number; // Journey duration in hours (decimal)
  tatkalSuccessChance: number; // 0–100%
  tatkalOpenTime: "10:00" | "11:00"; // AC=10:00, Sleeper=11:00
  fromStation: string;
  toStation: string;
  seatsHint?: string; // e.g. "AVL 12" or "WL 3"
  amenities: string[];
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
  classes: Set<TatkalOption["travelClass"]>;
  maxFare: number;
  minSuccessChance: number;
  maxDuration: number;
  departureAfter: string; // "HH:MM"
  departureBefore: string; // "HH:MM"
}
