"use client";

import { btnBase, btnActive } from "./ui";
import { Icon } from "./icons";

/** Placeholder shown while WebGL initialises. */
export function SceneSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading 3D scene"
      style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "var(--viz-bg)", zIndex: 4 }}
    >
      <div style={{ display: "grid", gap: 10, width: "min(420px, 80%)" }}>
        <div className="tv3d-skeleton" style={{ height: 14, width: "55%" }} />
        <div className="tv3d-skeleton" style={{ height: 180 }} />
        <div className="tv3d-skeleton" style={{ height: 14, width: "80%" }} />
        <div style={{ fontSize: 12, color: "var(--viz-muted)", textAlign: "center" }}>Preparing the 3D scene…</div>
      </div>
    </div>
  );
}

interface MessageStateProps {
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: "neutral" | "error";
}

/** Empty / error state card. */
export function MessageState({ title, detail, actionLabel, onAction, tone = "neutral" }: MessageStateProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "var(--viz-bg)", zIndex: 6, padding: 24,
      }}
    >
      <div style={{ maxWidth: 380, textAlign: "center", display: "grid", gap: 10, justifyItems: "center" }}>
        <Icon name={tone === "error" ? "alert" : "info"} size={28} style={{ color: tone === "error" ? "var(--viz-bad)" : "var(--viz-accent)" }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--viz-text)" }}>{title}</div>
        <div style={{ fontSize: 13, color: "var(--viz-muted)", lineHeight: 1.5 }}>{detail}</div>
        {actionLabel && onAction && (
          <button type="button" className="tv3d-btn" data-active="true" onClick={onAction} style={{ ...btnBase, ...btnActive, padding: "8px 16px" }}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
