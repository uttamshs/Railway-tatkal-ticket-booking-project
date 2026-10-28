/**
 * Express Intent — turns one natural-language sentence into the concrete booking state Dash needs
 * (route, date, quota, classes, departure window, fare / duration / odds limits, priority).
 *
 * Two engines share ONE validated output shape (`BookingIntent`):
 *   1. `parseBookingIntent`  — deterministic, offline, <5 ms. Runs on every keystroke (live preview chips)
 *                              and is the source of truth for explicit tokens (dates, times, classes).
 *   2. `/api/ai-intent`      — optional free-tier LLM (Gemini / Groq) for free-form phrasing the parser
 *                              cannot read (Hinglish, "teesri AC", …). Its raw JSON passes through
 *                              `sanitizeLlmIntent`, so a hallucinated field can never reach the UI.
 *
 * Nothing here invents data: unsupported requests (other stations, arrival-time limits, overnight windows)
 * produce an explicit warning and are NOT silently applied.
 */
import type { TravelClass } from "../components/TrainViz3D/lib/types";
import { EMPHASIS_LABEL } from "../components/TrainViz3D/lib/vizIntent";
import type { IntentChip, IntentEmphasis, VizIntent } from "../components/TrainViz3D/lib/vizIntent";

export type QuotaName = "General" | "Tatkal" | "Ladies" | "Senior Citizen";

export interface BookingIntent {
  /** "ALL_DELHI" or a supported Delhi station code. Origin is always Jaipur (JP) — the only supported origin. */
  to?: string;
  /** ISO yyyy-mm-dd, guaranteed to be inside the bookable window. */
  date?: string;
  quota?: QuotaName;
  classes?: TravelClass[];
  departureAfter?: string;
  departureBefore?: string;
  maxFare?: number;
  /** Hours. */
  maxDuration?: number;
  /** Percent. */
  minSuccess?: number;
  emphasis?: IntentEmphasis;
  /** Things that were understood but could NOT be applied. Always shown to the user. */
  warnings: string[];
}

export interface ParseOptions {
  /** Injectable "now" (tests). */
  today?: Date;
  /** Number of selectable days starting today. Must match the date picker (14). */
  horizonDays?: number;
}

export const DEFAULT_HORIZON_DAYS = 14;
/** When the instant parser already understood this many categories, the LLM is skipped (no latency). */
export const INSTANT_SUFFICIENT_FIELDS = 4;

export const ALL_CLASSES: TravelClass[] = ["SL", "3A", "2A", "1A", "CC", "EC"];
const AC_CLASSES: TravelClass[] = ["1A", "2A", "3A", "CC", "EC"];
const CLASS_DISPLAY_ORDER: TravelClass[] = ["1A", "2A", "3A", "CC", "EC", "SL"];
export const DELHI_CODES = ["NDLS", "DLI", "DEE", "DEC", "SSB"] as const;

// ───────────────────────────── date helpers ─────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function validYMD(y: number, m: number, d: number): Date | null {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null;
}

const MONTH_IDX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthIndex = (s: string) => MONTH_IDX[s.slice(0, 3).toLowerCase()];
const WEEKDAY_IDX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function resolveMonthDay(day: number, month0: number, year: number | undefined, today: Date): Date | null {
  if (year !== undefined) return validYMD(year < 100 ? 2000 + year : year, month0 + 1, day);
  const t0 = startOfDay(today);
  let d = validYMD(t0.getFullYear(), month0 + 1, day);
  if (d && d < t0) d = validYMD(t0.getFullYear() + 1, month0 + 1, day);
  return d;
}

function prettyChipDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

/** Applies the date window rule shared by both engines. */
function applyDate(intent: BookingIntent, dt: Date | null, label: string, today: Date, horizon: number) {
  if (!dt) {
    intent.warnings.push(`I couldn't read the date “${label}”.`);
    return;
  }
  const diff = Math.round((startOfDay(dt).getTime() - startOfDay(today).getTime()) / 86400000);
  if (diff < 0 || diff >= horizon) {
    intent.warnings.push(`${label} is outside the next ${horizon} days Dash can book — keeping your current date.`);
    return;
  }
  intent.date = toISODate(dt);
}

// ───────────────────────────── time helpers ─────────────────────────────

type Mer = "am" | "pm" | "h" | null;
const normMer = (s?: string): Mer => {
  if (!s) return null;
  const l = s.toLowerCase().replace(/\./g, "");
  return l === "am" || l === "pm" ? l : "h";
};
const isAmPm = (m: Mer) => m === "am" || m === "pm";

function toMinutes(h: number, mi: number, mer: Mer): number | null {
  if (!Number.isFinite(h) || mi < 0 || mi > 59) return null;
  if (isAmPm(mer)) {
    if (h < 1 || h > 12) return null;
    return ((h % 12) + (mer === "pm" ? 12 : 0)) * 60 + mi;
  }
  if (h < 0 || h > 23) return null;
  return h * 60 + mi;
}
const hhmm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

