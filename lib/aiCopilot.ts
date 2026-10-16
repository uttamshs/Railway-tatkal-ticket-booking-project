import { Train } from "./types";
import { CORRIDOR_QUOTA_HACKS } from "./quotaJumping";

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  action?: {
    type: "select_train" | "set_priority" | "open_quota_hack" | "filter_budget" | "switch_view";
    payload?: any;
    label: string;
  };
}

export function generateCopilotResponse(query: string, trains: Train[], currentSelectedTrain: Train | null): { text: string; action?: ChatMessage["action"] } {
  const q = query.toLowerCase();

  // 1. Quota jumping question
  if (q.includes("quota") || q.includes("hack") || q.includes("ajmer") || q.includes("hidden") || q.includes("upstream") || q.includes("rlwl") || q.includes("gnwl")) {
    return {
      text: "The **Station Quota-Jumping Mechanism** is one of Dash's primary algorithmic contributions! In Indian Railways, intermediate stations like Jaipur are assigned smaller quota pools (RLWL / PQWL) which waitlist quickly. However, trains starting from Ajmer (e.g. Swarna Rajdhani #12957 or Shatabdi #12016) have large General Quota (GNWL) pools. By booking from Ajmer (AII) to New Delhi (NDLS) and setting your **Boarding Station as Jaipur (JP)**, you pay ~₹130–160 extra but unlock an **instant Confirmed Berth**! This is 100% legal under IRCTC Commercial Circular No. 2018/TG-I/20/P.",
      action: {
        type: "open_quota_hack",
        payload: "12957",
        label: "Inspect Swarna Rajdhani Quota Map →"
      }
    };
  }

  // 2. Fastest train / Morning arrival / Interview
  if (q.includes("fast") || q.includes("quick") || q.includes("morning") || q.includes("interview") || q.includes("reach early") || q.includes("vande bharat")) {
    const fastest = trains.find(t => t.number === "20977") || trains[0];
    return {
      text: `For early morning arrivals and highest speed, **Vande Bharat Express (20977)** is the optimal Pareto choice. It departs Jaipur at 07:47 and reaches Delhi Cantt (DEC) at 11:30 (Duration: **3h 43m**, fastest on the corridor). If you need to reach central New Delhi (NDLS) before 08:00 AM, the overnight **Swarna Rajdhani (12957)** arriving at 07:30 AM is the dominant alternative.`,
      action: {
        type: "select_train",
        payload: fastest.id,
        label: `Select Vande Bharat (${fastest.number})`
      }
    };
  }

  // 3. Budget / Cheap trains
  if (q.includes("budget") || q.includes("cheap") || q.includes("lowest fare") || q.includes("cost") || q.includes("under 1000") || q.includes("under 500")) {
    const cheapest = trains.find(t => t.number === "12985") || trains[1];
    return {
      text: `For cost efficiency, the **Jaipur–Delhi AC Double Decker (12985)** is currently the price anchor of the corridor at **₹490** for AC Chair Car (CC). It completes the journey in 4h 40m, arriving at Delhi Sarai Rohilla (DEE) at 10:25 AM. It provides high comfort per rupee spent.`,
      action: {
        type: "select_train",
        payload: cheapest.id,
        label: `Select Double Decker (₹490)`
      }
    };
  }

  // 4. Senior citizens / lower berth
  if (q.includes("senior") || q.includes("elderly") || q.includes("lower berth") || q.includes("old") || q.includes("grandparent") || q.includes("age")) {
    return {
      text: `For senior passengers (age 60+), Dash's Group Intelligence engine prioritizes sleeper/express rakes with dedicated **Lower Berth Quota (SS Quota)** and automated multi-passenger berth clustering. Trains like **Swarna Rajdhani (12957)** and **Mandore Express** have lower berth priority buffers in 2A and 3A.`,
      action: {
        type: "set_priority",
        payload: "comfort",
        label: "Apply Senior & Comfort Priority"
      }
    };
  }

  // 5. Why is Swarna Rajdhani recommended over Vande Bharat?
  if (q.includes("why") || q.includes("tradeoff") || q.includes("trade-off") || q.includes("compare") || q.includes("difference") || (q.includes("rajdhani") && q.includes("vande"))) {
    return {
      text: `**Explainable Trade-Off Analysis:**
- **Swarna Rajdhani (12957):** Departs 02:50 AM, reaches Central New Delhi (NDLS) at 07:30 AM. Provides sleeper berths (3A/2A/1A) allowing you to sleep through the journey and arrive before the business day begins. Fare: ₹1060.
- **Vande Bharat (20977):** Departs 07:47 AM, reaches Delhi Cantt (DEC) at 11:30 AM. Faster daytime chair car (3h 43m vs 4h 40m), but terminates at Cantt (western suburbs, not central Delhi). Fare: ₹1050.
- **Conclusion:** If your destination is central Delhi and you want a full working day, Rajdhani dominates; if you prefer daytime travel and west Delhi, Vande Bharat dominates.`,
      action: {
        type: "switch_view",
        payload: "canvas",
        label: "View in Interactive Pareto Canvas →"
      }
    };
  }

  // 6. Pareto Frontier explanation
  if (q.includes("pareto") || q.includes("scatter") || q.includes("canvas") || q.includes("graph") || q.includes("chart") || q.includes("visual")) {
    return {
      text: `The **Pareto Frontier** visualizes all non-dominated travel alternatives. A train is Pareto-optimal if no other train is simultaneously faster, cheaper, and has higher confirmation probability. You can drag the Budget ceiling slider or Duration threshold directly on our interactive 2D canvas to isolate your personal optimal boundary.`,
      action: {
        type: "switch_view",
        payload: "canvas",
        label: "Open 2D Pareto Decision Space"
      }
    };
  }

  // Fallback smart response
  return {
    text: `I'm Dash Copilot, your intelligent assistant for the Jaipur ↔ Delhi corridor. I can help you evaluate multi-criteria trade-offs (Duration vs. Fare vs. Certainty), discover quota-jumping alternatives, configure group constraints for senior citizens, or explain why specific trains dominate others. What is your priority for this journey?`,
    action: {
      type: "switch_view",
      payload: "canvas",
      label: "Explore Visual Decision Canvas →"
    }
  };
}
