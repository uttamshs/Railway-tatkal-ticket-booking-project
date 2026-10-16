"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  trainNumber: string;
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AntiBotCanvasModal({ trainNumber, amount, onSuccess, onCancel }: Props) {
  // Game states: "challenge" | "verifying" | "queued" | "completed"
  const [phase, setPhase] = useState<"challenge" | "verifying" | "queued" | "completed">("challenge");
  const [targetPlatform, setTargetPlatform] = useState<"blue" | "green" | "gold">("blue");
  const [dragProgress, setDragProgress] = useState(0); // 0 to 100
  const [queuePosition, setQueuePosition] = useState(14);
  const [queueProgress, setQueueProgress] = useState(15);
  const [dragError, setDragError] = useState("");

  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Randomize platform target on mount
  useEffect(() => {
    const platforms: ("blue" | "green" | "gold")[] = ["blue", "green", "gold"];
    const chosen = platforms[Math.floor(Math.random() * platforms.length)];
    setTargetPlatform(chosen);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (phase !== "challenge") return;
    isDraggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !trackRef.current || phase !== "challenge") return;
    const rect = trackRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(100, Math.round((offsetX / rect.width) * 100)));
    setDragProgress(pct);
  };

  const handlePointerUp = () => {
    if (!isDraggingRef.current || phase !== "challenge") return;
    isDraggingRef.current = false;

    // Check if user dragged all the way to platform (>85%)
    if (dragProgress >= 85) {
      setDragProgress(100);
      setPhase("verifying");
      setTimeout(() => {
        setPhase("queued");
      }, 700);
    } else {
      // Snaps back if dropped halfway
      setDragProgress(0);
      setDragError("Drag the train car completely into the platform bay to verify.");
      setTimeout(() => setDragError(""), 3000);
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
            }, 900);
            return 0;
          }
          return prev - 3;
        });

        setQueueProgress(prev => Math.min(100, prev + 22));
      }, 450);

      return () => clearInterval(interval);
    }
  }, [phase, onSuccess]);

  const platformColors = {
    blue: { label: "Platform 1 (Blue Bay)", bg: "#3b82f6", glow: "rgba(59, 130, 246, 0.4)" },
    green: { label: "Platform 2 (Emerald Bay)", bg: "#10b981", glow: "rgba(16, 185, 129, 0.4)" },
    gold: { label: "Platform 3 (Amber Bay)", bg: "#f59e0b", glow: "rgba(245, 158, 11, 0.4)" }
  };

  const activeColor = platformColors[targetPlatform];

  return (
    <div className="modal-backdrop">
      <div className="detail-modal antibot-modal" style={{ width: "min(540px, 94vw)", textAlign: "center" }}>
        {/* Header */}
        <div style={{ marginBottom: "18px" }}>
          <span className="eyebrow" style={{ color: "var(--accent)" }}>HUMAN-CENTRIC CONCURRENCY PROTOCOL</span>
          <h2 style={{ margin: "4px 0 6px 0", fontSize: "20px" }}>
            {phase === "challenge" && "Interactive Anti-Bot Verification"}
            {phase === "verifying" && "Validating Cryptographic Token…"}
            {phase === "queued" && "Progressive High-Concurrency Queue"}
            {phase === "completed" && "Seat Successfully Allocated!"}
          </h2>
          <p className="muted" style={{ margin: 0, fontSize: "12.5px" }}>
            {phase === "challenge" && (
              <>Zero CAPTCHA fatigue: Dock <strong>Train #{trainNumber}</strong> into {activeColor.label}.</>
            )}
            {phase === "queued" && "Optimistic Concurrency Control (OCC) active · No frozen spinners"}
            {phase === "completed" && "Your reservation lock has been confirmed."}
          </p>
        </div>

        {/* Challenge State: Interactive Blind Canvas Drag-and-Drop */}
        {(phase === "challenge" || phase === "verifying") && (
          <div style={{ padding: "16px", background: "var(--panel2)", borderRadius: "14px", border: "1px solid var(--line)", margin: "16px 0" }}>
            {/* Visual Instruction Badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 14px",
                borderRadius: "999px",
                background: "var(--panel)",
                border: `1.5px solid ${activeColor.bg}`,
                color: "var(--text)",
                fontSize: "12px",
                fontWeight: 700,
                marginBottom: "16px"
              }}
            >
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: activeColor.bg }} />
              Target Destination: {activeColor.label}
            </div>

            {/* Interactive Rail Track */}
            <div
              ref={trackRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{
                position: "relative",
                height: "64px",
                background: "var(--panel)",
                borderRadius: "12px",
                border: "1.5px dashed var(--line)",
                display: "flex",
                alignItems: "center",
                padding: "0 8px",
                cursor: phase === "challenge" ? "grab" : "default",
                userSelect: "none",
                touchAction: "none"
              }}
            >
              {/* Rail sleepers graphic in track */}
              <div
                style={{
                  position: "absolute",
                  left: 12,
                  right: 12,
                  top: "50%",
                  height: "2px",
                  background: "var(--line)",
                  zIndex: 1
                }}
              />

              {/* Destination Docking Bay on Right */}
              <div
                style={{
                  position: "absolute",
                  right: "6px",
                  top: "6px",
                  bottom: "6px",
                  width: "74px",
                  borderRadius: "10px",
                  background: activeColor.bg,
                  boxShadow: `0 0 16px ${activeColor.glow}`,
                  display: "grid",
                  placeItems: "center",
                  color: "#fff",
                  fontSize: "10px",
                  fontWeight: 900,
                  letterSpacing: "0.05em",
                  zIndex: 2
                }}
              >
                DOCK BAY
              </div>

              {/* Draggable Train Engine */}
              <div
                style={{
                  position: "absolute",
                  left: `calc(${dragProgress}% * 0.82 + 6px)`,
                  top: "8px",
                  bottom: "8px",
                  width: "56px",
                  background: "var(--accent)",
                  borderRadius: "8px",
                  display: "grid",
                  placeItems: "center",
                  color: "var(--bg)",
                  fontSize: "20px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                  zIndex: 5,
                  transition: isDraggingRef.current ? "none" : "all 0.3s ease-out"
                }}
              >
                🚆
              </div>
            </div>

            <p style={{ margin: "10px 0 0 0", fontSize: "11px", color: "var(--muted)" }}>
              Drag the train car completely into the highlighted bay to authenticate.
            </p>
            {dragError && (
              <p style={{ margin: "6px 0 0 0", fontSize: "11px", color: "var(--danger)", fontWeight: 700 }}>
                {dragError}
              </p>
            )}
          </div>
        )}

        {/* Phase: Queued with Progressive Token and Velocity Depletion Bar */}
        {(phase === "queued" || phase === "completed") && (
          <div style={{ padding: "20px", background: "var(--panel2)", borderRadius: "14px", border: "1px solid var(--accent)", margin: "16px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700 }}>Live Position in Booking Queue:</span>
              <strong style={{ fontSize: "20px", color: "var(--accent)" }}>
                {queuePosition > 0 ? `#${queuePosition}` : "ALLOCATED ✓"}
              </strong>
            </div>

            {/* Smooth Progress Bar */}
            <div style={{ height: "8px", background: "var(--panel)", borderRadius: "999px", overflow: "hidden", margin: "12px 0" }}>
              <div
                style={{
                  height: "100%",
                  background: "var(--accent)",
                  width: `${queueProgress}%`,
                  transition: "width 0.4s ease-in-out"
                }}
              />
            </div>

            {/* Seat Velocity Depletion Bar (from chat.txt) */}
            <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px dashed var(--line)", textAlign: "left" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", color: "var(--muted)", marginBottom: "4px" }}>
                <span>Inventory Depletion Velocity</span>
                <span style={{ color: "#f59e0b", fontWeight: 700 }}>⚡ High Concurrency (~1.4 seats/sec)</span>
              </div>
              <div style={{ height: "4px", background: "var(--panel)", borderRadius: "999px", overflow: "hidden" }}>
                <div style={{ height: "100%", background: "#f59e0b", width: "72%" }} />
              </div>
              <span style={{ display: "block", marginTop: "4px", fontSize: "10.5px", color: "var(--muted)" }}>
                Optimistic lock held for your session · Double-clicks disabled to prevent server overload.
              </span>
            </div>
          </div>
        )}

        {/* Footer info & Cancel */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
          <span style={{ fontSize: "11px", color: "var(--muted)" }}>
            Amount: <strong>₹{amount}</strong> · Simulated Checkout
          </span>
          <button className="secondary-button" onClick={onCancel} disabled={phase === "queued" || phase === "completed"}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
