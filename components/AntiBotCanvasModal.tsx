"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  trainNumber: string;
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

type PlatformColor = "blue" | "green" | "gold";

export function AntiBotCanvasModal({ trainNumber, amount, onSuccess, onCancel }: Props) {
  // Game states: "challenge" | "verifying" | "queued" | "completed"
  const [phase, setPhase] = useState<"challenge" | "verifying" | "queued" | "completed">("challenge");
  const [targetPlatform, setTargetPlatform] = useState<PlatformColor>("green");
  const [dragProgress, setDragProgress] = useState(0); // 0 to 100
  const [isDragging, setIsDragging] = useState(false);
  const [queuePosition, setQueuePosition] = useState(14);
  const [queueProgress, setQueueProgress] = useState(15);
  const [dragError, setDragError] = useState("");

  const trackRef = useRef<HTMLDivElement>(null);

  // Randomize platform target on mount
  useEffect(() => {
    const platforms: PlatformColor[] = ["blue", "green", "gold"];
    const chosen = platforms[Math.floor(Math.random() * platforms.length)];
    setTargetPlatform(chosen);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (phase !== "challenge") return;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !trackRef.current || phase !== "challenge") return;
    const rect = trackRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - 28; // center train car
    const trackWidth = rect.width - 64; // account for car width
    const pct = Math.max(0, Math.min(100, Math.round((offsetX / trackWidth) * 100)));
    setDragProgress(pct);
  };

  const handlePointerUp = () => {
    if (!isDragging || phase !== "challenge") return;
    setIsDragging(false);

    // If user dragged train car into docking bay (>= 82%)
    if (dragProgress >= 82) {
      setDragProgress(100);
      setPhase("verifying");
      setTimeout(() => {
        setPhase("queued");
      }, 650);
    } else {
      // Snap back if dropped short of the target platform
      setDragProgress(0);
      setDragError("Drag the train car completely into the designated Platform Bay to verify.");
      setTimeout(() => setDragError(""), 3500);
    }
  };

  // Queue countdown progression
  useEffect(() => {
    if (phase === "queued") {
      const interval = setInterval(() => {
        setQueuePosition(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setPhase("completed");
            setTimeout(() => {
              onSuccess();
            }, 800);
            return 0;
          }
          return prev - 3;
        });

        setQueueProgress(prev => Math.min(100, prev + 24));
      }, 400);

      return () => clearInterval(interval);
    }
  }, [phase, onSuccess]);

  const platformConfigs = {
    blue: {
      name: "Platform 1 (Royal Blue)",
      color: "#2563eb",
      lightBg: "rgba(37, 99, 235, 0.12)",
      glow: "rgba(37, 99, 235, 0.45)"
    },
    green: {
      name: "Platform 2 (Emerald Green)",
      color: "#10b981",
      lightBg: "rgba(16, 185, 129, 0.12)",
      glow: "rgba(16, 185, 129, 0.45)"
    },
    gold: {
      name: "Platform 3 (Amber Heritage)",
      color: "#f59e0b",
      lightBg: "rgba(245, 158, 11, 0.12)",
      glow: "rgba(245, 158, 11, 0.45)"
    }
  };

  const activePlatform = platformConfigs[targetPlatform];

  return (
    <div className="modal-backdrop">
      <div
        className="detail-modal antibot-modal"
        style={{
          width: "min(560px, 95vw)",
          textAlign: "center",
          padding: "26px",
          border: phase === "completed" ? "2px solid #10b981" : "1px solid var(--line)"
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "16px" }}>
          <span className="eyebrow" style={{ color: "var(--accent)" }}>
            HUMAN-CENTRIC CONCURRENCY PROTOCOL (HCI FEATURE E)
          </span>
          <h2 style={{ margin: "4px 0 6px 0", fontSize: "19px" }}>
            {phase === "challenge" && "Interactive Anti-Bot Railway Gate"}
            {phase === "verifying" && "Validating Cryptographic Session…"}
            {phase === "queued" && "Optimistic High-Concurrency Queue"}
            {phase === "completed" && "Seat Successfully Allocated!"}
          </h2>
          <p className="muted" style={{ margin: 0, fontSize: "12.5px" }}>
            {phase === "challenge" && (
              <>Zero CAPTCHA fatigue: Dock <strong>Train #{trainNumber}</strong> into <strong>{activePlatform.name}</strong>.</>
            )}
            {phase === "verifying" && "Generating zero-knowledge human proof token…"}
            {phase === "queued" && "Optimistic Concurrency Control (OCC) active · No frozen spinners"}
            {phase === "completed" && "Your reservation lock has been confirmed."}
          </p>
        </div>

        {/* Phase: Challenge / Verifying */}
        {(phase === "challenge" || phase === "verifying") && (
          <div
            style={{
              padding: "18px",
              background: "var(--panel2)",
              borderRadius: "14px",
              border: "1px solid var(--line)",
              margin: "14px 0"
            }}
          >
            {/* Target Platform Directive Banner */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "7px 16px",
                borderRadius: "999px",
                background: activePlatform.lightBg,
                border: `1.5px solid ${activePlatform.color}`,
                color: "var(--text)",
                fontSize: "12.5px",
                fontWeight: 800,
                marginBottom: "16px"
              }}
            >
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: activePlatform.color,
                  boxShadow: `0 0 8px ${activePlatform.color}`
                }}
              />
              Target: {activePlatform.name}
            </div>

            {/* Interactive Rail Track */}
            <div
              ref={trackRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{
                position: "relative",
                height: "72px",
                background: "var(--panel)",
                borderRadius: "12px",
                border: "1.5px dashed var(--line)",
                display: "flex",
                alignItems: "center",
                padding: "0 8px",
                cursor: phase === "challenge" ? (isDragging ? "grabbing" : "grab") : "default",
                userSelect: "none",
                touchAction: "none"
              }}
            >
              {/* Rail sleepers graphic across the track */}
              <div
                style={{
                  position: "absolute",
                  left: 12,
                  right: 12,
                  top: "50%",
                  height: "4px",
                  background: "var(--line)",
                  borderRadius: "2px",
                  zIndex: 1
                }}
              />

              {/* Station Docking Bay on Right with dynamic glow */}
              <div
                style={{
                  position: "absolute",
                  right: "6px",
                  top: "6px",
                  bottom: "6px",
                  width: "82px",
                  borderRadius: "10px",
                  background: activePlatform.color,
                  boxShadow: `0 0 ${12 + (dragProgress / 100) * 16}px ${activePlatform.glow}`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  fontSize: "10px",
                  fontWeight: 900,
                  letterSpacing: "0.05em",
                  zIndex: 2,
                  transition: "box-shadow 0.2s ease"
                }}
              >
                <span>DOCK BAY</span>
                <span style={{ fontSize: "14px", marginTop: "2px" }}>
                  {dragProgress >= 82 ? "✓" : "→"}
                </span>
              </div>

              {/* Draggable Train Engine */}
              <div
                style={{
                  position: "absolute",
                  left: `${6 + (dragProgress / 100) * (380)}px`,
                  top: "8px",
                  bottom: "8px",
                  width: "58px",
                  background: "var(--accent)",
                  borderRadius: "9px",
                  display: "grid",
                  placeItems: "center",
                  color: "var(--bg)",
                  fontSize: "22px",
                  boxShadow: isDragging
                    ? "0 8px 20px rgba(0,0,0,0.35)"
                    : "0 4px 12px rgba(0,0,0,0.2)",
                  transform: isDragging ? "scale(1.05)" : "scale(1)",
                  zIndex: 5,
                  transition: isDragging ? "none" : "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)"
                }}
              >
                🚆
              </div>
            </div>

            <p style={{ margin: "12px 0 0 0", fontSize: "11px", color: "var(--muted)" }}>
              Drag the train engine horizontally until it locks into the destination dock bay.
            </p>
            {dragError && (
              <p style={{ margin: "6px 0 0 0", fontSize: "11.5px", color: "var(--danger)", fontWeight: 700 }}>
                {dragError}
              </p>
            )}
          </div>
        )}

        {/* Phase: Queued with Progressive Token and Velocity Depletion Bar */}
        {(phase === "queued" || phase === "completed") && (
          <div
            style={{
              padding: "22px",
              background: "var(--panel2)",
              borderRadius: "14px",
              border: `1.5px solid ${phase === "completed" ? "#10b981" : "var(--accent)"}`,
              margin: "14px 0"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700 }}>Live Position in Booking Queue:</span>
              <strong
                style={{
                  fontSize: "22px",
                  color: phase === "completed" ? "#10b981" : "var(--accent)",
                  transition: "color 0.3s"
                }}
              >
                {queuePosition > 0 ? `#${queuePosition}` : "ALLOCATED ✓"}
              </strong>
            </div>

            {/* Smooth Progress Bar */}
            <div style={{ height: "8px", background: "var(--panel)", borderRadius: "999px", overflow: "hidden", margin: "12px 0" }}>
              <div
                style={{
                  height: "100%",
                  background: phase === "completed" ? "#10b981" : "var(--accent)",
                  width: `${queueProgress}%`,
                  transition: "width 0.35s ease-in-out, background 0.3s"
                }}
              />
            </div>

            {/* Seat Velocity Depletion Bar (from chat.txt) */}
            <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px dashed var(--line)", textAlign: "left" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", color: "var(--muted)", marginBottom: "4px" }}>
                <span>Inventory Depletion Velocity</span>
                <span style={{ color: "#f59e0b", fontWeight: 700 }}>⚡ High Concurrency (~1.4 seats/sec)</span>
              </div>
              <div style={{ height: "5px", background: "var(--panel)", borderRadius: "999px", overflow: "hidden" }}>
                <div style={{ height: "100%", background: "#f59e0b", width: "74%" }} />
              </div>
              <span style={{ display: "block", marginTop: "6px", fontSize: "10.5px", color: "var(--muted)" }}>
                Optimistic lock held for your session · Double-clicks disabled to prevent server overload.
              </span>
            </div>
          </div>
        )}

        {/* Footer info & Cancel */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px" }}>
          <span style={{ fontSize: "11px", color: "var(--muted)" }}>
            Amount: <strong>₹{amount}</strong> · Simulated Checkout
          </span>
          <button
            className="secondary-button"
            onClick={onCancel}
            disabled={phase === "queued" || phase === "completed"}
            style={{ fontSize: "12px", padding: "6px 14px" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