const TOKEN = String.raw`(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|hrs?|h)?(?![a-z])`;
const RANGE_RE = new RegExp(
  String.raw`(?:\b(between|from)\s+)?\b${TOKEN}\s*(?:to|-|till|until|and)\s*${TOKEN}`,
  "i"
);
const AFTER_RE = new RegExp(
  String.raw`\b(?:after|from|post|starting(?:\s+from)?|later\s+than|not\s+before|no\s+earlier\s+than)\s+${TOKEN}`,
  "i"
);
const BEFORE_RE = new RegExp(
  String.raw`\b(?:before|by|until|till|not\s+after|earlier\s+than|no\s+later\s+than)\s+${TOKEN}`,
  "i"
);

type RangeResult = { start: number; end: number } | "overnight" | null;

function resolveRange(m: RegExpExecArray): RangeResult {
  const kw = m[1];
  const h1 = +m[2];
  const h2 = +m[5];
  const mi1 = m[3] !== undefined ? +m[3] : 0;
  const mi2 = m[6] !== undefined ? +m[6] : 0;
  const s1 = normMer(m[4]);
  const s2 = normMer(m[7]);
  const hasColon = m[3] !== undefined || m[6] !== undefined;
  const keywordOnly = !!kw && Math.max(h1, h2) >= 13; // "between 10 and 22" is unmistakably 24-hour
  if (!s1 && !s2 && !hasColon && !keywordOnly) return null; // e.g. "2 to 3" — not a time range

  let e1 = s1;
  let e2 = s2;
  let inherited1 = false;
  let inherited2 = false;
  if (!e1 && isAmPm(e2) && h1 >= 1 && h1 <= 12) {
    e1 = e2;
    inherited1 = true;
  } else if (!e2 && isAmPm(e1) && h2 >= 1 && h2 <= 12) {
    e2 = e1;
    inherited2 = true;
  }
  let a = toMinutes(h1, mi1, e1);
  let b = toMinutes(h2, mi2, e2);
  if (a === null || b === null) return null;

  if (a >= b) {
    if (inherited1 && e2 === "pm") {
      const alt = toMinutes(h1, mi1, "am"); // "9 to 5 pm" → 09:00–17:00
      if (alt !== null && alt < b) a = alt;
    } else if (inherited2 && e1 === "am") {
      const alt = toMinutes(h2, mi2, "pm"); // "10 am to 6" → 10:00–18:00
      if (alt !== null && alt > a) b = alt;
    }
  }
  if (a >= b) return "overnight";
  return { start: a, end: b };
}

function resolveSingle(m: RegExpExecArray): number | null {
  const mer = normMer(m[3]);
  if (!mer && m[2] === undefined) return null; // bare "by 10" is too ambiguous
  return toMinutes(+m[1], m[2] !== undefined ? +m[2] : 0, mer);
}

// ───────────────────────────── station helpers ─────────────────────────────

type Place = { kind: "jaipur" } | { kind: "delhi"; code: string } | { kind: "unknown"; name: string };

function matchDelhi(s: string): string | null {
  if (/\bnew\s+delhi\b|\bndls\b/i.test(s)) return "NDLS";
  if (/\bold\s+delhi\b|\bdelhi\s+(?:jn|junction)\b|\bdli\b/i.test(s)) return "DLI";
  if (/\bsarai\s+rohilla\b/i.test(s) || /\bDEE\b/.test(s)) return "DEE";
  if (/\bdelhi\s+cantt?\b|\bcantonment\b/i.test(s) || /\bDEC\b/.test(s)) return "DEC";
  if (/\bshakur\s*basti\b|\bssb\b/i.test(s)) return "SSB";
  if (/\b(?:delhi|ncr)\b/i.test(s)) return "ALL_DELHI";
  return null;
}

const PLACE_STOP = new Set([
  "i", "we", "me", "my", "prefer", "only", "on", "for", "in", "at", "by", "with", "via", "and", "or", "tomorrow",
  "today", "between", "after", "before", "under", "below", "please", "want", "wanna", "need", "ticket", "tickets",
  "train", "trains", "from", "to", "depart", "departure", "departing", "leaving", "leave", "around", "the", "a", "an",
  "book", "booking", "hey", "hi", "hello", "also", "class", "classes", "tatkal", "quota", "time", "date", "morning",
  "afternoon", "evening", "night", "early", "late", "fare", "price", "cheap", "cheapest", "fastest", "fast", "quick",
  "safest", "confirmed", "just", "any", "all", "going", "go", "travel", "travelling", "traveling", "is", "it", "that",
  "this", "next", "coming", "day", "could", "would", "can", "you", "get", "find", "show", "looking", "trip", "journey",
]);

