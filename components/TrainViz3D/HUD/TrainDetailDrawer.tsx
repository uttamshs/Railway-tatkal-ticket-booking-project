"use client";

import { useEffect, useState } from "react";
import { ScoredOption, TatkalOption } from "../lib/types";
import { getTatkalWindow, formatCountdown, formatAge } from "../lib/tatkalWindow";
import { btnBase, btnPrimary, insetBox, pill } from "./ui";
import { Icon } from "./icons";
import { BasisBadge } from "./BasisBadge";

interface TrainDetailDrawerProps {
  option: ScoredOption;
  journeyDate?: string;
  seatsPending: boolean;
  onClose: () => void;
  onBook: (option: TatkalOption) => void;
  onRefreshSeats: (option: TatkalOption) => void;
}

/** Re-renders every second, but only while `active` (a countdown is visible). */
function useNow(active: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export default function TrainDetailDrawer({
  option,
  journeyDate,
  seatsPending,
  onClose,
  onBook,
  onRefreshSeats,
}: TrainDetailDrawerProps) {
  const win0 = getTatkalWindow(journeyDate, option.tatkalOpenTime, option.departureTime);
  const now = useNow(win0?.phase === "upcoming");
  const win = getTatkalWindow(journeyDate, option.tatkalOpenTime, option.departureTime, now);
  const age = formatAge(option.seatsCheckedAt, now);

  const seats = option.seatsHint;
  const seatsUpper = seats?.toUpperCase() ?? "";
  const seatColor = seatsUpper.includes("WL") ? "var(--viz-bad)" : seatsUpper.includes("RAC") ? "var(--viz-warn)" : "var(--viz-good)";

  const stats: [string, string][] = [
    [option.fareBasis === "live" ? "Tatkal fare" : "Tatkal fare (est.)", `₹${option.fare.toLocaleString("en-IN")}`],
    ["Success chance (est.)", `${option.tatkalSuccessChance}%`],
    ["Overall score", `${Math.round(option.compositeScore * 100)}%`],
    ["Rank", `#${option.rank}`],
  ];

  return (
    <div
      style={{
        background: "var(--viz-panel)", border: "1px solid var(--viz-line)", borderRadius: 16,
        padding: 18, color: "var(--viz-text)", position: "relative", minHeight: 0,
      }}
    >
      <button
        type="button"
        className="tv3d-btn"
        aria-label="Close details"
        onClick={onClose}
        style={{ ...btnBase, position: "absolute", top: 10, right: 10, padding: 6, minHeight: 28, minWidth: 28 }}
      >
        <Icon name="close" size={14} />
      </button>

      <div style={{ marginBottom: 14, paddingRight: 36 }}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{option.trainName}</div>
        <div style={{ fontSize: 12, color: "var(--viz-muted)", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {option.trainNumber} · {option.trainType}
          <span style={pill}>{option.travelClass}</span>
          {option.paretoOptimal && (
            <span style={{ ...pill, color: "var(--viz-pareto)", borderColor: "var(--viz-pareto)" }}>
              <Icon name="diamond" size={10} /> Pareto-optimal
            </span>
          )}
        </div>
      </div>

      <div style={{ ...insetBox, marginBottom: 10, fontSize: 13 }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>
          {option.fromStation} <span style={{ color: "var(--viz-muted)", margin: "0 6px" }}>→</span> {option.toStation}
        </div>
        <div style={{ color: "var(--viz-muted)" }}>
          {option.departureTime} → {option.arrivalTime} · {option.duration.toFixed(2)} h
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        {stats.map(([label, val]) => (
          <div key={label} style={insetBox}>
            <div style={{ fontSize: 10, color: "var(--viz-muted)", marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Seats + provenance */}
      <div style={{ ...insetBox, marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--viz-muted)", marginBottom: 2 }}>Seats</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: seats ? seatColor : "var(--viz-muted)" }}>
              {seats ?? (seatsPending ? "Checking…" : "Not checked yet")}
            </div>
          </div>
          <BasisBadge basis={option.successBasis} />
        </div>
        <div style={{ fontSize: 11, color: "var(--viz-muted)", marginTop: 6, lineHeight: 1.45 }}>
          {option.successNote}
          {age && <> Checked {age}.</>}
        </div>
        <button
          type="button"
          className="tv3d-btn"
          disabled={seatsPending}
          onClick={() => onRefreshSeats(option)}
          style={{ ...btnBase, marginTop: 8, fontSize: 11, minHeight: 26 }}
        >
          <Icon name="refresh" size={12} /> {seatsPending ? "Checking…" : "Refresh seats"}
        </button>
      </div>

      {/* Tatkal window */}
      <div style={{ background: "var(--viz-accent-soft)", border: "1px solid var(--viz-accent)", borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 12 }}>
        <div style={{ fontWeight: 700, color: "var(--viz-accent)", marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="clock" size={13} /> Tatkal opens {option.tatkalOpenTime} the day before
        </div>
        <div style={{ color: "var(--viz-text)" }}>
          {win === null && "Pick a journey date to see the countdown."}
          {win?.phase === "upcoming" && (
            <>Opens in <strong style={{ fontVariantNumeric: "tabular-nums" }}>{formatCountdown(win.msUntilOpen)}</strong></>
          )}
          {win?.phase === "open" && <strong>Window is open now</strong>}
          {win?.phase === "closed" && "Booking window has closed for this departure."}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "var(--viz-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Amenities
        </div>
        {option.amenities.length === 0 ? (
          <span style={{ fontSize: 12, color: "var(--viz-muted)" }}>Not listed by the timetable feed.</span>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {option.amenities.map((a) => (
              <span key={a} style={{ ...pill, fontWeight: 500 }}>{a}</span>
            ))}
          </div>
        )}
      </div>

      <button type="button" className="tv3d-btn" data-active="true" style={btnPrimary} onClick={() => onBook(option)}>
        <Icon name="ticket" size={16} /> Book Tatkal now
      </button>
    </div>
  );
}
