"use client";

import { ScoredOption, TatkalOption } from "../lib/types";
import { glassPanel } from "../lib/theme";
import { btnActive, btnBase, btnPrimary, insetBox, pill } from "./ui";
import { Icon } from "./icons";
import { BasisBadge } from "./BasisBadge";

interface BestPickCardProps {
  best: ScoredOption | null;
  backup: ScoredOption | null;
  shouldPivot: boolean;
  pivotReason: string | null;
  elapsedSec: number;
  onBook: (option: TatkalOption, backupOption?: TatkalOption | null) => void;
  onSelect: (id: string) => void;
  onPromoteBackup: (backupId: string) => void;
  onToggleQuotaJump: (id: string) => void;
}

export default function BestPickCard({
  best,
  backup,
  shouldPivot,
  pivotReason,
  elapsedSec,
  onBook,
  onSelect,
  onPromoteBackup,
  onToggleQuotaJump,
}: BestPickCardProps) {
  if (!best) {
    return (
      <div style={{ ...glassPanel, color: "var(--viz-muted)", textAlign: "center", fontSize: 13 }}>
        No trains match the current filters.
      </div>
    );
  }

  const chance60 = best.chanceAt60s ?? best.tatkalSuccessChance;
  const qj = best.quotaJump;

  return (
    <div
      style={{
        ...glassPanel,
        border: "2px solid var(--viz-accent)",
        borderRadius: 16,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* ── Primary Plan A Header ── */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Primary Plan A: ${best.trainName}, ${best.travelClass}. Click to focus in 3D.`}
        onClick={() => onSelect(best.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(best.id);
          }
        }}
        style={{ cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, flexWrap: "wrap" }}>
          <span
            style={{
              background: "linear-gradient(135deg,#ffd54a,#ff9f1c)",
              color: "#1a1203",
              fontWeight: 800,
              fontSize: 10.5,
              padding: "2px 8px",
              borderRadius: 99,
            }}
          >
            #1 PLAN A
          </span>
          <span style={{ fontSize: 11, color: "var(--viz-muted)", fontVariantNumeric: "tabular-nums" }}>
            {best.seatsHint ?? "Available"}
          </span>
          {best.paretoOptimal && (
            <span
              style={{
                fontSize: 11,
                color: "var(--viz-pareto)",
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                fontWeight: 700,
                marginLeft: "auto",
              }}
            >
              <Icon name="diamond" size={11} /> Pareto
            </span>
          )}
        </div>

        <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="train" size={14} style={{ color: "var(--viz-accent)" }} />
          {best.trainName}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--viz-muted)",
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <span>{best.trainNumber}</span>
          <span style={pill}>{best.travelClass}</span>
          <span>
            {best.departureTime} → {best.arrivalTime} ({best.duration.toFixed(1)}h)
          </span>
          <BasisBadge basis={best.successBasis} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          <Stat label="Fare" value={`₹${best.fare.toLocaleString("en-IN")}`} />
          <Stat
            label={elapsedSec > 0 ? `Odds @ +${elapsedSec}s` : "Odds Now"}
            value={`${best.tatkalSuccessChance}%`}
            bad={best.tatkalSuccessChance < 50}
          />
          <Stat
            label="At UPI (+60s)"
            value={`${chance60}%`}
            bad={chance60 < 50}
          />
        </div>
      </div>

      {/* ── 2.3: 1-Click Quota-Jump Toggle on Plan A (if available) ── */}
      {qj && (
        <button
          type="button"
          className="tv3d-btn"
          data-active={best.quotaJumpActive}
          aria-pressed={best.quotaJumpActive}
          onClick={() => onToggleQuotaJump(best.id)}
          style={{
            ...(best.quotaJumpActive ? btnActive : btnBase),
            width: "100%",
            justifyContent: "space-between",
            padding: "5px 10px",
            fontSize: 11,
            borderRadius: 8,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 700 }}>
            <Icon name="zap" size={11} />
            {best.quotaJumpActive ? `Ajmer Pool On (Board ${qj.boardingCode})` : `Boost via Ajmer (${qj.originCode})`}
          </span>
          <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
            {best.quotaJumpActive ? `✓ +₹${qj.fareDelta}` : `+${qj.successGain}% (+₹${qj.fareDelta})`}
          </span>
        </button>
      )}

      {/* ── 2.2: Compact Auto-Backup B Row ── */}
      {backup && (
        <div
          style={{
            ...insetBox,
            padding: "7px 10px",
            borderRadius: 9,
            border: shouldPivot ? "1.5px solid var(--viz-warn)" : "1px solid var(--viz-line)",
            background: "var(--viz-inset)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, fontSize: 11.5 }}>
            <div
              onClick={() => onSelect(backup.id)}
              style={{ cursor: "pointer", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              title="Click to inspect Backup B in 3D"
            >
              <span style={{ color: "var(--viz-accent)", fontWeight: 800, marginRight: 5 }}>BACKUP B</span>
              <strong>{backup.trainNumber}</strong> · {backup.travelClass} · ₹{backup.fare.toLocaleString("en-IN")} ·{" "}
              <strong style={{ color: "var(--viz-good)" }}>{backup.tatkalSuccessChance}%</strong>
            </div>
            <button
              type="button"
              className="tv3d-btn"
              data-active={shouldPivot}
              onClick={() => onPromoteBackup(backup.id)}
              style={{
                ...(shouldPivot ? btnActive : btnBase),
                minHeight: 22,
                padding: "2px 8px",
                fontSize: 10.5,
                fontWeight: 700,
                flexShrink: 0,
              }}
              title="Swap Backup B into Plan A"
            >
              <Icon name="swap" size={10} /> {shouldPivot ? "Pivot" : "Swap"}
            </button>
          </div>

          {shouldPivot && pivotReason && (
            <div style={{ marginTop: 4, fontSize: 10.5, color: "var(--viz-warn)", fontWeight: 600 }}>
              ⚠ {pivotReason}
            </div>
          )}
        </div>
      )}

      {/* ── Primary Action Button ── */}
      <button
        type="button"
        className="tv3d-btn"
        data-active="true"
        style={btnPrimary}
        onClick={() => onBook(best, backup)}
      >
        <Icon name="ticket" size={16} />
        {backup ? `Book Plan A (+ Lock Backup B)` : "Book Tatkal now"}
      </button>
    </div>
  );
}

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div style={{ ...insetBox, textAlign: "center", padding: "5px 6px" }}>
      <div style={{ fontSize: 10, color: "var(--viz-muted)", marginBottom: 1 }}>{label}</div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: bad ? "var(--viz-bad)" : "var(--viz-text)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}