function resolvePlace(raw: string): Place | null {
  const s = raw.trim();
  if (!s) return null;
  const delhi = matchDelhi(s);
  if (delhi) return { kind: "delhi", code: delhi };
  if (/\bjaipur\b|\bjp\b/i.test(s)) return { kind: "jaipur" };
  const tokens = s.split(/\s+/).map((t) => t.replace(/[^A-Za-z\u00C0-\u024F\u0900-\u097F.'-]/g, "").replace(/^[.'-]+|[.'-]+$/g, ""));
  const picked: string[] = [];
  for (const t of tokens) {
    if (!t || PLACE_STOP.has(t.toLowerCase())) {
      if (picked.length) break;
      continue;
    }
    picked.push(t);
    if (picked.length === 2) break;
  }
  if (!picked.length) return null;
  return { kind: "unknown", name: picked.join(" ").slice(0, 24) };
}

function applyRoute(intent: BookingIntent, origin: Place | null, dest: Place | null) {
  if (origin?.kind === "delhi" || (dest?.kind === "jaipur" && origin?.kind !== "jaipur")) {
    intent.warnings.push("Delhi → Jaipur isn't covered yet — Dash plans Jaipur → Delhi.");
    return;
  }
  if (origin?.kind === "unknown") {
    intent.warnings.push(`“${origin.name}” isn't a supported departure yet — showing Jaipur Junction (JP) trains.`);
  }
  if (dest?.kind === "delhi") intent.to = dest.code;
  else if (dest?.kind === "unknown") {
    intent.warnings.push(`“${dest.name}” isn't a supported destination yet — Dash covers Delhi stations.`);
  }
}

// ───────────────────────────── class helpers ─────────────────────────────

const CLASS_GUARD = String.raw`(?![a-z0-9]|\.[a-z])`;
const CLASS_PATTERNS: { cls: TravelClass | "NONAC"; re: RegExp }[] = [
  { cls: "NONAC", re: /\bnon[-\s]?ac\b/gi },
  { cls: "1A", re: new RegExp(String.raw`\b1(?:-?a|\s?-?ac)${CLASS_GUARD}|\b(?:first|1st)\s+ac\b|\b1\s?-?\s?tier\b`, "gi") },
  { cls: "2A", re: new RegExp(String.raw`\b2(?:-?a|\s?-?ac)${CLASS_GUARD}|\b(?:second|2nd)\s+ac\b|\b2\s?-?\s?tier\b`, "gi") },
  { cls: "3A", re: new RegExp(String.raw`\b3(?:-?a|\s?-?ac)${CLASS_GUARD}|\b(?:third|3rd)\s+ac\b|\b3\s?-?\s?tier\b`, "gi") },
  { cls: "SL", re: /\bsl\b|\bsleeper\b/gi },
  { cls: "CC", re: /\bcc\b|\bchair\s*car\b/gi },
  { cls: "EC", re: /\bec\b|\bexecutive(?:\s+chair)?(?:\s+car)?\b/gi },
];
const GENERIC_AC_RE = /\bac\b|\bair[-\s]?condition(?:ed|ing)?\b/gi;

const NEG_CLASS_TOKEN = String.raw`(?:[123](?:-?a|\s?-?ac)|sl|sleeper|cc|ec|ac|chair\s+car|executive|(?:1st|first|2nd|second|3rd|third)\s+ac|non-?ac)`;
const NEGATION_BEFORE = new RegExp(
  String.raw`\b(?:no|not|except|without|avoid|exclude|excluding|skip|other\s+than|anything\s+but|don'?t\s+want|dont\s+want)\s+(?:(?:in|any|the|class|classes|of|a)\s+)*(?:${NEG_CLASS_TOKEN}\s*(?:or|and|&|nor)?\s*)*$`,
  "i"
);

// ───────────────────────────── the instant parser ─────────────────────────────

const PLACE_RE = String.raw`[a-z][a-z.'-]*(?:\s+[a-z][a-z.'-]*){0,3}`;
const ROUTE_FROM_TO = new RegExp(String.raw`\bfrom\s+(${PLACE_RE})\s+(?:to|->|→|towards)\s+(${PLACE_RE})`, "i");
const ROUTE_TO_FROM = new RegExp(String.raw`\b(?:to|for)\s+(${PLACE_RE})\s+from\s+(${PLACE_RE})`, "i");
const ROUTE_ALIAS_PAIR = new RegExp(
  String.raw`\b(jaipur(?:\s+(?:jn|junction))?|jp|new\s+delhi|ndls|old\s+delhi|delhi(?:\s+(?:jn|junction|cantt?))?|DEE|DEC)\s*(?:to|->|→)\s*(${PLACE_RE})`,
  "i"
);
const ROUTE_FROM_ONLY = new RegExp(String.raw`\bfrom\s+(${PLACE_RE})`, "i");

const ARRIVAL_TIME = String.raw`\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|hrs?|h)?(?![a-z])`;
const ARRIVAL_DAYPART = String.raw`(?:the\s+)?(?:early\s+)?(?:morning|afternoon|evening|night)`;
const ARRIVAL_RE = new RegExp(
  String.raw`\b(?:arriv\w*|reach\w*)(?:\s+[a-z.']+){0,3}?\s+(?:by|before|after|at|around)\s+(?:${ARRIVAL_TIME}|${ARRIVAL_DAYPART})`,
  "i"
);

const MONTHS_SRC = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const DATE_ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/;
const DATE_SLASH = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;
const DATE_DASH_YEAR = /\b(\d{1,2})-(\d{1,2})-(\d{2,4})\b/;
const DATE_DAY_MONTH = new RegExp(String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:of\s+)?(${MONTHS_SRC})\b\.?(?:[\s,]+(\d{4}))?`, "i");
const DATE_MONTH_DAY = new RegExp(
  String.raw`\b(${MONTHS_SRC})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?!\s*(?::|a\.?m|p\.?m))(?:[\s,]+(\d{4}))?`,
  "i"
);
const WEEKDAY_FULL = /\b(?:(next|this|coming|on)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
const WEEKDAY_ABBR = /\b(next|this|coming|on)\s+(mon|tues?|wed|thur?s?|fri|sat|sun)\b/i;

const DAYPARTS: { re: RegExp; after: string; before: string }[] = [
  { re: /\bearly\s+morning\b/i, after: "00:00", before: "06:59" },
  { re: /\bmorning\b/i, after: "05:00", before: "11:59" },
  { re: /\bafternoon\b/i, after: "12:00", before: "16:59" },
  { re: /\bevening\b/i, after: "17:00", before: "20:59" },
  { re: /\b(?:late\s+)?night\b/i, after: "21:00", before: "23:59" },
];

const EMPHASIS_PATTERNS: { emphasis: IntentEmphasis; re: RegExp }[] = [
  { emphasis: "fare", re: /\b(?:cheapest|cheap|lowest\s+(?:fare|price|cost)|affordable|least\s+expensive|budget[-\s]friendly)\b/i },
  { emphasis: "duration", re: /\b(?:fastest|quickest|shortest|quick|fast|speedy|least\s+time)\b/i },
  { emphasis: "success", re: /\b(?:safest|surest|confirmed|guaranteed|best\s+chance|highest\s+chance|best\s+odds|most\s+likely|sure[-\s]?shot)\b/i },
];

const DURATION_RE = /\b(?:under|within|less\s+than|max(?:imum)?(?:\s+duration)?|below|at\s+most|upto|up\s+to|not\s+more\s+than|in)\s+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)(?![a-z])/i;
const SUCCESS_RE = /(?:(?:at\s+least|min(?:imum)?(?:\s+of)?|above|over|more\s+than|>=?)\s*)?(\d{1,3})\s*%/i;
const FARE_RE = new RegExp(
  String.raw`\b(?:under|below|less\s+than|upto|up\s+to|within|max(?:imum)?(?:\s+fare)?|budget(?:\s+of)?|not\s+more\s+than|at\s+most|cheaper\s+than|fare\s+(?:under|below|upto|within))\s*(?:of\s+)?(₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand)?(?![\d%:]|\s*(?:hours?|hrs?|h\b|a\.?m|p\.?m))`,
  "i"
);
const FARE_TRAILING_RE = /(₹|rs\.?|inr)\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:or\s+less|or\s+below|and\s+below|max(?:imum)?)/i;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function parseBookingIntent(text: string, opts: ParseOptions = {}): BookingIntent {
  const today = opts.today ?? new Date();
  const horizon = opts.horizonDays ?? DEFAULT_HORIZON_DAYS;
  const intent: BookingIntent = { warnings: [] };
  const input = (text ?? "").slice(0, 600);
  let w = ` ${input.replace(/[\u2013\u2014\u2212]/g, "-").replace(/\s+/g, " ")} `;

  const blank = (index: number, len: number) => {
    w = w.slice(0, index) + " ".repeat(len) + w.slice(index + len);
  };
  const find = (re: RegExp, pred?: (m: RegExpExecArray) => boolean): RegExpExecArray | null => {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = g.exec(w))) {
      if (!pred || pred(m)) return m;
      if (m[0].length === 0) g.lastIndex++;
    }
    return null;
  };
  const take = (re: RegExp, pred?: (m: RegExpExecArray) => boolean) => {
    const m = find(re, pred);
    if (m) blank(m.index, m[0].length);
    return m;
  };

  // 1) Arrival-time phrases ("reach Delhi before 11 am") — there is no arrival filter, so say so
  //    instead of misreading them as a departure window.
  if (take(ARRIVAL_RE)) {
    intent.warnings.push("Arrival-time limits aren't a filter yet — filtering by departure time instead.");
  }

  // 2) Date
  const dateLabelOf = (dt: Date) => `${dt.getDate()} ${MONTH_NAMES[dt.getMonth()]}`;
  let m: RegExpExecArray | null;
  if ((m = take(DATE_ISO))) {
    applyDate(intent, validYMD(+m[1], +m[2], +m[3]), m[0], today, horizon);
  } else if ((m = take(DATE_DAY_MONTH))) {
    const month0 = monthIndex(m[2]);
    const dt = resolveMonthDay(+m[1], month0, m[3] ? +m[3] : undefined, today);
    applyDate(intent, dt, dt ? dateLabelOf(dt) : `${m[1]} ${m[2]}`, today, horizon);
  } else if ((m = take(DATE_MONTH_DAY))) {
    const month0 = monthIndex(m[1]);
    const dt = resolveMonthDay(+m[2], month0, m[3] ? +m[3] : undefined, today);
    applyDate(intent, dt, dt ? dateLabelOf(dt) : `${m[2]} ${m[1]}`, today, horizon);
  } else if (
    (m = take(DATE_SLASH, (x) => +x[2] >= 1 && +x[2] <= 12 && +x[1] >= 1 && +x[1] <= 31)) ||
    (m = take(DATE_DASH_YEAR, (x) => +x[2] >= 1 && +x[2] <= 12 && +x[1] >= 1 && +x[1] <= 31))
  ) {
    const dt = resolveMonthDay(+m[1], +m[2] - 1, m[3] ? +m[3] : undefined, today);
    applyDate(intent, dt, dt ? dateLabelOf(dt) : m[0], today, horizon);
  } else if (take(/\b(?:day\s+after\s+tomorrow|parso)\b/i)) {
    const d = startOfDay(today);
    d.setDate(d.getDate() + 2);
    applyDate(intent, d, "The day after tomorrow", today, horizon);
  } else if (take(/\b(?:tomorrow|tmrw|tmw)\b/i)) {
    const d = startOfDay(today);
    d.setDate(d.getDate() + 1);
    applyDate(intent, d, "Tomorrow", today, horizon);
  } else if (take(/\btoday\b/i)) {
    applyDate(intent, startOfDay(today), "Today", today, horizon);
  } else if ((m = take(WEEKDAY_FULL)) || (m = take(WEEKDAY_ABBR))) {
    const qualifier = (m[1] ?? "").toLowerCase();
    const target = WEEKDAY_IDX[m[2].slice(0, 3).toLowerCase()];
    let offset = (target - today.getDay() + 7) % 7;
    if (offset === 0 && qualifier === "next") offset = 7;
    const d = startOfDay(today);
    d.setDate(d.getDate() + offset);
    applyDate(intent, d, m[0].trim(), today, horizon);
  }

  // 3) Classes (collected on the untouched text first, so negation can see its neighbours)
  type ClassHit = { cls: TravelClass | "NONAC" | "AC"; index: number; len: number };
  const hits: ClassHit[] = [];
  for (const { cls, re } of CLASS_PATTERNS) {
    const g = new RegExp(re.source, re.flags);
    let cm: RegExpExecArray | null;
    while ((cm = g.exec(w))) {
      hits.push({ cls, index: cm.index, len: cm[0].length });
      if (cm[0].length === 0) g.lastIndex++;
    }
  }
  const snapshot = w;
  for (const h of hits) blank(h.index, h.len);
  {
    const g = new RegExp(GENERIC_AC_RE.source, GENERIC_AC_RE.flags);
    let cm: RegExpExecArray | null;
    const acHits: ClassHit[] = [];
    while ((cm = g.exec(w))) acHits.push({ cls: "AC", index: cm.index, len: cm[0].length });
    for (const h of acHits) {
      hits.push(h);
      blank(h.index, h.len);
    }
  }
  if (hits.length) {
    const include = new Set<TravelClass>();
    const exclude = new Set<TravelClass>();
    for (const h of hits) {
      const targets: TravelClass[] = h.cls === "AC" ? AC_CLASSES : h.cls === "NONAC" ? ["SL"] : [h.cls];
      const before = snapshot.slice(Math.max(0, h.index - 60), h.index);
      const negated = h.cls !== "NONAC" && NEGATION_BEFORE.test(before);
      for (const t of targets) (negated ? exclude : include).add(t);
    }
    let result: TravelClass[];
    if (include.size > 0) result = [...include].filter((c) => !exclude.has(c));
    else result = ALL_CLASSES.filter((c) => !exclude.has(c));
    if (result.length > 0 && result.length < ALL_CLASSES.length) {
      intent.classes = CLASS_DISPLAY_ORDER.filter((c) => result.includes(c));
    }
  }

  // 4) Duration → success % → fare (each blanks what it consumed so later steps can't re-read it)
  if ((m = take(DURATION_RE, (x) => +x[1] >= 0.5 && +x[1] <= 48))) intent.maxDuration = +m[1];
  if ((m = take(SUCCESS_RE, (x) => +x[1] >= 1 && +x[1] <= 100))) intent.minSuccess = +m[1];
  const fareOf = (num: string, k?: string) => parseFloat(num.replace(/,/g, "")) * (k ? 1000 : 1);
  if ((m = take(FARE_RE, (x) => { const v = fareOf(x[2], x[3]); return v >= 100 && v <= 100000; }))) {
    intent.maxFare = Math.round(fareOf(m[2], m[3]));
  } else if ((m = take(FARE_TRAILING_RE, (x) => { const v = fareOf(x[2], x[3]); return v >= 100 && v <= 100000; }))) {
    intent.maxFare = Math.round(fareOf(m[2], m[3]));
  }

  // 5) Departure time window
  const rangeMatch = find(RANGE_RE, (x) => resolveRange(x) !== null);
  if (rangeMatch) {
    const r = resolveRange(rangeMatch);
    blank(rangeMatch.index, rangeMatch[0].length);
    if (r === "overnight") {
      intent.warnings.push("Overnight time ranges aren't supported — use a window within one day.");
    } else if (r) {
      intent.departureAfter = hhmm(r.start);
      intent.departureBefore = hhmm(r.end);
    }
  } else {
    const a = take(AFTER_RE, (x) => resolveSingle(x) !== null);
    if (a) intent.departureAfter = hhmm(resolveSingle(a)!);
    const b = take(BEFORE_RE, (x) => resolveSingle(x) !== null);
    if (b) intent.departureBefore = hhmm(resolveSingle(b)!);
    if (intent.departureAfter && intent.departureBefore && intent.departureAfter >= intent.departureBefore) {
      intent.warnings.push("Overnight departure windows aren't supported — using only the earlier limit.");
      delete intent.departureBefore;
    }
  }
  if (!intent.departureAfter && !intent.departureBefore) {
    for (const part of DAYPARTS) {
      if (take(part.re)) {
        intent.departureAfter = part.after;
        intent.departureBefore = part.before;
        break;
      }
    }
  }

  // 6) Quota
  if (take(/\btatkal\b/i)) intent.quota = "Tatkal";
  else if (take(/\bsenior\s+citizens?(?:\s+quota)?\b/i)) intent.quota = "Senior Citizen";
  else if (take(/\bladies(?:\s+quota)?\b/i)) intent.quota = "Ladies";
  else if (take(/\bgeneral\s+quota\b/i)) intent.quota = "General";

  // 7) Stations
  let origin: Place | null = null;
  let dest: Place | null = null;
  const pair = ROUTE_FROM_TO.exec(w);
  if (pair) {
    origin = resolvePlace(pair[1]);
    dest = resolvePlace(pair[2]);
  } else {
    const rev = ROUTE_TO_FROM.exec(w);
    if (rev) {
      dest = resolvePlace(rev[1]);
      origin = resolvePlace(rev[2]);
    } else {
      const alias = ROUTE_ALIAS_PAIR.exec(w);
      if (alias) {
        origin = resolvePlace(alias[1]);
        dest = resolvePlace(alias[2]);
      } else {
        const only = ROUTE_FROM_ONLY.exec(w);
        if (only) origin = resolvePlace(only[1]);
        const d = matchDelhi(w);
        if (d && origin?.kind !== "delhi") dest = { kind: "delhi", code: d };
        else if (d && origin?.kind === "delhi") dest = null;
      }
    }
  }
  if (origin || dest) applyRoute(intent, origin, dest);

  // 8) What matters most
  let best: { emphasis: IntentEmphasis; index: number } | null = null;
  for (const { emphasis, re } of EMPHASIS_PATTERNS) {
    const em = re.exec(w);
    if (em && (!best || em.index < best.index)) best = { emphasis, index: em.index };
  }
  if (best) intent.emphasis = best.emphasis;

  return intent;
}

// ───────────────────────────── summary / chips ─────────────────────────────

export function understoodCount(i: BookingIntent): number {
  return [
    i.to,
    i.date,
    i.quota,
    i.classes?.length ? 1 : undefined,
    i.departureAfter || i.departureBefore ? 1 : undefined,
    i.maxFare,
    i.maxDuration,
    i.minSuccess,
    i.emphasis,
  ].filter((v) => v !== undefined).length;
}

function classesLabel(classes: TravelClass[]): string {
  const sorted = CLASS_DISPLAY_ORDER.filter((c) => classes.includes(c));
  if (sorted.length === AC_CLASSES.length && AC_CLASSES.every((c) => sorted.includes(c))) return "AC classes";
  return sorted.join(" · ");
}

export function describeIntent(i: BookingIntent): IntentChip[] {
  const chips: IntentChip[] = [];
  if (i.to) chips.push({ key: "route", label: `JP → ${i.to === "ALL_DELHI" ? "Delhi (all stations)" : i.to}` });
  if (i.date) chips.push({ key: "date", label: prettyChipDate(i.date) });
  if (i.quota) chips.push({ key: "quota", label: `${i.quota} quota` });
  if (i.classes?.length) chips.push({ key: "classes", label: classesLabel(i.classes) });
  if (i.departureAfter && i.departureBefore) chips.push({ key: "time", label: `Departs ${i.departureAfter}–${i.departureBefore}` });
  else if (i.departureAfter) chips.push({ key: "time", label: `Departs after ${i.departureAfter}` });
  else if (i.departureBefore) chips.push({ key: "time", label: `Departs before ${i.departureBefore}` });
  if (i.maxFare !== undefined) chips.push({ key: "fare", label: `Fare ≤ ₹${i.maxFare.toLocaleString("en-IN")}` });
  if (i.maxDuration !== undefined) chips.push({ key: "duration", label: `Journey ≤ ${i.maxDuration}h` });
  if (i.minSuccess !== undefined) chips.push({ key: "success", label: `Odds ≥ ${i.minSuccess}%` });
  if (i.emphasis) chips.push({ key: "emphasis", label: EMPHASIS_LABEL[i.emphasis] });
  i.warnings.forEach((label, idx) => chips.push({ key: `warn-${idx}`, label, warn: true }));
  return chips;
}

/** Converts the app-level intent into the visualizer's isolated hand-off shape. */
export function toVizIntent(i: BookingIntent, source: "instant" | "ai", nonce: number): VizIntent {
  const contextKeys = new Set(["route", "date", "quota", "emphasis"]);
  return {
    nonce,
    source,
    classes: i.classes,
    departureAfter: i.departureAfter,
    departureBefore: i.departureBefore,
    maxFare: i.maxFare,
    maxDuration: i.maxDuration,
    minSuccess: i.minSuccess,
    emphasis: i.emphasis,
    context: describeIntent(i).filter((c) => c.warn || contextKeys.has(c.key)),
  };
}

// ───────────────────────────── LLM output hardening ─────────────────────────────

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Validates untrusted LLM JSON. Every field is type-checked, range-checked and mapped to the same
 * rules as the instant parser; anything that fails is dropped (never guessed).
 */
export function sanitizeLlmIntent(raw: unknown, opts: ParseOptions = {}): BookingIntent {
  const out: BookingIntent = { warnings: [] };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const r = raw as Record<string, unknown>;
  const today = opts.today ?? new Date();
  const horizon = opts.horizonDays ?? DEFAULT_HORIZON_DAYS;
  const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string).trim().slice(0, 80) : "");
  const num = (k: string) => (typeof r[k] === "number" && Number.isFinite(r[k]) ? (r[k] as number) : null);

  const origin = str("origin") ? resolvePlace(str("origin")) : null;
  const dest = str("destination") ? resolvePlace(str("destination")) : null;
  if (origin || dest) applyRoute(out, origin, dest);

  const date = str("date");
  const dm = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dm) applyDate(out, validYMD(+dm[1], +dm[2], +dm[3]), date, today, horizon);

  const quota = str("quota").toLowerCase();
  if (quota === "tatkal") out.quota = "Tatkal";
  else if (quota === "general") out.quota = "General";
  else if (quota === "ladies") out.quota = "Ladies";
  else if (quota.startsWith("senior")) out.quota = "Senior Citizen";

  if (Array.isArray(r.classes)) {
    const set = new Set<TravelClass>();
    for (const c of r.classes) {
      if (typeof c !== "string") continue;
      const u = c.trim().toUpperCase();
      if (u === "AC") AC_CLASSES.forEach((x) => set.add(x));
      else if (u === "SLEEPER") set.add("SL");
      else if ((ALL_CLASSES as string[]).includes(u)) set.add(u as TravelClass);
    }
    if (set.size > 0 && set.size < ALL_CLASSES.length) out.classes = CLASS_DISPLAY_ORDER.filter((c) => set.has(c));
  }

  const after = str("departureAfter");
  const before = str("departureBefore");
  const okAfter = HHMM.test(after) ? after : undefined;
  const okBefore = HHMM.test(before) ? before : undefined;
  if (okAfter && okBefore && okAfter >= okBefore) {
    out.departureAfter = okAfter;
  } else {
    if (okAfter) out.departureAfter = okAfter;
    if (okBefore) out.departureBefore = okBefore;
  }

  const maxFare = num("maxFare");
  if (maxFare !== null && maxFare >= 100 && maxFare <= 100000) out.maxFare = Math.round(maxFare);
  const maxDuration = num("maxDurationHours");
  if (maxDuration !== null && maxDuration >= 0.5 && maxDuration <= 48) out.maxDuration = Math.round(maxDuration * 4) / 4;
  const minSuccess = num("minSuccessPercent");
  if (minSuccess !== null && minSuccess >= 1 && minSuccess <= 100) out.minSuccess = Math.round(clamp(minSuccess, 1, 100));

  const priority = str("priority").toLowerCase();
  if (priority === "success" || priority === "fare" || priority === "duration") out.emphasis = priority;

  if (Array.isArray(r.unsupported)) {
    for (const n of r.unsupported.slice(0, 2)) {
      if (typeof n !== "string") continue;
      const clean = n.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 120);
      if (clean) out.warnings.push(clean);
    }
  }
  return out;
}

/**
 * Strict re-validation of anything shaped like a `BookingIntent` that crossed a trust boundary
 * (e.g. the JSON body returned by `/api/ai-intent`). Guarantees every field is safe to feed into
 * app state: `to` is a real <select> value, `date` is inside the window, numbers are in range.
 */
export function normalizeBookingIntent(x: unknown, opts: ParseOptions = {}): BookingIntent {
  const out: BookingIntent = { warnings: [] };
  if (!x || typeof x !== "object" || Array.isArray(x)) return out;
  const r = x as Record<string, unknown>;
  const today = opts.today ?? new Date();
  const horizon = opts.horizonDays ?? DEFAULT_HORIZON_DAYS;

  if (typeof r.to === "string" && (r.to === "ALL_DELHI" || (DELHI_CODES as readonly string[]).includes(r.to))) out.to = r.to;

  if (typeof r.date === "string") {
    const dm = r.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const dt = dm ? validYMD(+dm[1], +dm[2], +dm[3]) : null;
    if (dt) {
      const diff = Math.round((startOfDay(dt).getTime() - startOfDay(today).getTime()) / 86400000);
      if (diff >= 0 && diff < horizon) out.date = toISODate(dt);
    }
  }

  if (r.quota === "General" || r.quota === "Tatkal" || r.quota === "Ladies" || r.quota === "Senior Citizen") out.quota = r.quota;

  if (Array.isArray(r.classes)) {
    const set = new Set<TravelClass>();
    for (const c of r.classes) if (typeof c === "string" && (ALL_CLASSES as string[]).includes(c)) set.add(c as TravelClass);
    if (set.size > 0 && set.size < ALL_CLASSES.length) out.classes = CLASS_DISPLAY_ORDER.filter((c) => set.has(c));
  }

  const after = typeof r.departureAfter === "string" && HHMM.test(r.departureAfter) ? r.departureAfter : undefined;
  const before = typeof r.departureBefore === "string" && HHMM.test(r.departureBefore) ? r.departureBefore : undefined;
  if (after) out.departureAfter = after;
  if (before && !(after && after >= before)) out.departureBefore = before;

  const n = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined);
  const maxFare = n(r.maxFare, 100, 100000);
  if (maxFare !== undefined) out.maxFare = Math.round(maxFare);
  const maxDuration = n(r.maxDuration, 0.5, 48);
  if (maxDuration !== undefined) out.maxDuration = maxDuration;
  const minSuccess = n(r.minSuccess, 1, 100);
  if (minSuccess !== undefined) out.minSuccess = Math.round(minSuccess);

  if (r.emphasis === "success" || r.emphasis === "fare" || r.emphasis === "duration") out.emphasis = r.emphasis;

  if (Array.isArray(r.warnings)) {
    for (const w of r.warnings.slice(0, 4)) {
      if (typeof w !== "string") continue;
      const clean = w.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 160);
      if (clean) out.warnings.push(clean);
    }
  }
  return out;
}

/**
 * Instant-parser fields win (explicit tokens are reliable); the LLM only fills gaps.
 * The departure window is treated as one unit so a half-read time can't be "completed" by a guess.
 */
export function mergeIntents(local: BookingIntent, llm: BookingIntent): BookingIntent {
  const hasLocalTime = local.departureAfter !== undefined || local.departureBefore !== undefined;
  const out: BookingIntent = {
    to: local.to ?? llm.to,
    date: local.date ?? llm.date,
    quota: local.quota ?? llm.quota,
    classes: local.classes ?? llm.classes,
    departureAfter: hasLocalTime ? local.departureAfter : llm.departureAfter,
    departureBefore: hasLocalTime ? local.departureBefore : llm.departureBefore,
    maxFare: local.maxFare ?? llm.maxFare,
    maxDuration: local.maxDuration ?? llm.maxDuration,
    minSuccess: local.minSuccess ?? llm.minSuccess,
    emphasis: local.emphasis ?? llm.emphasis,
    warnings: [...local.warnings],
  };
  for (const warning of llm.warnings) if (!out.warnings.includes(warning)) out.warnings.push(warning);
  return out;
}
