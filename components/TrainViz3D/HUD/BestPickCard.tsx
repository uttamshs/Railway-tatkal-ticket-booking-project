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

  const drop60 = best.velocityDrop60s ?? 0;
  const chance60 = best.chanceAt60s ?? best.tatkalSuccessChance;
  const qj = best.quotaJump;

  return (
    <div
      style={{
        ...glassPanel,
        border: "2px solid var(--viz-accent)",
        borderRadius: 16,
        padding: "13px 15px",
        display: "flex",
        flexDirection: "column",
        gap: 9,
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
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
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
          <span style={{ fontSize: 11.5, color: "var(--viz-muted)", fontVariantNumeric: "tabular-nums" }}>
            Score {Math.round(best.compositeScore * 100)}%
            {elapsedSec > 0 ? ` · T+${elapsedSec}s` : ""}
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
              }}
            >
              <Icon name="diamond" size={11} /> Pareto
            </span>
          )}
        </div>

        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="train" size={15} style={{ color: "var(--viz-accent)" }} />
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
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          <Stat label={best.fareBasis === "live" ? "Fare" : "Fare (est.)"} value={`₹${best.fare.toLocaleString("en-IN")}`} />
          <Stat
            label={elapsedSec > 0 ? `Odds @ +${elapsedSec}s` : "Success"}
            value={`${best.tatkalSuccessChance}%`}
            bad={best.tatkalSuccessChance < 50}
          />
          <Stat
            label="+60s Hold"
            value={`${chance60}%${drop60 >= 8 ? ` (↓${drop60})` : ""}`}
            bad={chance60 < 50}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 7, gap: 6, flexWrap: "wrap" }}>
          <BasisBadge basis={best.successBasis} />
          <span style={{ fontSize: 11, color: "var(--viz-muted)", fontVariantNumeric: "tabular-nums" }}>
            Seats: <strong style={{ color: "var(--viz-text)" }}>{best.seatsHint ?? "—"}</strong>
          </span>
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
            padding: "6px 10px",
            fontSize: 11,
            borderRadius: 9,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 700 }}>
            <Icon name="zap" size={12} />
            {best.quotaJumpActive
              ? `Quota-Jump Active (${qj.originCode} → ${best.toCode}, Board ${qj.boardingCode})`
              : `Quota-Jump: Book from ${qj.originCode} (Board ${qj.boardingCode})`}
          </span>
          <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
            {best.quotaJumpActive ? `✓ +₹${qj.fareDelta}` : `+${qj.successGain}% odds (+₹${qj.fareDelta})`}
          </span>
        </button>
      )}

      {/* ── 2.2: Always-Available Auto-Backup B (Coordinated in real time with Scrubber) ── */}
      {backup && (
        <div
          style={{
            ...insetBox,
            padding: "8px 10px",
            borderRadius: 10,
            border: shouldPivot ? "1.5px solid var(--viz-warn)" : "1px solid var(--viz-line)",
            background: "var(--viz-inset)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 800, color: "var(--viz-accent)" }}>
              <Icon name="shield" size={12} />
              AUTO-BACKUP B READY
            </span>
            <span style={{ fontSize: 10.5, color: "var(--viz-muted)", fontVariantNumeric: "tabular-nums" }}>
              {backup.tatkalSuccessChance}% now · {backup.chanceAt60s ?? backup.tatkalSuccessChance}% @ +60s
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, fontSize: 12 }}>
            <div
              onClick={() => onSelect(backup.id)}
              style={{ cursor: "pointer", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              title="Click to fly to Backup B in the 3D scene"
            >
              <strong>{backup.trainNumber}</strong> · {backup.travelClass} · ₹{backup.fare.toLocaleString("en-IN")}
            </div>
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              <button
                type="button"
                className="tv3d-btn"
                onClick={() => onSelect(backup.id)}
                style={{ ...btnBase, minHeight: 22, padding: "2px 7px", fontSize: 10.5 }}
                title="Focus Backup B in the 3D scene"
              >
                View
              </button>
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
                }}
                title="Promote Backup B to Primary Plan A"
              >
                <Icon name="swap" size={10} /> {shouldPivot ? "Pivot to B" : "Make Plan A"}
              </button>
            </div>
          </div>

          {shouldPivot && pivotReason && (
            <div style={{ marginTop: 5, fontSize: 10.5, color: "var(--viz-warn)", fontWeight: 600, lineHeight: 1.35 }}>
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
        {backup ? `Book Plan A (+ Lock Backup ${backup.trainNumber})` : "Book Tatkal now"}
      </button>
    </div>
  );
}

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div style={{ ...insetBox, textAlign: "center", padding: "5px 6px" }}>
      <div style={{ fontSize: 10, color: "var(--viz-muted)", marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: bad ? "var(--viz-bad)" : "var(--viz-text)" }}>
        {value}
      </div>
    </div>
  );
}
