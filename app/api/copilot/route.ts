import { NextRequest, NextResponse } from "next/server";
import { COPILOT_SYSTEM_PROMPT } from "../../../lib/copilotPrompt";
import {
  CopilotAction,
  CopilotHistoryMessage,
  CopilotRequest,
  CopilotResponse,
  CopilotTrainData,
  Priority
} from "../../../lib/types";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = Math.max(1, Number.parseInt(process.env.COPILOT_RATE_LIMIT || "5", 10) || 5);
const PROVIDER_TIMEOUT_MS = 12_000;
const PROVIDER_RETRIES = 1;
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const priorities: Priority[] = ["balanced", "availability", "fare", "arrival", "comfort"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseHistory(value: unknown): CopilotHistoryMessage[] | null {
  if (!Array.isArray(value) || value.length > 8) return null;
  const history: CopilotHistoryMessage[] = [];
  for (const item of value) {
    if (!isRecord(item) || (item.sender !== "user" && item.sender !== "assistant") || typeof item.text !== "string") return null;
    if (item.text.length > 500) return null;
    history.push({ sender: item.sender, text: item.text });
  }
  return history;
}

function parseTrains(value: unknown): CopilotTrainData[] | null {
  if (!Array.isArray(value)) return null;
  const trains: CopilotTrainData[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.number !== "string" || typeof item.name !== "string" || typeof item.fromCode !== "string" || typeof item.toCode !== "string" || typeof item.departure !== "string" || typeof item.arrival !== "string" || typeof item.duration !== "string" || typeof item.fare !== "number" || !Array.isArray(item.classes)) return null;
    const classes = [];
    for (const trainClass of item.classes) {
      if (!isRecord(trainClass) || typeof trainClass.code !== "string" || typeof trainClass.status !== "string" || typeof trainClass.source !== "string" || !(trainClass.checkedAt === null || typeof trainClass.checkedAt === "string")) return null;
      classes.push({ code: trainClass.code, status: trainClass.status, source: trainClass.source, checkedAt: trainClass.checkedAt });
    }
    trains.push({ id: item.id, number: item.number, name: item.name, fromCode: item.fromCode, toCode: item.toCode, departure: item.departure, arrival: item.arrival, duration: item.duration, fare: item.fare, classes });
  }
  return trains;
}

function parseRequest(value: unknown): CopilotRequest | null {
  if (!isRecord(value) || typeof value.message !== "string" || value.message.trim().length === 0 || value.message.length > 500) return null;
  const history = parseHistory(value.history);
  const trains = parseTrains(value.trains);
  if (!history || !trains || typeof value.date !== "string" || typeof value.quota !== "string" || !priorities.includes(value.priority as Priority) || !Array.isArray(value.passengerAges) || !(value.selectedTrainId === null || typeof value.selectedTrainId === "string")) return null;
  if (!value.passengerAges.every(age => typeof age === "number" && Number.isFinite(age))) return null;
  return {
    message: value.message,
    history: history.slice(-8),
    date: value.date,
    quota: value.quota,
    priority: value.priority as Priority,
    passengerAges: value.passengerAges,
    selectedTrainId: value.selectedTrainId,
    trains
  };
}

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}

function validateAction(value: unknown, trainIds: Set<string>): CopilotAction | null {
  if (!isRecord(value) || typeof value.type !== "string" || typeof value.value !== "string" || typeof value.label !== "string") return null;
  if (value.type === "select_train" && trainIds.has(value.value)) return { type: "select_train", value: value.value, label: value.label };
  if (value.type === "set_priority" && priorities.includes(value.value as Priority)) return { type: "set_priority", value: value.value as Priority, label: value.label };
  if (value.type === "switch_view" && (value.value === "canvas" || value.value === "list")) return { type: "switch_view", value: value.value, label: value.label };
  return null;
}

function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const now = Date.now();
  if (rateLimits.size > 1000) {
    for (const [knownIp, entry] of rateLimits) {
      if (entry.resetAt <= now) rateLimits.delete(knownIp);
    }
  }
  const current = rateLimits.get(ip);
  if (!current || current.resetAt <= now) {
    rateLimits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else if (current.count >= MAX_REQUESTS) {
    return NextResponse.json({ error: "Assistant unavailable" }, { status: 503 });
  } else {
    current.count += 1;
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const input = parseRequest(body);
  if (!input) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const key = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
  if (!key || !baseUrl || !model) return NextResponse.json({ error: "Assistant unavailable" }, { status: 503 });

  const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const payload = JSON.stringify({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: COPILOT_SYSTEM_PROMPT },
      ...input.history.map(message => ({ role: message.sender === "assistant" ? "assistant" : "user", content: message.text })),
      { role: "user", content: `DATA=${JSON.stringify(input)}\n\nUser message: ${input.message}` }
    ]
  });

  for (let attempt = 0; attempt <= PROVIDER_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: payload,
        cache: "no-store",
        signal: controller.signal
      });
      if (!response.ok) {
        const providerStatus = response.status;
        console.error(`Dash Copilot provider returned HTTP ${providerStatus} on attempt ${attempt + 1}`);
        if (providerStatus === 429) {
          return NextResponse.json({ error: "AI provider quota reached. Please wait about one minute before trying again." }, { status: 429, headers: { "Retry-After": "60" } });
        }
        if (providerStatus === 401 || providerStatus === 403) {
          return NextResponse.json({ error: "AI provider authentication failed." }, { status: 503 });
        }
        throw new Error("Provider request failed");
      }
      const provider = await response.json() as { choices?: { message?: { content?: unknown } }[] };
      const content = provider.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("Invalid provider response");
      const parsed = parseModelJson(content);
      if (!isRecord(parsed) || typeof parsed.answer !== "string") throw new Error("Invalid assistant response");
      const action = validateAction(parsed.action, new Set(input.trains.map(train => train.id)));
      return NextResponse.json({ answer: parsed.answer, action } satisfies CopilotResponse);
    } catch (error) {
      console.error(`Dash Copilot attempt ${attempt + 1} failed`, error instanceof Error ? error.name : "UnknownError");
      if (attempt === PROVIDER_RETRIES) {
        return NextResponse.json({ error: "Assistant unavailable" }, { status: 503 });
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    } finally {
      clearTimeout(timeout);
    }
  }

  return NextResponse.json({ error: "Assistant unavailable" }, { status: 503 });
}
