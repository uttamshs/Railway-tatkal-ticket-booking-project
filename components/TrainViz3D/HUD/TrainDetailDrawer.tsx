"use client";

import { useEffect, useState } from "react";
import { ScoredOption, TatkalOption } from "../lib/types";
import { getTatkalWindow, formatCountdown, formatAge } from "../lib/tatkalWindow";
import { btnActive, btnBase, btnPrimary, insetBox, pill } from "./ui";
import { Icon } from "./icons";
import { BasisBadge } from "./BasisBadge";

interface TrainDetailDrawerProps {
  option: ScoredOption;
  backupOption: ScoredOption | null;
  elapsedSec: number;
  journeyDate?: string;
  seatsPending: boolean;
  onClose: () => void;
  onBook: (option: TatkalOption, backupOption?: TatkalOption | null) => void;
  onRefreshSeats: (option: TatkalOption) => void;
  onToggleQuotaJump: (id: string) => void;
  onPinBackup: (id: string) => void;
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
  backupOption,
  elapsedSec,
  journeyDate,
  seatsPending,
  onClose,
  onBook,
  onRefreshSeats,
  onToggleQuotaJump,
  onPinBackup,
}: TrainDetailDrawerProps) {
  const win0 = getTatkalWindow(journeyDate, option.tatkalOpenTime, option.departureTime);
  const now = useNow(win0?.phase === "upcoming");
  const win = getTatkalWindow(journeyDate, option.tatkalOpenTime, option.departureTime, now);
  const age = formatAge(option.seatsCheckedAt, now);

  const seats = option.seatsHint;
  const seatsUpper = seats?.toUpperCase() ?? "";
  const seatColor = seatsUpper.includes("WL") ? "var(--viz-bad)" : seatsUpper.includes("RAC") ? "var(--viz-warn)" : "var(--viz-good)";

  const chance60 = option.chanceAt60s ?? option.tatkalSuccessChance;
  const drop60 = option.velocityDrop60s ?? 0;
  const qj = option.quotaJump;

  const stats: [string, string][] = [
    [option.fareBasis === "live" ? "Tatkal fare" : "Tatkal fare (est.)", `₹${option.fare.toLocaleString("en-IN")}`],
    [elapsedSec > 0 ? `Success @ T+${elapsedSec}s` : "Success chance", `${option.tatkalSuccessChance}%`],
    ["+60s survival hold", `${chance60}%${drop60 > 0 ? ` (−${drop60}%)` : ""}`],
    ["Rank & Score", `#${option.rank} (${Math.round(option.compositeScore * 100)}%)`],
  ];

  return (
    <div
      style={{
        background: "var(--viz-panel)",
        border: "1px solid var(--viz-line)",
        borderRadius: 16,
        padding: 16,
        color: "var(--viz-text)",
        position: "relative",
        minHeight: 0,
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

      <div style={{ marginBottom: 12, paddingRight: 36 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{option.trainName}</div>
        <div style={{ fontSize: 12, color: "var(--viz-muted)", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {option.trainNumber} · {option.trainType}
          <span style={pill}>{option.travelClass}</span>
          {option.paretoOptimal && (
            <span style={{ ...pill, color: "var(--viz-pareto)", border: "1px solid var(--viz-pareto)" }}>
              <Icon name="diamond" size={10} /> Pareto-optimal
            </span>
          )}
        </div>
      </div>

      <div style={{ ...insetBox, marginBottom: 10, fontSize: 12.5 }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>
          {option.quotaJumpActive && qj ? `${qj.originStation} (Board ${qj.boardingCode})` : option.fromStation}
          <span style={{ color: "var(--viz-muted)", margin: "0 6px" }}>→</span>
          {option.toStation}
        </div>
        <div style={{ color: "var(--viz-muted)" }}>
          {option.departureTime} → {option.arrivalTime} · {option.duration.toFixed(2)} h
          {option.depletionPerMin ? ` · ~${option.depletionPerMin} seats/min rush drain` : ""}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        {stats.map(([label, val]) => (
          <div key={label} style={insetBox}>
            <div style={{ fontSize: 10, color: "var(--viz-muted)", marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Feature 2.3: Spatial Quota-Jump Arbitrage Section */}
      {qj && (
        <div
          style={{
            ...insetBox,
            marginBottom: 10,
            border: option.quotaJumpActive ? "1.5px solid var(--viz-accent)" : "1px solid var(--viz-line)",
            background: option.quotaJumpActive ? "var(--viz-accent-soft)" : "var(--viz-inset)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--viz-accent)", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Icon name="zap" size={12} /> SPATIAL QUOTA-JUMP ARBITRAGE
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--viz-good)" }}>
              +{qj.successGain}% odds · +₹{qj.fareDelta}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--viz-muted)", lineHeight: 1.4, marginBottom: 8 }}>
            Origin pool at <strong>{qj.originStation} ({qj.originCode})</strong> holds{" "}
            <strong style={{ color: "var(--viz-text)" }}>{qj.originSeatsHint}</strong> ({qj.originSuccessChance}% odds).{" "}
            {qj.ruleCitation}
          </div>
          <button
            type="button"
            className="tv3d-btn"
            data-active={option.quotaJumpActive}
            aria-pressed={option.quotaJumpActive}
            onClick={() => onToggleQuotaJump(option.id)}
            style={{
              ...(option.quotaJumpActive ? btnActive : btnBase),
              width: "100%",
              justifyContent: "center",
              fontSize: 11.5,
              minHeight: 28,
            }}
          >
            <Icon name="zap" size={12} />
            {option.quotaJumpActive
              ? `Quota-Jump Active (${qj.originCode} → ${option.toCode}, Board ${qj.boardingCode})`
              : `Activate ${qj.originCode} Origin Quota-Jump (+₹${qj.fareDelta})`}
          </button>
        </div>
      )}

      {/* Seats + provenance */}
      <div style={{ ...insetBox, marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--viz-muted)", marginBottom: 2 }}>
              Seats {elapsedSec > 0 ? `(projected @ T+${elapsedSec}s)` : ""}
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: seats ? seatColor : "var(--viz-muted)" }}>
              {seats ?? (seatsPending ? "Checking…" : "Not checked yet")}
            </div>
          </div>
          <BasisBadge basis={option.successBasis} />
        </div>
        <div style={{ fontSize: 11, color: "var(--viz-muted)", marginTop: 6, lineHeight: 1.45 }}>
          {option.successNote}
          {age && <> Checked {age}.</>}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="tv3d-btn"
            disabled={seatsPending}
            onClick={() => onRefreshSeats(option)}
            style={{ ...btnBase, fontSize: 11, minHeight: 26 }}
          >
            <Icon name="refresh" size={12} /> {seatsPending ? "Checking…" : "Refresh seats"}
          </button>
          {backupOption?.id !== option.id && (
            <button
              type="button"
              className="tv3d-btn"
              onClick={() => onPinBackup(option.id)}
              style={{ ...btnBase, fontSize: 11, minHeight: 26 }}
              title="Pin this option as your Backup B"
            >
              <Icon name="shield" size={12} /> Pin as Backup B
            </button>
          )}
        </div>
      </div>

      {/* Tatkal window */}
      <div
        style={{
          background: "var(--viz-accent-soft)",
          border: "1px solid var(--viz-accent)",
          borderRadius: 10,
          padding: "9px 12px",
          marginBottom: 12,
          fontSize: 12,
        }}
      >
        <div style={{ fontWeight: 700, color: "var(--viz-accent)", marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="clock" size={13} /> Tatkal opens {option.tatkalOpenTime} the day before
        </div>
        <div style={{ color: "var(--viz-text)" }}>
          {win === null && "Pick a journey date to see the countdown."}
          {win?.phase === "upcoming" && (
            <>
              Opens in <strong style={{ fontVariantNumeric: "tabular-nums" }}>{formatCountdown(win.msUntilOpen)}</strong>
            </>
          )}
          {win?.phase === "open" && <strong>Window is open now</strong>}
          {win?.phase === "closed" && "Booking window has closed for this departure."}
        </div>
      </div>

      <button type="button" className="tv3d-btn" data-active="true" style={btnPrimary} onClick={() => onBook(option, backupOption)}>
        <Icon name="ticket" size={16} /> Book {option.trainNumber} ({option.travelClass}) Now
      </button>
    </div>
  );
}
