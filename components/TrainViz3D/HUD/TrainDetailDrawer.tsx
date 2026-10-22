"use client";

import { useEffect, useState } from "react";
import { ScoredOption, TatkalOption } from "../lib/types";

interface TrainDetailDrawerProps {
  option: ScoredOption | null;
  onClose: () => void;
  onBook: (option: TatkalOption) => void;
  isMobile?: boolean;
}

const AMENITY_ICONS: Record<string, string> = {
  AC: "❄️",
  Bedding: "🛏️",
  Catering: "🍱",
  Charging: "🔌",
  "Wi-Fi": "📶",
  Lounge: "🛋️",
  "Wide Seat": "💺",
  Fan: "🌀",
};

function getCountdown(openTime: "10:00" | "11:00"): string {
  const now = new Date();
  const [h, m] = openTime.split(":").map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const diff = target.getTime() - now.getTime();
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return `${hours}h ${mins}m`;
}

export default function TrainDetailDrawer({
  option,
  onClose,
  onBook,
  isMobile = false,
}: TrainDetailDrawerProps) {
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (!option) return;
    setCountdown(getCountdown(option.tatkalOpenTime));
    const timer = setInterval(() => {
      setCountdown(getCountdown(option.tatkalOpenTime));
    }, 30_000);
    return () => clearInterval(timer);
  }, [option]);

  if (!option) return null;

  const drawerStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: "60vh",
        overflowY: "auto",
        borderRadius: "16px 16px 0 0",
        zIndex: 200,
      }
    : {
        position: "relative",
        height: "100%",
        overflowY: "auto",
        borderRadius: 16,
      };

  return (
    <div
      style={{
        background: "rgba(14,24,34,0.95)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid var(--line)",
        padding: "20px",
        color: "var(--text)",
        ...drawerStyle,
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: "4px 10px",
          color: "var(--text)",
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        ✕
      </button>

      {/* Train identity */}
      <div style={{ marginBottom: 16, paddingRight: 40 }}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 2 }}>
          {option.trainName}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          {option.trainNumber} · {option.trainType} ·{" "}
          <strong style={{ color: "var(--accent)" }}>{option.travelClass}</strong>
        </div>
      </div>

      {/* Route */}
      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          borderRadius: 10,
          padding: "10px 14px",
          marginBottom: 12,
          fontSize: 13,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          {option.fromStation}
          <span style={{ color: "var(--muted)", margin: "0 8px" }}>→</span>
          {option.toStation}
        </div>
        <div style={{ color: "var(--muted)" }}>
          {option.departureTime} → {option.arrivalTime} · {option.duration.toFixed(2)}h
        </div>
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginBottom: 12,
        }}
      >
        {[
          ["Tatkal Fare", `₹${option.fare.toLocaleString()}`],
          ["Success Chance", `${option.tatkalSuccessChance}%`],
          ["Composite Score", `${Math.round(option.compositeScore * 100)}%`],
          ["Rank", `#${option.rank} of all`],
          ["Seats", option.seatsHint || "Live Checking..."],
          ["Pareto", option.paretoOptimal ? "◆ Optimal" : "—"],
        ].map(([label, val]) => (
          <div
            key={label}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: "8px 10px",
            }}
          >
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 2 }}>
              {label}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {label === "Seats" ? (
                <span style={{ color: val.startsWith("AVL") ? "#10b981" : val.startsWith("WL") ? "#ef4444" : "var(--accent)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: val.startsWith("AVL") ? "#10b981" : val.startsWith("WL") ? "#ef4444" : "var(--accent)" }} />
                  {val} {val.startsWith("AVL") || val.startsWith("WL") ? "• Live" : ""}
                </span>
              ) : (
                val
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Tatkal opening time */}
      <div
        style={{
          background: "rgba(var(--accent-rgb, 99,102,241),0.15)",
          border: "1px solid var(--accent)",
          borderRadius: 10,
          padding: "10px 14px",
          marginBottom: 14,
          fontSize: 12,
        }}
      >
        <div style={{ fontWeight: 700, color: "var(--accent)", marginBottom: 2 }}>
          ⏰ Tatkal Opens at {option.tatkalOpenTime}
        </div>
        <div style={{ color: "var(--muted)" }}>
          Countdown: <strong style={{ color: "var(--text)" }}>{countdown}</strong>
        </div>
      </div>

      {/* Amenities */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase" }}>
          Amenities
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {option.amenities.map((a) => (
            <span
              key={a}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid var(--line)",
                borderRadius: 20,
                padding: "3px 10px",
                fontSize: 12,
              }}
            >
              {AMENITY_ICONS[a] ?? "•"} {a}
            </span>
          ))}
        </div>
      </div>

      {/* Book button */}
      <button
        onClick={() => onBook(option)}
        style={{
          width: "100%",
          padding: "12px 0",
          background: "var(--accent)",
          color: "#fff",
          border: "none",
          borderRadius: 12,
          fontWeight: 700,
          fontSize: 15,
          cursor: "pointer",
        }}
      >
        🎟️ Book Tatkal Now
      </button>
    </div>
  );
}
