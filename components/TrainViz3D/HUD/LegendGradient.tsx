"use client";

interface LegendGradientProps {
  colorblindMode: boolean;
  onToggleColorblind: () => void;
}

export default function LegendGradient({
  colorblindMode,
  onToggleColorblind,
}: LegendGradientProps) {
  const gradient = colorblindMode
    ? "linear-gradient(to right, #440154, #31688e, #35b779, #90d743, #fde725)"
    : "linear-gradient(to right, #ff2200, #ffaa00, #00ff88)";

  return (
    <div
      style={{
        background: "rgba(14,24,34,0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: "10px 16px",
        color: "var(--text)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
        Worst
      </span>
      <div
        style={{
          flex: 1,
          height: 10,
          borderRadius: 99,
          background: gradient,
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      />
      <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
        Best
      </span>
      <button
        onClick={onToggleColorblind}
        title={colorblindMode ? "Switch to standard colors" : "Switch to colorblind-safe (Viridis)"}
        style={{
          marginLeft: 8,
          background: colorblindMode
            ? "var(--accent)"
            : "rgba(255,255,255,0.06)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: "4px 10px",
          fontSize: 11,
          color: colorblindMode ? "#fff" : "var(--muted)",
          cursor: "pointer",
          whiteSpace: "nowrap",
          transition: "all 0.15s",
        }}
      >
        {colorblindMode ? "👁 Viridis ON" : "👁 Colorblind"}
      </button>
    </div>
  );
}
