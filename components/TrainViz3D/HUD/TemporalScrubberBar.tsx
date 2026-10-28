"use client";

import { TIME_HORIZONS } from "../lib/temporalModel";
import { btnActive, btnBase } from "./ui";
import { Icon } from "./icons";

interface TemporalScrubberBarProps {
  elapsedSec: number;
  isPlaying: boolean;
  onSelectTime: (sec: number) => void;
  onTogglePlay: () => void;
  highOddsCount: number;
  totalVisible: number;
  quotaJumpCount: number;
  activeQuotaJumpCount: number;
  showQuotaVectors: boolean;
  onToggleQuotaVectors: () => void;
  onToggleAllQuotaJumps: () => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
}

const HORIZON_LABELS: Record<number, string> = {
  0: "0s Open",
  30: "+30s",
  60: "+60s UPI",
  90: "+90s",
  120: "+120s",
  180: "+180s",
};

/**
 * Unified, low-cognitive-load command strip coordinating:
 *  - 2.1: 4D Temporal Depletion Scrubber (0s -> +180s after Tatkal window open)
 *  - 2.3: 3D Quota-Jump Vector Arcs & 1-click upstream pool activation
 *  - 2.4: Rapid Focus Mode (isolates Top 3 Survivor Triad: Plan A + Backup B + #3 Pareto)
 */
export default function TemporalScrubberBar({
  elapsedSec,
  isPlaying,
  onSelectTime,
  onTogglePlay,
  highOddsCount,
  totalVisible,
  quotaJumpCount,
  activeQuotaJumpCount,
  showQuotaVectors,
  onToggleQuotaVectors,
  onToggleAllQuotaJumps,
  focusMode,
  onToggleFocusMode,
}: TemporalScrubberBarProps) {
  const allJumpsActive = quotaJumpCount > 0 && activeQuotaJumpCount === quotaJumpCount;

  return (
    <div
      role="region"
      aria-label="Tatkal time-pressure scrubber and decision aids"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "8px 14px",
        padding: "8px 20px",
        background: "var(--viz-panel-solid)",
        borderBottom: "1px solid var(--viz-line)",
        fontSize: 12,
        color: "var(--viz-text)",
      }}
    >
      {/* ── 2.1: 4D Temporal Depletion Scrubber ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span
          style={{
            fontWeight: 700,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--viz-muted)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Icon name="clock" size={12} style={{ color: "var(--viz-accent)" }} />
          Tatkal Rush
        </span>

        <button
          type="button"
          className="tv3d-btn"
          data-active={isPlaying}
          aria-pressed={isPlaying}
          title={isPlaying ? "Pause 3-minute Tatkal depletion simulation" : "Simulate seat depletion over the first 180 seconds of Tatkal"}
          onClick={onTogglePlay}
          style={{
            ...btnBase,
            ...(isPlaying ? btnActive : {}),
            minHeight: 26,
            padding: "2px 9px",
            fontSize: 11,
          }}
        >
          <Icon name={isPlaying ? "pause" : "play"} size={11} />
          {isPlaying ? "Pause" : "Simulate"}
        </button>

        <div
          role="group"
          aria-label="Time after Tatkal opens"
          style={{
            display: "inline-flex",
            background: "var(--viz-inset)",
            border: "1px solid var(--viz-line)",
            borderRadius: 8,
            padding: 2,
            gap: 2,
          }}
        >
          {TIME_HORIZONS.map((sec) => {
            const active = elapsedSec === sec;
            return (
              <button
                key={sec}
                type="button"
                className="tv3d-btn"
                data-active={active}
                aria-pressed={active}
                onClick={() => onSelectTime(sec)}
                style={{
                  ...btnBase,
                  ...(active ? btnActive : {}),
                  border: "1px solid transparent",
                  minHeight: 22,
                  padding: "2px 7px",
                  fontSize: 11,
                  borderRadius: 6,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {HORIZON_LABELS[sec] ?? `+${sec}s`}
              </button>
            );
          })}
        </div>

        <span style={{ fontSize: 11, color: "var(--viz-muted)", fontVariantNumeric: "tabular-nums" }}>
          <strong style={{ color: highOddsCount > 0 ? "var(--viz-good)" : "var(--viz-bad)" }}>{highOddsCount}</strong>/{totalVisible} ≥70% odds
        </span>
      </div>

      {/* ── Right side: 2.3 Quota-Jump Vectors & 2.4 Rapid Focus Mode ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
        {quotaJumpCount > 0 && (
          <>
            <button
              type="button"
              className="tv3d-btn"
              data-active={showQuotaVectors}
              aria-pressed={showQuotaVectors}
              title="Show rising 3D vector arcs for trains where booking from upstream Ajmer (AII) and boarding at Jaipur (JP) unlocks higher confirmation odds"
              onClick={onToggleQuotaVectors}
              style={{
                ...btnBase,
                ...(showQuotaVectors ? btnActive : {}),
                minHeight: 26,
                padding: "2px 10px",
                fontSize: 11,
              }}
            >
              <Icon name="zap" size={12} /> 3D Quota-Jump Arcs ({quotaJumpCount})
            </button>

            <button
              type="button"
              className="tv3d-btn"
              data-active={allJumpsActive}
              aria-pressed={allJumpsActive}
              title="Apply Ajmer (AII) origin pool quota-jump to all eligible trains to maximize confirmation probability"
              onClick={onToggleAllQuotaJumps}
              style={{
                ...btnBase,
                ...(allJumpsActive ? btnActive : {}),
                minHeight: 26,
                padding: "2px 10px",
                fontSize: 11,
              }}
            >
              {allJumpsActive ? "✓ AII Origin Pool Applied" : `Apply AII Pool (${activeQuotaJumpCount}/${quotaJumpCount})`}
            </button>
          </>
        )}

        <button
          type="button"
          className="tv3d-btn"
          data-active={focusMode}
          aria-pressed={focusMode}
          title="Rapid Focus Mode: hide dominated noise and lock onto your Top 3 Survivor Triad (Plan A + Backup B + #3 Pareto)"
          onClick={onToggleFocusMode}
          style={{
            ...btnBase,
            ...(focusMode ? btnActive : {}),
            minHeight: 26,
            padding: "2px 10px",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          <Icon name="focus" size={12} /> {focusMode ? "Focus Triad Active" : "Focus Top 3"}
        </button>
      </div>
    </div>
  );
}
