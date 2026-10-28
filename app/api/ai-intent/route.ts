import { NextResponse } from "next/server";
import { DEFAULT_HORIZON_DAYS, sanitizeLlmIntent } from "../../../lib/intent";

/**
 * POST /api/ai-intent  { text: string, today?: "YYYY-MM-DD" }
 * GET  /api/ai-intent  → { llm: boolean }   (is a free-tier LLM key configured?)
 *
 * Optional accelerator for the Express Intent bar. The deterministic parser in `lib/intent.ts` always
 * runs in the browser first; this route only fills gaps for phrasing it cannot read (Hinglish, free-form).
 *
 * Providers (first configured wins, the next is the fallback):
 *   1. Google Gemini  — GEMINI_API_KEY  (+ optional GEMINI_MODEL, default gemini-2.5-flash)
 *   2. Groq           — GROQ_API_KEY    (+ optional GROQ_MODEL,   default llama-3.3-70b-versatile)
 *
 * Contract: this route NEVER throws to the client and never returns 5xx for upstream trouble. Any failure
 * (no key, timeout, rate limit, malformed JSON) is `{ ok:false }` and the UI keeps the instant result.
 * Raw model output always passes through `sanitizeLlmIntent` — nothing unvalidated leaves this file.
 */

const TIMEOUT_MS = 3200;
const MAX_CHARS = 400;
const COOLDOWN_MS = 60_000;

let geminiBlockedUntil = 0;
let groqBlockedUntil = 0;

const geminiKey = () => (process.env.GEMINI_API_KEY || "").trim();
const groqKey = () => (process.env.GROQ_API_KEY || "").trim();

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function systemPrompt(todayISO: string, weekday: string): string {
  return [
    "You extract a train-booking request into JSON for Dash, a Jaipur → Delhi Tatkal planner.",
    `Today is ${todayISO} (${weekday}), India time. Resolve relative dates ("tomorrow", "kal", "next Friday", "31st Oct") to YYYY-MM-DD.`,
    "Dash only supports departures from Jaipur Junction (JP) to Delhi stations: New Delhi NDLS, Delhi Junction DLI, Delhi Sarai Rohilla DEE, Delhi Cantt DEC, Shakur Basti SSB.",
    "Return ONLY a JSON object with these keys. Use null for anything the user did not say — NEVER guess:",
    '  "origin": string|null (place as the user wrote it),',
    '  "destination": string|null (place as the user wrote it; "Delhi" alone is fine),',
    '  "date": "YYYY-MM-DD"|null,',
    '  "quota": "Tatkal"|"General"|"Ladies"|"Senior Citizen"|null,',
    '  "classes": array of "SL","3A","2A","1A","CC","EC" (empty array if unspecified; "AC" means 1A,2A,3A,CC,EC; "sleeper" means SL),',
    '  "departureAfter": "HH:MM" 24-hour|null, "departureBefore": "HH:MM" 24-hour|null (DEPARTURE time window only),',
    '  "maxFare": number in rupees|null, "maxDurationHours": number|null, "minSuccessPercent": number 1-100|null,',
    '  "priority": "success"|"fare"|"duration"|null (what matters most: best odds / cheapest / fastest),',
    '  "unsupported": array of up to 2 short strings for requests Dash cannot filter (e.g. arrival-time limits, passenger counts).',
  ].join("\n");
}

const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    origin: { type: "STRING", nullable: true },
    destination: { type: "STRING", nullable: true },
    date: { type: "STRING", nullable: true },
    quota: { type: "STRING", nullable: true },
    classes: { type: "ARRAY", items: { type: "STRING" } },
    departureAfter: { type: "STRING", nullable: true },
    departureBefore: { type: "STRING", nullable: true },
    maxFare: { type: "NUMBER", nullable: true },
    maxDurationHours: { type: "NUMBER", nullable: true },
    minSuccessPercent: { type: "NUMBER", nullable: true },
    priority: { type: "STRING", nullable: true },
    unsupported: { type: "ARRAY", items: { type: "STRING" } },
  },
};

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(key: string, text: string, system: string): Promise<unknown> {
  const model = (process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();
  const generationConfig: Record<string, unknown> = {
    temperature: 0,
    responseMimeType: "application/json",
    responseSchema: GEMINI_SCHEMA,
  };
  // 2.5-flash "thinks" by default; extraction needs no deliberation and thinking only adds latency.
  if (/2\.5-flash/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };

  return withTimeout(async (signal) => {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text }] }],
          generationConfig,
        }),
        cache: "no-store",
        signal,
      }
    );
    if (r.status === 429) geminiBlockedUntil = Date.now() + COOLDOWN_MS;
    if (!r.ok) throw new Error(`gemini ${r.status}`);
    const data = await r.json();
    const out = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof out !== "string") throw new Error("gemini empty");
    return JSON.parse(out);
  });
}

async function callGroq(key: string, text: string, system: string): Promise<unknown> {
  const model = (process.env.GROQ_MODEL || "llama-3.3-70b-versatile").trim();
  return withTimeout(async (signal) => {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 300,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `${system}\nRespond with a single JSON object.` },
          { role: "user", content: text },
        ],
      }),
      cache: "no-store",
      signal,
    });
    if (r.status === 429) groqBlockedUntil = Date.now() + COOLDOWN_MS;
    if (!r.ok) throw new Error(`groq ${r.status}`);
    const data = await r.json();
    const out = data?.choices?.[0]?.message?.content;
    if (typeof out !== "string") throw new Error("groq empty");
    return JSON.parse(out);
  });
}

export async function GET() {
  return NextResponse.json({ llm: Boolean(geminiKey() || groqKey()) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const miss = (reason: string) => NextResponse.json({ ok: false, engine: null, reason }, { headers: { "Cache-Control": "no-store" } });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, engine: null, reason: "bad-request" }, { status: 400 });
  }
  const rawText = typeof (body as { text?: unknown })?.text === "string" ? (body as { text: string }).text : "";
  const text = rawText.replace(/[\u0000-\u001f]/g, " ").trim();
  if (!text || text.length > MAX_CHARS) {
    return NextResponse.json({ ok: false, engine: null, reason: "bad-request" }, { status: 400 });
  }

  const todayParam = (body as { today?: unknown }).today;
  const todayMatch = typeof todayParam === "string" ? todayParam.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  const today = todayMatch ? new Date(+todayMatch[1], +todayMatch[2] - 1, +todayMatch[3]) : new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const system = systemPrompt(todayISO, WEEKDAYS[today.getDay()]);

  const attempts: { engine: "gemini" | "groq"; run: () => Promise<unknown> }[] = [];
  const gk = geminiKey();
  const qk = groqKey();
  if (gk && Date.now() >= geminiBlockedUntil) attempts.push({ engine: "gemini", run: () => callGemini(gk, text, system) });
  if (qk && Date.now() >= groqBlockedUntil) attempts.push({ engine: "groq", run: () => callGroq(qk, text, system) });
  if (attempts.length === 0) return miss(gk || qk ? "cooling-down" : "no-key");

  for (const a of attempts) {
    try {
      const raw = await a.run();
      const intent = sanitizeLlmIntent(raw, { today, horizonDays: DEFAULT_HORIZON_DAYS });
      return NextResponse.json({ ok: true, engine: a.engine, intent }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      // try the next provider, then fall back to the instant parser on the client
    }
  }
  return miss("upstream-failed");
}
