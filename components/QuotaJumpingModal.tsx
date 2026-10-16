"use client";

import { useState } from "react";
import { CORRIDOR_QUOTA_HACKS, JAIPUR_DELHI_CORRIDOR_STATIONS, QuotaHackOption } from "../lib/quotaJumping";
import { Train } from "../lib/types";

interface Props {
  train: Train | null;
  onClose: () => void;
  onApplyHack: (hack: QuotaHackOption) => void;
}

export function QuotaJumpingModal({ train, onClose, onApplyHack }: Props) {
  const trainNumber = train?.number || "12957";
  const hack = CORRIDOR_QUOTA_HACKS[trainNumber] || CORRIDOR_QUOTA_HACKS["12957"];
  const [selectedStationCode, setSelectedStationCode] = useState<string>("AII");

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="detail-modal quota-modal" onClick={e => e.stopPropagation()} style={{ width: "min(780px, 96vw)" }}>
        {/* Modal Header */}
        <div className="modal-top">
          <div>
            <span className="eyebrow">ALGORITHMIC QUOTA EXPANSION</span>
            <h2>Station Quota-Jumping Explorer</h2>
            <p className="muted" style={{ margin: "4px 0 0 0", fontSize: "13px" }}>
              Unlock confirmed seats from originating depot pools using valid boarding point modifications.
            </p>
          </div>
          <button className="icon-button" onClick={onClose}>×</button>
        </div>

        {/* Visual Route Timeline Node-Link Diagram */}
        <div className="route-timeline-container" style={{ margin: "20px 0", padding: "18px", background: "var(--panel2)", borderRadius: "14px", border: "1px solid var(--line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)" }}>
              Corridor Route Topology: {hack.originStation} ({hack.originCode}) → {hack.destinationStation} ({hack.destinationCode})
            </span>
            <span className="prototype-pill" style={{ fontSize: "10.5px" }}>Interactive Graph</span>
          </div>

          {/* SVG Node-Link Schematic */}
          <div style={{ overflowX: "auto", paddingBottom: "10px" }}>
            <div style={{ minWidth: "620px", position: "relative" }}>
              {/* Connecting Track Line */}
              <div
                style={{
                  position: "absolute",
                  top: "22px",
                  left: "25px",
                  right: "25px",
                  height: "4px",
                  background: "var(--line)",
                  zIndex: 1
                }}
              />

              {/* Active Segment Highlight */}
              <div
                style={{
                  position: "absolute",
                  top: "22px",
                  left: "25px",
                  width: "30%",
                  height: "4px",
                  background: "var(--accent)",
                  zIndex: 2
                }}
              />

              {/* Station Nodes */}
              <div style={{ display: "flex", justifyContent: "space-between", position: "relative", zIndex: 3 }}>
                {[
                  { code: "AII", name: "Ajmer (Origin)", pool: "GNWL (Master)", seats: "AVL 24 Confirmed", isOrigin: true },
                  { code: "KSG", name: "Kishangarh", pool: "Remote", seats: "WL 4" },
                  { code: "JP", name: "Jaipur (Your Boarding)", pool: "RLWL / PQWL", seats: "WL 18 Waitlisted", isBoarding: true },
                  { code: "AWR", name: "Alwar", pool: "Pooled", seats: "WL 7" },
                  { code: "RE", name: "Rewari", pool: "Pooled", seats: "RAC 2" },
                  { code: "NDLS", name: "New Delhi", pool: "Destination", seats: "Terminus", isTerminus: true }
                ].map(st => {
                  const isOrigin = st.isOrigin;
                  const isBoarding = st.isBoarding;
                  const isSelected = selectedStationCode === st.code;

                  return (
                    <div
                      key={st.code}
                      onClick={() => setSelectedStationCode(st.code)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        cursor: "pointer",
                        maxWidth: "100px",
                        textAlign: "center"
                      }}
                    >
                      <div
                        style={{
                          width: isOrigin || isBoarding ? "22px" : "14px",
                          height: isOrigin || isBoarding ? "22px" : "14px",
                          borderRadius: "50%",
                          background: isOrigin ? "#10b981" : isBoarding ? "var(--accent)" : "var(--panel)",
                          border: `2px solid ${isOrigin ? "#10b981" : isBoarding ? "var(--accent)" : "var(--line)"}`,
                          display: "grid",
                          placeItems: "center",
                          marginBottom: "8px",
                          boxShadow: isSelected ? "0 0 12px var(--accent)" : "none",
                          transition: "all 0.2s"
                        }}
                      >
                        {(isOrigin || isBoarding) && (
                          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#fff" }} />
                        )}
                      </div>
                      <strong style={{ fontSize: "11.5px", color: isSelected ? "var(--accent)" : "var(--text)" }}>
                        {st.name}
                      </strong>
                      <span
                        style={{
                          fontSize: "10px",
                          marginTop: "2px",
                          color: isOrigin ? "#10b981" : isBoarding ? "#ef4444" : "var(--muted)",
                          fontWeight: 700
                        }}
                      >
                        {st.seats}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Comparative Quota Analysis Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "18px" }}>
          {/* Option A: Standard Direct Search */}
          <div style={{ padding: "16px", background: "var(--panel2)", borderRadius: "12px", border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="eyebrow">STANDARD DIRECT SEARCH</span>
              <span style={{ fontSize: "11px", color: "#ef4444", fontWeight: 700 }}>Risky Booking</span>
            </div>
            <h3 style={{ margin: "6px 0", fontSize: "15px" }}>Jaipur (JP) → New Delhi (NDLS)</h3>
            <div style={{ display: "grid", gap: "6px", fontSize: "12.5px", margin: "10px 0" }}>
              <div>Quota: <strong>{hack.directQuota}</strong></div>
              <div>Availability: <span style={{ color: "#ef4444", fontWeight: 700 }}>{hack.directStatus}</span></div>
              <div>Total Fare: <strong>₹{hack.fareOriginal}</strong></div>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: "11.5px" }}>
              High probability of remaining on waitlist. Chart preparation risk.
            </p>
          </div>

          {/* Option B: Dash Algorithmic Quota Hack */}
          <div style={{ padding: "16px", background: "rgba(16, 185, 129, 0.06)", borderRadius: "12px", border: "1.5px solid #10b981" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="eyebrow" style={{ color: "#10b981" }}>DASH QUOTA JUMPING FIX</span>
              <span style={{ fontSize: "11px", color: "#10b981", fontWeight: 800 }}>100% Confirmed Berth</span>
            </div>
            <h3 style={{ margin: "6px 0", fontSize: "15px", color: "var(--text)" }}>
              Book from {hack.originStation} (AII) → NDLS
            </h3>
            <div style={{ display: "grid", gap: "6px", fontSize: "12.5px", margin: "10px 0" }}>
              <div>Quota: <strong style={{ color: "#10b981" }}>{hack.hackQuota}</strong></div>
              <div>Availability: <span style={{ color: "#10b981", fontWeight: 800 }}>{hack.hackStatus}</span></div>
              <div>Total Fare: <strong>₹{hack.fareWithHack}</strong> (+₹{hack.fareDelta} difference)</div>
            </div>
            <p style={{ margin: 0, fontSize: "11.5px", color: "var(--text)" }}>
              Board safely at <strong>Jaipur Junction (JP)</strong> with confirmed coach & berth allocation.
            </p>
          </div>
        </div>

        {/* Regulatory / Commercial Legality Notice */}
        <div style={{ padding: "12px 14px", background: "var(--panel2)", borderRadius: "10px", border: "1px solid var(--line)", marginBottom: "20px" }}>
          <strong style={{ fontSize: "12px", color: "var(--text)", display: "block", marginBottom: "3px" }}>
            ⚖️ Regulatory Compliance & Legality Note
          </strong>
          <p className="muted" style={{ margin: 0, fontSize: "11.5px", lineHeight: "1.5" }}>
            {hack.ruleExplanation}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button className="secondary-button" onClick={onClose}>
            Keep Standard Booking
          </button>
          <button
            className="primary-button"
            onClick={() => {
              onApplyHack(hack);
              onClose();
            }}
            style={{ background: "#10b981", color: "#fff" }}
          >
            ✓ Apply Quota Hack (Board at Jaipur +₹{hack.fareDelta})
          </button>
        </div>
      </div>
    </div>
  );
}
