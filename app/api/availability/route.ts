import { NextResponse } from "next/server";
import { configure, getAvailability } from "railkit";

const PUBLIC_BASE = process.env.RAIL_API_BASE_URL || "https://indian-railway-api.onrender.com";
const RR_BASE = process.env.RAILRADAR_BASE_URL || "https://api.railradar.in";
const TIMEOUT_MS = 4500;

// In-memory cache to conserve API quota and provide instantaneous responses (15-min TTL)
interface CacheEntry {
  source: string;
  live: boolean;
  checkedAt: string;
  status: string;
  fare?: number;
  data: any;
  timestamp: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function formatToDDMMYYYY(dStr: string): string {
  if (!dStr) return "";
  const trimmed = dStr.trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) return trimmed;
  const parts = trimmed.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    // YYYY-MM-DD -> DD-MM-YYYY
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return trimmed;
}

function normalizeQuota(qStr: string): string {
  const q = (qStr || "").toUpperCase().trim();
  if (q === "TATKAL" || q === "TQ") return "TQ";
  if (q === "LADIES" || q === "LD") return "LD";
  if (q === "SENIOR CITIZEN" || q === "SS") return "SS";
  return "GN";
}

async function jsonWithTimeout(url: string, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers, cache: "no-store", signal: controller.signal });
    const text = await r.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!r.ok) throw new Error(String(r.status));
    return body;
  } finally {
    clearTimeout(timer);
  }
}

function extractStatus(raw: any, date: string) {
  const d = raw?.data || raw;
  const day = d?.avlDayList?.find((x: any) => x?.availablityDate === date || x?.availabilityDate === date);
  const value = day?.availablityStatus || day?.availabilityStatus || d?.status || d?.availability;
  if (value !== undefined && value !== null) return String(value);
  if (typeof d?.available === "number") return d.available > 0 ? `${d.available} available` : "0 available";
  return "Live response received";
}

let isRailKitConfigured = false;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const train = (q.get("train") || "").trim();
  const from = (q.get("from") || "JP").trim();
  const to = (q.get("to") || "NDLS").trim();
  const rawDate = (q.get("date") || "").trim();
  const cls = (q.get("class") || "3A").trim().toUpperCase();
  const rawQuota = q.get("quota") || "GN";
  const quota = normalizeQuota(rawQuota);

  if (!train || !rawDate) {
    return NextResponse.json({ error: "train and date are required" }, { status: 400 });
  }

  const dateDDMM = formatToDDMMYYYY(rawDate);
  const cacheKey = `${train}:${from}:${to}:${dateDDMM}:${cls}:${quota}`;
  const now = Date.now();

  // 1. Check in-memory cache
  const cached = cache.get(cacheKey);
  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return NextResponse.json({
      ...cached,
      cached: true,
      cachedForMs: now - cached.timestamp
    });
  }

  // 2. Primary Provider: RailKit (Active Indian Railways live availability SDK)
  const railkitKey = process.env.RAILKIT_API_KEY;
  if (railkitKey) {
    try {
      if (!isRailKitConfigured) {
        configure(railkitKey);
        isRailKitConfigured = true;
      }

      const res = await getAvailability(train, from, to, dateDDMM, cls, quota);
      if (res && res.success && res.data) {
        const avList = res.data.availability || [];
        const primary = avList[0];
        const statusText = primary?.availabilityText || primary?.status || "Live available";
        const fare = res.data.fare?.totalFare;

        const payload: CacheEntry = {
          source: "railkit",
          live: true,
          checkedAt: new Date().toISOString(),
          status: statusText,
          fare,
          data: res.data,
          timestamp: now
        };

        // Cache the successful live result
        cache.set(cacheKey, payload);

        return NextResponse.json({
          source: payload.source,
          live: payload.live,
          checkedAt: payload.checkedAt,
          status: payload.status,
          fare: payload.fare,
          rawStatus: primary?.rawStatus,
          prediction: primary?.prediction,
          data: payload.data
        });
      }
    } catch (rkErr) {
      console.warn(`[RailKit] Live query for ${train} (${cls}) fell back:`, rkErr instanceof Error ? rkErr.message : rkErr);
    }
  }

  // 3. Secondary Provider: RailRadar and Public Community API
  const rrKey = process.env.RAILRADAR_API_KEY;
  const fallbackRequests: Array<Promise<any>> = [];

  if (rrKey) {
    fallbackRequests.push(
      jsonWithTimeout(
        `${RR_BASE}/v1/trains/${encodeURIComponent(train)}/seats?journeyDate=${encodeURIComponent(rawDate)}&source=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}&classCode=${encodeURIComponent(cls)}&quotaCode=${encodeURIComponent(quota)}`,
        { Authorization: `Bearer ${rrKey}` }
      ).then(data => ({ source: "railradar", data, status: extractStatus(data, rawDate) }))
    );
  }

  fallbackRequests.push(
    jsonWithTimeout(
      `${PUBLIC_BASE}/api/availability?train=${encodeURIComponent(train)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${encodeURIComponent(rawDate)}&class=${encodeURIComponent(cls)}`
    ).then(data => ({ source: "public-indian-railway-api", data, status: extractStatus(data, rawDate) }))
  );

  try {
    const winner = await Promise.any(fallbackRequests);
    const payload: CacheEntry = {
      source: winner.source,
      live: true,
      checkedAt: new Date().toISOString(),
      status: winner.status,
      data: winner.data?.data || winner.data,
      timestamp: now
    };
    cache.set(cacheKey, payload);
    return NextResponse.json({
      source: payload.source,
      live: true,
      checkedAt: payload.checkedAt,
      status: payload.status,
      data: payload.data
    });
  } catch {
    return NextResponse.json({
      source: "unavailable",
      live: false,
      error: "Live availability is temporarily unavailable. Reference timetable active."
    }, { status: 502 });
  }
}
