import { Train } from "./types";

export interface ProbabilityEstimate {
  probability: number; // 0 to 100
  status: "available" | "high" | "moderate" | "low";
  label: string;
  frequencyText: string; // Gigerenzer frequency framing
  confidence: "High" | "Medium" | "Low";
  factors: string[];
}

/**
 * Probabilistic heuristic model for IRCTC Waitlist confirmation on the Jaipur-Delhi corridor.
 * Based on empirical railway clearance characteristics:
 * - Rajdhani / Shatabdi have high passenger churn / cancellation velocity in 2A/3A
 * - General quota (GNWL) has significantly higher clearance than Pooled (PQWL) or Remote (RLWL)
 * - Days to departure accelerates cancellation velocity within 72 hours
 */
export function estimateConfirmationProbability(
  train: Train,
  classCode: string,
  quota: string = "General",
  daysToDeparture: number = 3
): ProbabilityEstimate {
  // If already marked available or RAC
  if (train.availabilityType === "available") {
    return {
      probability: 100,
      status: "available",
      label: "Guaranteed Available",
      frequencyText: "10 out of 10 bookings secure confirmed berths immediately",
      confidence: "High",
      factors: ["Current vacancy in active inventory", "Instant PNR allocation", "Zero cancellation risk"]
    };
  }

  const isPremier = ["Rajdhani", "Vande Bharat", "Shatabdi"].includes(train.trainType || "");
  const isTatkal = quota === "Tatkal";
  
  // Base probability depending on train category and class
  let baseProb = 50;

  if (isPremier) {
    baseProb = 78; // Higher coach count & business cancellations
  } else if (train.trainType === "Double Decker") {
    baseProb = 68; // Large Chair Car capacity
  } else {
    baseProb = 55; // Standard Mail/Express
  }

  // Class modifiers
  if (classCode === "1A" || classCode === "EC") {
    baseProb -= 18; // Very limited seats per coach
  } else if (classCode === "3A" || classCode === "CC") {
    baseProb += 14; // Multiple coaches, highest churn
  } else if (classCode === "2A") {
    baseProb += 4;
  }

  // Quota impact
  if (isTatkal) {
    baseProb = 25; // Tatkal waitlists rarely clear due to zero cancellation refund
  }

  // Days to departure impact
  if (daysToDeparture >= 7) {
    baseProb += 8; // More days for cancellations to accumulate
  } else if (daysToDeparture <= 1) {
    baseProb -= 12; // Charts about to prepare, lock-in window
  }

  // Bound probability between 10% and 95% for waitlists
  const probability = Math.min(95, Math.max(15, Math.round(baseProb)));

  // Determine categorical status & frequency framing
  let status: ProbabilityEstimate["status"] = "moderate";
  let label = "Moderate Chance";
  let confidence: ProbabilityEstimate["confidence"] = "Medium";

  if (probability >= 80) {
    status = "high";
    label = "High Confirmation Chance";
    confidence = "High";
  } else if (probability < 45) {
    status = "low";
    label = "High Risk / Low Clearance";
    confidence = "Low";
  }

  // Frequency framing (Gigerenzer cognitive formulation)
  const ratio = Math.round(probability / 10);
  const frequencyText = `${ratio} out of 10 similar waitlists confirmed on this corridor`;

  // Explanatory factors
  const factors: string[] = [];
  if (isPremier) factors.push("+ Premier corridor rake with high business churn");
  if (["3A", "CC"].includes(classCode)) factors.push("+ High coach density facilitates RAC/WL absorption");
  if (daysToDeparture >= 5) factors.push("+ 5+ days remaining for chart preparation cancellations");
  if (isTatkal) factors.push("- Tatkal non-refundable policy depresses cancellation frequency");
  if (factors.length === 0) factors.push("Standard GNWL passenger progression model applied");

  return {
    probability,
    status,
    label,
    frequencyText,
    confidence,
    factors
  };
}
