import { CopilotAction, Train } from "./types";

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  action?: CopilotAction;
}

function durationMinutes(duration: string): number {
  const hours = duration.match(/(\d+)h/);
  const minutes = duration.match(/(\d+)m/);
  return (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
}

export function generateCopilotResponse(query: string, trains: Train[], passengerAges: number[] = []): { text: string; action?: CopilotAction } {
  const label = "Basic mode";
  if (trains.length === 0) {
    return { text: `${label}: No trains are currently available in the app data. Please choose another station or date in Dash and try again.` };
  }

  const q = query.toLowerCase();
  if (/\b(father|mother|senior|elderly|68|lower berth|birth)\b/.test(q) || passengerAges.some(age => age >= 60)) {
    return {
      text: `${label}: For a senior passenger, request a **lower berth preference** and select an appropriate sleeper or other available class shown in Dash. Allocation is not guaranteed; confirm the preference and final status on IRCTC.`,
      action: { type: "set_priority", value: "comfort", label: "Apply comfort priority" }
    };
  }

  const cheapest = [...trains].sort((a, b) => a.fare - b.fare)[0];
  const fastest = [...trains].sort((a, b) => durationMinutes(a.duration) - durationMinutes(b.duration))[0];
  if (/cheap|cheapest|budget|fare|cost|कम|सस्ता/.test(q)) {
    return {
      text: `${label}: **${cheapest.name} (${cheapest.number})** has the lowest fare in the available data: ₹${cheapest.fare}. It departs at ${cheapest.departure} and arrives at ${cheapest.arrival}. Check its current class status and source on IRCTC before booking; availability may change.`,
      action: { type: "select_train", value: cheapest.id, label: `Select ${cheapest.name}` }
    };
  }

  if (/fast|quick|morning|earli|जल्द|तेज़/.test(q)) {
    return {
      text: `${label}: **${fastest.name} (${fastest.number})** has the shortest duration in the available data: ${fastest.duration}. It departs at ${fastest.departure} and arrives at ${fastest.arrival}. Compare fare and live class status before choosing.`,
      action: { type: "select_train", value: fastest.id, label: `Select ${fastest.name}` }
    };
  }

  return {
    text: `${label}: Cheapest available option: **${cheapest.name} (${cheapest.number})** at ₹${cheapest.fare}. Fastest available option: **${fastest.name} (${fastest.number})**, duration ${fastest.duration}. Confirm fare and live status on IRCTC.`
  };
}
