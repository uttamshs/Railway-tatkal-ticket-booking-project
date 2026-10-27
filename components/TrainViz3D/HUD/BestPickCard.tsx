"use client";

import { ScoredOption, TatkalOption } from "../lib/types";
import { glassPanel } from "../lib/theme";
import { btnPrimary, insetBox, pill } from "./ui";
import { Icon } from "./icons";
import { BasisBadge } from "./BasisBadge";

interface BestPickCardProps {
  best: ScoredOption | null;
  onBook: (option: TatkalOption) => void;
  onSelect: (id: string) => void;
}

export default function BestPickCard({ best, onBook, onSelect }: BestPickCardProps) {
  if (!best) {
    return (
      <div style={{ ...glassPanel, color: "var(--viz-muted)", textAlign: "center", fontSize: 13 }}>
        No trains match the current filters.
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Best pick: ${best.trainName}, ${best.travelClass}. Press Enter to focus it in the scene.`}
      onClick={() => onSelect(best.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(best.id);
        }
      }}
      style={{ ...glassPanel, border: "2px solid var(--viz-accent)", borderRadius: 16, padding: "14px 16px", cursor: "pointer" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <span
          style={{
            background: "linear-gradient(135deg,#ffd54a,#ff9f1c)",
            color: "#1a1203",
            fontWeight: 800,
            fontSize: 11,
            padding: "2px 9px",
            borderRadius: 99,
          }}
        >
          #1 BEST PICK
        </span>
        <span style={{ fontSize: 12, color: "var(--viz-muted)" }}>Score {Math.round(best.compositeScore * 100)}%</span>
        {best.paretoOptimal && (
          <span style={{ fontSize: 11, color: "var(--viz-pareto)", display: "inline-flex", alignItems: "center", gap: 3, fontWeight: 700 }}>
            <Icon name="diamond" size={11} /> Pareto
          </span>
        )}
      </div>

      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name="train" size={16} style={{ color: "var(--viz-accent)" }} />
        {best.trainName}
      </div>
      <div style={{ fontSize: 12, color: "var(--viz-muted)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        {best.trainNumber}
        <span style={pill}>{best.travelClass}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 15, fontWeight: 600 }}>
        <span>{best.departureTime}</span>
        <span style={{ color: "var(--viz-muted)", fontSize: 12 }}>── {best.duration.toFixed(1)}h ──▶</span>
        <span>{best.arrivalTime}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
        <Stat label={best.fareBasis === "live" ? "Fare" : "Fare (est.)"} value={`₹${best.fare.toLocaleString("en-IN")}`} />
        <Stat label="Success (est.)" value={`${best.tatkalSuccessChance}%`} />
        <Stat label="Seats" value={best.seatsHint ?? "—"} bad={best.seatsHint?.toUpperCase().includes("WL")} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <BasisBadge basis={best.successBasis} />
      </div>

      <button
        type="button"
        className="tv3d-btn"
        data-active="true"
        style={btnPrimary}
        onClick={(e) => {
          e.stopPropagation();
          onBook(best);
        }}
      >
        <Icon name="ticket" size={16} /> Book Tatkal now
      </button>
    </div>
  );
}

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div style={{ ...insetBox, textAlign: "center", padding: "6px 8px" }}>
      <div style={{ fontSize: 10, color: "var(--viz-muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: bad ? "var(--viz-bad)" : "var(--viz-text)" }}>{value}</div>
    </div>
  );
}
