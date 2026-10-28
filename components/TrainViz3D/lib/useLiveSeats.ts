"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Train } from "../../../lib/types";
import { SeatMap, SeatReading, seatKey } from "./realTrainAdapter";

/** Providers that read real inventory. Anything else (e.g. "verified-timetable") is a static baseline. */
const LIVE_SOURCES = new Set(["railkit", "railradar", "public-indian-railway-api"]);

const MAX_CONCURRENCY = 3;
const REQUEST_TIMEOUT_MS = 9000;
const FRESH_MS = 10 * 60 * 1000;

export interface SeatRequest {
  train: Train;
  cls: string;
}

export interface UseLiveSeats {
  seats: SeatMap;
  /** Number of in-flight or queued requests. */
  pending: number;
  /** Number of requests that failed since the last refresh (shown honestly in the UI). */
  failed: number;
  /** Queue seat reads (skips fresh ones unless `force`). */
  request: (reqs: SeatRequest[], force?: boolean) => void;
}

/**
 * Fetches seat availability from /api/availability with a small concurrency limit.
 *
 * Honesty rules:
 *  - a failed request stores NOTHING (no "AVL Available" placeholder);
 *  - the provider `source` decides whether a reading counts as "live" or "baseline";
 *  - a generic status without a seat count is kept as-is and later parsed as unknown.
 */
export function useLiveSeats(journeyDate: string | undefined): UseLiveSeats {
  const [seats, setSeats] = useState<SeatMap>({});
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);

  const queueRef = useRef<SeatRequest[]>([]);
  const inFlightRef = useRef<Set<string>>(new Set());
  const seatsRef = useRef<SeatMap>({});
  const activeRef = useRef(0);
  const aliveRef = useRef(true);
  const controllersRef = useRef<Set<AbortController>>(new Set());
  const dateRef = useRef(journeyDate);

  useEffect(() => {
    aliveRef.current = true;
    const controllers = controllersRef.current;
    return () => {
      aliveRef.current = false;
      controllers.forEach((c) => c.abort());
      controllers.clear();
    };
  }, []);

  // A new journey date invalidates every reading.
  useEffect(() => {
    if (dateRef.current === journeyDate) return;
    dateRef.current = journeyDate;
    queueRef.current = [];
    controllersRef.current.forEach((c) => c.abort());
    seatsRef.current = {};
    setSeats({});
    setFailed(0);
    setPending(0);
  }, [journeyDate]);

  const pump = useCallback(() => {
    while (activeRef.current < MAX_CONCURRENCY && queueRef.current.length > 0) {
      const { train, cls } = queueRef.current.shift() as SeatRequest;
      const key = seatKey(train, cls);
      activeRef.current += 1;
      inFlightRef.current.add(key);

      const controller = new AbortController();
      controllersRef.current.add(controller);
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const date = dateRef.current ?? new Date().toISOString().slice(0, 10);
      const url =
        `/api/availability?train=${encodeURIComponent(train.number)}` +
        `&from=${encodeURIComponent(train.fromCode)}&to=${encodeURIComponent(train.toCode)}` +
        `&date=${encodeURIComponent(date)}&class=${encodeURIComponent(cls)}&quota=TQ`;

      fetch(url, { cache: "no-store", signal: controller.signal })
        .then(async (res) => {
          const body = await res.json();
          if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
          const status = String(body?.status ?? "").trim();
          const reading: SeatReading = {
            status,
            originStatus: typeof body?.originStatus === "string" ? body.originStatus : undefined,
            basis: LIVE_SOURCES.has(String(body?.source)) && body?.live !== false ? "live" : "baseline",
            checkedAt: typeof body?.checkedAt === "string" ? body.checkedAt : new Date().toISOString(),
            fare: typeof body?.fare === "number" ? body.fare : undefined,
          };
          if (aliveRef.current && dateRef.current === date) {
            seatsRef.current = { ...seatsRef.current, [key]: reading };
            setSeats(seatsRef.current);
          }
        })
        .catch(() => {
          if (aliveRef.current) setFailed((n) => n + 1);
        })
        .finally(() => {
          clearTimeout(timer);
          controllersRef.current.delete(controller);
          inFlightRef.current.delete(key);
          activeRef.current -= 1;
          if (aliveRef.current) {
            setPending(queueRef.current.length + activeRef.current);
            pump();
          }
        });
    }
    setPending(queueRef.current.length + activeRef.current);
  }, []);

  const request = useCallback(
    (reqs: SeatRequest[], force = false) => {
      if (force) setFailed(0);
      const now = Date.now();
      for (const r of reqs) {
        const key = seatKey(r.train, r.cls);
        if (inFlightRef.current.has(key)) continue;
        if (queueRef.current.some((q) => seatKey(q.train, q.cls) === key)) continue;
        const existing = seatsRef.current[key];
        const fresh = existing?.checkedAt && now - Date.parse(existing.checkedAt) < FRESH_MS;
        if (existing && fresh && !force) continue;
        queueRef.current.push(r);
      }
      pump();
    },
    [pump]
  );

  return { seats, pending, failed, request };
}
