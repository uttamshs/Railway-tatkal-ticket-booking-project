/**
 * Tatkal booking window.
 *
 * IRCTC opens Tatkal one day before the journey date: AC classes at 10:00, Sleeper
 * at 11:00 (local/IST). The window stays open until the train departs.
 */

export type WindowPhase = "upcoming" | "open" | "closed";

export interface TatkalWindowState {
  phase: WindowPhase;
  opensAt: Date;
  /** Milliseconds until opening (only meaningful while `upcoming`). */
  msUntilOpen: number;
}

/** Parses "YYYY-MM-DD" as a LOCAL date (new Date("YYYY-MM-DD") would be UTC). */
function parseLocalDate(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
}

/**
 * @param journeyDate ISO date of the journey, e.g. "2026-10-28"
 * @param openTime    "10:00" (AC) or "11:00" (Sleeper)
 * @param departure   "HH:MM" departure time (window closes then)
 * @param now         injectable clock for tests
 * @returns the state, or null when `journeyDate` is missing/invalid
 */
export function getTatkalWindow(
  journeyDate: string | undefined,
  openTime: "10:00" | "11:00",
  departure: string,
  now: Date = new Date()
): TatkalWindowState | null {
  if (!journeyDate) return null;
  const day = parseLocalDate(journeyDate);
  if (!day) return null;

  const [oh, om] = openTime.split(":").map(Number);
  const opensAt = new Date(day);
  opensAt.setDate(opensAt.getDate() - 1);
  opensAt.setHours(oh, om, 0, 0);

  const [dh, dm] = departure.split(":").map(Number);
  const departsAt = new Date(day);
  departsAt.setHours(dh, dm, 0, 0);

  const t = now.getTime();
  if (t < opensAt.getTime()) {
    return { phase: "upcoming", opensAt, msUntilOpen: opensAt.getTime() - t };
  }
  if (t < departsAt.getTime()) return { phase: "open", opensAt, msUntilOpen: 0 };
  return { phase: "closed", opensAt, msUntilOpen: 0 };
}

/** 7_385_000 → "2h 03m 05s" (days are folded into hours' leading "Nd"). */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d > 0 ? `${d}d ` : ""}${h}h ${pad(m)}m ${pad(s)}s`;
}

/** "checked 3 min ago" style freshness text. */
export function formatAge(iso: string | undefined, now: Date = new Date()): string | null {
  if (!iso) return null;
  const diff = now.getTime() - Date.parse(iso);
  if (!isFinite(diff) || diff < 0) return null;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  return `${Math.floor(min / 60)} h ago`;
}
