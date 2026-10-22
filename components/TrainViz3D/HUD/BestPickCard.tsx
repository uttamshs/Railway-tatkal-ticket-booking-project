"use client";

import { ScoredOption, TatkalOption } from "../lib/types";

interface BestPickCardProps {
  best: ScoredOption | null;
  onBook: (option: TatkalOption) => void;
  onSelect: (id: string) => void;
}

const CLASS_COLOR: Record<TatkalOption["travelClass"], string> = {
  "1A": "#ffd700",
  "2A": "#c0c0c0",
  "3A": "#cd7f32",
  CC: "#4db8ff",
  EC: "#a78bfa",
  SL: "#6ee7b7",
};

const TYPE_EMOJI: Record<TatkalOption["trainType"], string> = {
  Rajdhani: "👑",
  Shatabdi: "⚡",
  "Vande Bharat": "🚄",
  Duronto: "🛤️",
  "Mail/Express": "🚂",
  "Double Decker": "🏗️",
  Superfast: "💨",
};

export default function BestPickCard({ best, onBook, onSelect }: BestPickCardProps) {
  if (!best) {
    return (
      <div
        style={{
          background: "rgba(14,24,34,0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: "16px 20px",
          color: "var(--muted)",
          textAlign: "center",
          fontSize: 13,
        }}
      >
        No trains match current filters.
      </div>
    );
  }

  const scorePercent = Math.round(best.compositeScore * 100);
  const clsColor = CLASS_COLOR[best.travelClass] ?? "var(--accent)";

  return (
    <div
      style={{
        background: "rgba(14,24,34,0.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "2px solid var(--accent)",
        borderRadius: 16,
        padding: "18px 20px",
        color: "var(--text)",
        cursor: "pointer",
      }}
      onClick={() => onSelect(best.id)}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span
          style={{
            background: "linear-gradient(135deg,#ffd700,#ff8c00)",
            color: "#000",
            fontWeight: 800,
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 99,
          }}
        >
          #1 BEST PICK
        </span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          Score {scorePercent}%
        </span>
        {best.paretoOptimal && (
          <span style={{ fontSize: 11, color: "#a78bfa" }}>◆ Pareto</span>
        )}
      </div>

      {/* Train name */}
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>
        {TYPE_EMOJI[best.trainType]} {best.trainName}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
        {best.trainNumber} ·{" "}
        <span style={{ color: clsColor, fontWeight: 600 }}>{best.travelClass}</span>
      </div>

      {/* Time row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        <span>{best.departureTime}</span>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>
          ──{best.duration.toFixed(1)}h──▶
        </span>
        <span>{best.arrivalTime}</span>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <StatPill label="Fare" value={`₹${best.fare.toLocaleString()}`} />
        <StatPill label="Success" value={`${best.tatkalSuccessChance}%`} />
        <StatPill
          label="Seats"
          value={best.seatsHint ?? "—"}
          warn={best.seatsHint?.startsWith("WL")}
        />
      </div>

      {/* Book button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onBook(best);
        }}
        style={{
          width: "100%",
          padding: "10px 0",
          background: "var(--accent)",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
          transition: "opacity 0.15s",
        }}
        onMouseEnter={(e) =>
          ((e.target as HTMLButtonElement).style.opacity = "0.85")
        }
        onMouseLeave={(e) =>
          ((e.target as HTMLButtonElement).style.opacity = "1")
        }
      >
        🎟️ Book Tatkal Now
      </button>
    </div>
  );
}

function StatPill({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: "6px 8px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 2 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: warn ? "#ff6b6b" : "var(--text)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
