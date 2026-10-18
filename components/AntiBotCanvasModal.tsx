"use client";

import React, { useEffect, useRef, useState } from "react";

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
  const [showHint, setShowHint] = useState(true);

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
    setShowHint(false);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !trackRef.current || phase !== "challenge") return;
    const rect = trackRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - 30;
    const trackWidth = rect.width - 70;
    const rawPct = (offsetX / trackWidth) * 100;
    // Magnetic pull when nearing dock bay (>75%)
    const pct = rawPct > 75 ? Math.min(100, rawPct + 4) : Math.max(0, Math.min(100, Math.round(rawPct)));
    setDragProgress(pct);
  };

  const handlePointerUp = () => {
    if (!isDragging || phase !== "challenge") return;
    setIsDragging(false);

    // If user dragged train car into docking bay (>= 80%)
    if (dragProgress >= 80) {
      setDragProgress(100);
      setPhase("verifying");
      setTimeout(() => {
        setPhase("queued");
      }, 700);
    } else {
      // Snap back if dropped short of the target platform
      setDragProgress(0);
      setDragError("Drag the locomotive completely into the designated Platform Bay to verify.");
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
            }, 850);
            return 0;
          }
          return prev - 3;
        });

        setQueueProgress(prev => Math.min(100, prev + 25));
      }, 380);

      return () => clearInterval(interval);
    }
  }, [phase, onSuccess]);

  const platformConfigs = {
    blue: {
      name: "Platform 1 (Royal Blue)",
      short: "PF 1",
      color: "#2563eb",
      lightBg: "rgba(37, 99, 235, 0.12)",
      glow: "rgba(37, 99, 235, 0.45)"
    },
    green: {
      name: "Platform 2 (Emerald Green)",
      short: "PF 2",
      color: "#10b981",
      lightBg: "rgba(16, 185, 129, 0.12)",
      glow: "rgba(16, 185, 129, 0.45)"
    },
    gold: {
      name: "Platform 3 (Amber Heritage)",
      short: "PF 3",
      color: "#f59e0b",
      lightBg: "rgba(245, 158, 11, 0.12)",
      glow: "rgba(245, 158, 11, 0.45)"
    }
  };

  const activePlatform = platformConfigs[targetPlatform];

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.78)",
        backdropFilter: "blur(10px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        animation: "fadeIn 0.2s ease-out"
      }}
    >
      <div
        className="detail-modal antibot-modal"
        style={{
          width: "min(580px, 95vw)",
          background: "var(--panel)",
          borderRadius: "22px",
          border: phase === "completed" ? "2px solid #10b981" : "1px solid var(--accent)",
          padding: "28px",
          textAlign: "center",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.5), 0 0 35px rgba(30, 64, 175, 0.2)",
          animation: "ticketPop 0.28s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
      >
        {/* Top Header Badge */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 900,
                letterSpacing: "0.12em",
                color: "var(--accent)",
                textTransform: "uppercase",
                background: "rgba(30, 64, 175, 0.12)",
                border: "1px solid rgba(30, 64, 175, 0.3)",
                padding: "2px 8px",
                borderRadius: "999px"
              }}
            >
              🔒 Zero-CAPTCHA Protocol • HCI Concurrency Model
            </span>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>
              Train #{trainNumber}
            </span>
          </div>

          <h2 style={{ margin: "2px 0 6px", fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em" }}>
            {phase === "challenge" && "Interactive Anti-Bot Platform Docking"}
            {phase === "verifying" && "Cryptographic Session Proof In Progress…"}
            {phase === "queued" && "Optimistic Concurrency Reservation Queue"}
            {phase === "completed" && "Berth Lock Successfully Confirmed!"}
          </h2>

          <p className="muted" style={{ margin: 0, fontSize: "12.5px" }}>
            {phase === "challenge" && (
              <>Drag the locomotive into <strong>{activePlatform.name}</strong> to eliminate bot reservations without OCR fatigue.</>
            )}
            {phase === "verifying" && "Generating zero-knowledge token from your pointer kinematics…"}
            {phase === "queued" && "High-traffic queue clearance: Holding seat lease without frozen spinners."}
            {phase === "completed" && "Your reservation payload has been committed to the simulated PRS database."}
          </p>
        </div>

        {/* Phase: Challenge / Verifying */}
        {(phase === "challenge" || phase === "verifying") && (
          <div
            style={{
              padding: "20px",
              background: "var(--panel2)",
              borderRadius: "16px",
              border: "1px solid var(--line)",
              margin: "16px 0"
            }}
          >
            {/* Multi-Platform Indicator Strip */}
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "16px" }}>
              {(["blue", "green", "gold"] as PlatformColor[]).map(colorKey => {
                const p = platformConfigs[colorKey];
                const isTarget = targetPlatform === colorKey;
                return (
                  <div
                    key={colorKey}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "5px 12px",
                      borderRadius: "8px",
                      fontSize: "11px",
                      fontWeight: 700,
                      background: isTarget ? p.lightBg : "var(--panel)",
                      border: `1.5px solid ${isTarget ? p.color : "var(--line)"}`,
                      color: isTarget ? "var(--text)" : "var(--muted)",
                      boxShadow: isTarget ? `0 0 12px ${p.glow}` : "none",
                      transition: "all 0.25s"
                    }}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: p.color,
                        boxShadow: isTarget ? `0 0 6px ${p.color}` : "none"
                      }}
                    />
                    <span>{p.short}</span>
                    {isTarget && <span style={{ fontSize: "9px", background: p.color, color: "#fff", padding: "1px 4px", borderRadius: "3px" }}>TARGET</span>}
                  </div>
                );
              })}
            </div>

            {/* Interactive Rail Track Canvas */}
            <div
              ref={trackRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{
                position: "relative",
                height: "82px",
                background: "radial-gradient(ellipse at 50% 50%, rgba(15, 23, 42, 0.9) 0%, #081018 100%)",
                borderRadius: "14px",
                border: "1.5px solid var(--line)",
                display: "flex",
                alignItems: "center",
                padding: "0 10px",
                cursor: phase === "challenge" ? (isDragging ? "grabbing" : "grab") : "default",
                userSelect: "none",
                touchAction: "none",
                overflow: "hidden"
              }}
            >
              {/* Dual Steel Rails */}
              <div
                style={{
                  position: "absolute",
                  left: 10,
                  right: 90,
                  top: "34px",
                  height: "3px",
                  background: "linear-gradient(90deg, #64748b, #94a3b8)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
                  zIndex: 1
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 10,
                  right: 90,
                  top: "46px",
                  height: "3px",
                  background: "linear-gradient(90deg, #64748b, #94a3b8)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
                  zIndex: 1
                }}
              />

              {/* Wooden Sleepers */}
              <div
                style={{
                  position: "absolute",
                  left: 14,
                  right: 94,
                  top: "28px",
                  bottom: "28px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  zIndex: 0
                }}
              >
                {Array.from({ length: 18 }).map((_, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: "4px",
                      height: "26px",
                      background: "rgba(255, 255, 255, 0.08)",
                      borderRadius: "1px"
                    }}
                  />
                ))}
              </div>

              {/* Target Platform Docking Bay */}
              <div
                style={{
                  position: "absolute",
                  right: "6px",
                  top: "6px",
                  bottom: "6px",
                  width: "86px",
                  borderRadius: "10px",
                  background: `linear-gradient(135deg, ${activePlatform.color}, ${activePlatform.color}cc)`,
                  boxShadow: `0 0 ${16 + (dragProgress / 100) * 20}px ${activePlatform.glow}`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  fontSize: "10px",
                  fontWeight: 900,
                  letterSpacing: "0.06em",
                  zIndex: 2,
                  transition: "box-shadow 0.2s ease"
                }}
              >
                <span>{activePlatform.short} BAY</span>
                <span style={{ fontSize: "16px", marginTop: "2px" }}>
                  {dragProgress >= 80 ? "✓ LOCKED" : "→ DOCK"}
                </span>
              </div>

              {/* Draggable High-Tech Train Locomotive */}
              <div
                style={{
                  position: "absolute",
                  left: `${8 + (dragProgress / 100) * (340)}px`,
                  top: "10px",
                  bottom: "10px",
                  width: "64px",
                  background: "linear-gradient(135deg, var(--accent), #0ea5e9)",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--bg)",
                  fontSize: "24px",
                  boxShadow: isDragging
                    ? "0 10px 25px rgba(14, 165, 233, 0.5)"
                    : "0 4px 14px rgba(0,0,0,0.3)",
                  transform: isDragging ? "scale(1.08)" : "scale(1)",
                  zIndex: 5,
                  transition: isDragging ? "none" : "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)"
                }}
              >
                🚆
                {/* Headlight Beam Effect */}
                <div
                  style={{
                    position: "absolute",
                    right: "-18px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "24px",
                    height: "16px",
                    background: "radial-gradient(ellipse at left, rgba(255, 255, 255, 0.8) 0%, transparent 80%)",
                    pointerEvents: "none"
                  }}
                />
              </div>
            </div>

            {/* Instruction Hint */}
            {showHint && (
              <p style={{ margin: "10px 0 0", fontSize: "11.5px", color: "var(--accent)", fontWeight: 600 }}>
                💡 Click &amp; drag the train horizontally across the track until it docks into {activePlatform.name}.
              </p>
            )}

            {dragError && (
              <p style={{ margin: "8px 0 0", fontSize: "11.5px", color: "var(--danger)", fontWeight: 700 }}>
                {dragError}
              </p>
            )}
          </div>
        )}

        {/* Phase: Queued with Optimistic Concurrency and Seat Velocity */}
        {(phase === "queued" || phase === "completed") && (
          <div
            style={{
              padding: "24px",
              background: "var(--panel2)",
              borderRadius: "16px",
              border: `2px solid ${phase === "completed" ? "#10b981" : "var(--accent)"}`,
              margin: "16px 0",
              animation: "fadeIn 0.25s ease-out"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700 }}>Live Position in Booking Stream:</span>
              <strong
                style={{
                  fontSize: "24px",
                  fontWeight: 900,
                  color: phase === "completed" ? "#10b981" : "var(--accent)",
                  transition: "color 0.3s"
                }}
              >
                {queuePosition > 0 ? `#${queuePosition}` : "BERTH SECURED ✓"}
              </strong>
            </div>

            {/* Progress Bar with Shimmer */}
            <div style={{ height: "8px", background: "var(--panel)", borderRadius: "999px", overflow: "hidden", margin: "14px 0" }}>
              <div
                style={{
                  height: "100%",
                  background: phase === "completed" ? "#10b981" : "linear-gradient(90deg, var(--accent), #0ea5e9)",
                  width: `${queueProgress}%`,
                  transition: "width 0.35s ease-in-out, background 0.3s"
                }}
              />
            </div>

            {/* Real-Time Seat Inventory Depletion Velocity (HCI Innovation) */}
            <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px dashed var(--line)", textAlign: "left" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                <span className="muted">Cluster Booking Velocity:</span>
                <span style={{ color: "#f59e0b", fontWeight: 800 }}>⚡ High Concurrency (~1.4 seats/sec)</span>
              </div>
              <div style={{ height: "5px", background: "var(--panel)", borderRadius: "999px", overflow: "hidden" }}>
                <div style={{ height: "100%", background: "#f59e0b", width: "74%" }} />
              </div>
              <span style={{ display: "block", marginTop: "6px", fontSize: "11px", color: "var(--muted)" }}>
                Optimistic lock held for your authenticated session • Prevents double-booking and payment gateway timeout.
              </span>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>
            Simulated Amount: <strong style={{ color: "var(--text)" }}>₹{amount}</strong>
          </span>
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={phase === "queued" || phase === "completed"}
            style={{ fontSize: "12px", padding: "7px 16px" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
