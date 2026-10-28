"use client";

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

const KEY_HORIZONS: { sec: number; label: string; tip: string }[] = [
  { sec: 0, label: "Now (0s)", tip: "Seats at the exact second Tatkal opens (10:00 AM)" },
  { sec: 60, label: "+60s UPI", tip: "Seats remaining when your UPI payment finishes (~60s later)" },
  { sec: 120, label: "+2m", tip: "Seats remaining 2 minutes after Tatkal opens" },
  { sec: 180, label: "+3m", tip: "Seats remaining 3 minutes after Tatkal opens" },
];

/**
 * Clean, low-cognitive-load command strip:
 *  - Left:  Checkout Forecast (Now / +60s UPI / +2m / +3m) + Rehearse play button
 *  - Right: 1-click Ajmer Quota Boost + Focus Top 3 toggle
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
  onToggleAllQuotaJumps,
  focusMode,
  onToggleFocusMode,
}: TemporalScrubberBarProps) {
  const allJumpsActive = quotaJumpCount > 0 && activeQuotaJumpCount === quotaJumpCount;

  return (
    <div
      role="region"
      aria-label="Checkout survival forecast and quick actions"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "6px 12px",
        padding: "7px 20px",
        background: "var(--viz-panel-solid)",
        borderBottom: "1px solid var(--viz-line)",
        fontSize: 12,
        color: "var(--viz-text)",
      }}
    >
      {/* ── Left: Checkout Survival Forecast (2.1) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span
          style={{
            fontWeight: 700,
            fontSize: 11,
            color: "var(--viz-muted)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
          title="Forecasts which trains still have seats by the time your UPI payment completes"
        >
          <Icon name="clock" size={12} style={{ color: "var(--viz-accent)" }} />
          Checkout Forecast:
        </span>

        <div
          role="group"
          aria-label="Forecast horizon"
          style={{
            display: "inline-flex",
            background: "var(--viz-inset)",
            border: "1px solid var(--viz-line)",
            borderRadius: 8,
            padding: 2,
            gap: 2,
          }}
        >
          {KEY_HORIZONS.map(({ sec, label, tip }) => {
            const active = elapsedSec === sec;
            return (
              <button
                key={sec}
                type="button"
                className="tv3d-btn"
                data-active={active}
                aria-pressed={active}
                title={tip}
                onClick={() => onSelectTime(sec)}
                style={{
                  ...btnBase,
                  ...(active ? btnActive : {}),
                  border: "1px solid transparent",
                  minHeight: 22,
                  padding: "2px 8px",
                  fontSize: 11,
                  borderRadius: 6,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="tv3d-btn"
          data-active={isPlaying}
          aria-pressed={isPlaying}
          title="Pre-window rehearsal: preview how fast seats drain over 3 minutes"
          onClick={onTogglePlay}
          style={{
            ...btnBase,
            ...(isPlaying ? btnActive : {}),
            minHeight: 24,
            padding: "2px 8px",
            fontSize: 11,
          }}
        >
          <Icon name={isPlaying ? "pause" : "play"} size={10} />
          {isPlaying ? "Pause" : "Preview"}
        </button>

        <span style={{ fontSize: 11, color: "var(--viz-muted)", fontVariantNumeric: "tabular-nums" }}>
          <strong style={{ color: highOddsCount > 0 ? "var(--viz-good)" : "var(--viz-bad)" }}>{highOddsCount}</strong>/{totalVisible} safe
        </span>
      </div>

      {/* ── Right: 1-Click Ajmer Quota Boost (2.3) & Focus Top 3 (2.4) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
        {quotaJumpCount > 0 && (
          <button
            type="button"
            className="tv3d-btn"
            data-active={allJumpsActive}
            aria-pressed={allJumpsActive}
            title="Book from originating station Ajmer (AII) with boarding at Jaipur (JP) to unlock larger confirm pools"
            onClick={onToggleAllQuotaJumps}
            style={{
              ...btnBase,
              ...(allJumpsActive ? btnActive : {}),
              minHeight: 25,
              padding: "2px 10px",
              fontSize: 11,
            }}
          >
            <Icon name="zap" size={12} />
            {allJumpsActive ? "✓ Ajmer Quota Boost On" : "Ajmer Quota Boost"}
          </button>
        )}

        <button
          type="button"
          className="tv3d-btn"
          data-active={focusMode}
          aria-pressed={focusMode}
          title="Hide low-odds trains and zoom into your Top 3 choices"
          onClick={onToggleFocusMode}
          style={{
            ...btnBase,
            ...(focusMode ? btnActive : {}),
            minHeight: 25,
            padding: "2px 10px",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          <Icon name="focus" size={12} /> {focusMode ? "✓ Top 3 Only" : "Focus Top 3"}
        </button>
      </div>
    </div>
  );
}
