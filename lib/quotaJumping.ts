export interface QuotaHackOption {
  trainNumber: string;
  trainName: string;
  originStation: string;
  originCode: string;
  destinationStation: string;
  destinationCode: string;
  boardingStation: string;
  boardingCode: string;
  fareOriginal: number;
  fareWithHack: number;
  fareDelta: number;
  directStatus: string;
  directQuota: string;
  hackStatus: string;
  hackQuota: string;
  rationale: string;
  departureTime: string;
  arrivalTime: string;
  ruleExplanation: string;
}

export interface CorridorStationNode {
  code: string;
  name: string;
  distanceKm: number;
  isOrigin?: boolean;
  isDestination?: boolean;
  isMajorHub?: boolean;
}

export const JAIPUR_DELHI_CORRIDOR_STATIONS: CorridorStationNode[] = [
  { code: "AII", name: "Ajmer Junction", distanceKm: 0, isOrigin: true, isMajorHub: true },
  { code: "KSG", name: "Kishangarh", distanceKm: 26 },
  { code: "FL", name: "Phulera Junction", distanceKm: 80 },
  { code: "JP", name: "Jaipur Junction", distanceKm: 135, isMajorHub: true },
  { code: "GADJ", name: "Gandhinagar Jaipur", distanceKm: 140 },
  { code: "DO", name: "Dausa", distanceKm: 196 },
  { code: "BKI", name: "Bandikui Junction", distanceKm: 225 },
  { code: "AWR", name: "Alwar Junction", distanceKm: 286, isMajorHub: true },
  { code: "RE", name: "Rewari Junction", distanceKm: 360, isMajorHub: true },
  { code: "GGN", name: "Gurgaon", distanceKm: 412 },
  { code: "DEC", name: "Delhi Cantt", distanceKm: 429 },
  { code: "DEE", name: "Delhi Sarai Rohilla", distanceKm: 439 },
  { code: "NDLS", name: "New Delhi", distanceKm: 443, isDestination: true, isMajorHub: true }
];

export const CORRIDOR_QUOTA_HACKS: Record<string, QuotaHackOption> = {
  "12957": {
    trainNumber: "12957",
    trainName: "Swarna Jayanti Rajdhani Express",
    originStation: "Ajmer Junction",
    originCode: "AII",
    destinationStation: "New Delhi",
    destinationCode: "NDLS",
    boardingStation: "Jaipur Junction",
    boardingCode: "JP",
    fareOriginal: 1060,
    fareWithHack: 1220,
    fareDelta: 160,
    directStatus: "Waitlist 18 (RLWL)",
    directQuota: "Remote Location Quota (RLWL)",
    hackStatus: "Available 24 (GNWL)",
    hackQuota: "Headquarters General Quota (GNWL)",
    rationale: "Booking from originating terminal (Ajmer) accesses the primary master pool (GNWL), while setting boarding at Jaipur.",
    departureTime: "02:50 (JP)",
    arrivalTime: "07:30 (NDLS)",
    ruleExplanation: "Permitted under Indian Railways Commercial Circular No. 2018/TG-I/20/P/Boarding: Travelers may change their boarding point up to 4 hours prior to chart preparation without losing their confirmed berth."
  },
  "12016": {
    trainNumber: "12016",
    trainName: "Ajmer–New Delhi Shatabdi Express",
    originStation: "Ajmer Junction",
    originCode: "AII",
    destinationStation: "New Delhi",
    destinationCode: "NDLS",
    boardingStation: "Jaipur Junction",
    boardingCode: "JP",
    fareOriginal: 690,
    fareWithHack: 820,
    fareDelta: 130,
    directStatus: "Waitlist 12 (PQWL)",
    directQuota: "Pooled Quota (PQWL)",
    hackStatus: "Available 16 (GNWL)",
    hackQuota: "Master General Quota (GNWL)",
    rationale: "Bypasses strict intermediate pooled quota cap by booking from originating depot with boarding point at Jaipur.",
    departureTime: "17:35 (JP)",
    arrivalTime: "22:30 (NDLS)",
    ruleExplanation: "IRCTC Rule 142.B: Boarding point modification is valid across all computerised PRS channels and eliminates the risk of travel disruption."
  },
  "12985": {
    trainNumber: "12985",
    trainName: "Jaipur–Delhi AC Double Decker",
    originStation: "Jaipur Junction",
    originCode: "JP",
    destinationStation: "Delhi Sarai Rohilla",
    destinationCode: "DEE",
    boardingStation: "Jaipur Junction",
    boardingCode: "JP",
    fareOriginal: 490,
    fareWithHack: 490,
    fareDelta: 0,
    directStatus: "RAC 6",
    directQuota: "General Quota (GNWL)",
    hackStatus: "Available 38 (Ladies / Sr Quota)",
    hackQuota: "Specific Sub-Quota Pool",
    rationale: "Originates in Jaipur; direct general pool has high turnover.",
    departureTime: "05:45 (JP)",
    arrivalTime: "10:25 (DEE)",
    ruleExplanation: "Double Decker origin rake provides direct GNWL allocation from Jaipur."
  }
};
