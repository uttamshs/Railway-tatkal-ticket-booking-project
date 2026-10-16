"use client";

import { useState } from "react";
import { CORRIDOR_QUOTA_HACKS, QuotaHackOption } from "../lib/quotaJumping";
import { Train } from "../lib/types";

interface Props {
  train: Train | null;
  onClose: () => void;
  onApplyHack: (hack: QuotaHackOption) => void;
}

interface StationInfo {
  code: string;
  name: string;
  km: number;
  pool: string;
  status: string;
  type: "origin" | "intermediate" | "boarding" | "destination";
  explanation: string;
}

const STATIONS: StationInfo[] = [
  {
    code: "AII",
    name: "Ajmer (Depot)",
    km: 0,
    pool: "GNWL (Master Depot)",
    status: "AVL 24 Confirmed",
    type: "origin",
    explanation: "Train originates here. Indian Railways allocates 75% of rake capacity to the originating terminal under General Quota (GNWL)."
  },
  {
    code: "KSG",
    name: "Kishangarh",
    km: 26,
    pool: "Remote / RLWL",
    status: "WL 4",
    type: "intermediate",
    explanation: "Intermediate halt sharing minimal quota buffer with adjacent wayside stations."
  },
  {
    code: "JP",
    name: "Jaipur (Your Boarding)",
    km: 135,
    pool: "RLWL / PQWL",
    status: "WL 18 Waitlisted",
    type: "boarding",
    explanation: "High-demand intermediate hub. Subject to restrictive Remote Location Quota (RLWL) which fills up weeks in advance."
  },
  {
    code: "AWR",
    name: "Alwar",
    km: 286,
    pool: "Pooled Quota (PQWL)",
    status: "WL 8",
    type: "intermediate",
    explanation: "Restricted pooled sub-allocation with low confirmation clearance."
  },
  {
    code: "RE",
    name: "Rewari",
    km: 360,
    pool: "Pooled / RAC",
    status: "RAC 2",
    type: "intermediate",
    explanation: "Junction station absorbing spillover RAC passengers."
  },
  {
    code: "NDLS",
    name: "New Delhi",
    km: 443,
    pool: "Terminus",
    status: "End Destination",
    type: "destination",
    explanation: "Final destination terminal for all corridor passenger pools."
  }
];

export function QuotaJumpingModal({ train, onClose, onApplyHack }: Props) {
  const trainNumber = train?.number || "12957";
  const hack = CORRIDOR_QUOTA_HACKS[trainNumber] || CORRIDOR_QUOTA_HACKS["12957"];
  const [selectedStation, setSelectedStation] = useState<StationInfo>(STATIONS[0]);

  // SVG dimensions for the route diagram
  const svgWidth = 680;
  const svgHeight = 110;
  const startX = 40;
  const endX = svgWidth - 40;
  const trackY = 48;
  const stationSpacing = (endX - startX) / (STATIONS.length - 1);

  // Index of boarding station (Jaipur = 2)
  const boardingIndex = 2;
  const boardingX = startX + boardingIndex * stationSpacing;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="detail-modal quota-modal"
        onClick={e => e.stopPropagation()}
        style={{ width: "min(820px, 96vw)", padding: "26px" }}
      >
        {/* Modal Header */}
        <div className="modal-top">
          <div>
            <span className="eyebrow">ALGORITHMIC QUOTA EXPANSION (INFOVIS RESEARCH)</span>
            <h2 style={{ margin: "2px 0 4px", fontSize: "20px" }}>Station Quota-Jumping Explorer</h2>
            <p className="muted" style={{ margin: 0, fontSize: "13px" }}>
              Unlock confirmed berths from originating depot pools using valid Boarding Point Modifications.
            </p>
          </div>
          <button className="icon-button" onClick={onClose} title="Close Modal">×</button>
        </div>

        {/* Visual Route Timeline SVG Diagram */}
        <div
          className="route-timeline-container"
          style={{
            margin: "18px 0 14px",
            padding: "16px",
            background: "var(--panel2)",
            borderRadius: "14px",
            border: "1px solid var(--line)"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)" }}>
              Corridor Topology: {hack.originStation} ({hack.originCode}) → {hack.destinationStation} ({hack.destinationCode})
            </span>
            <span className="prototype-pill" style={{ fontSize: "10.5px" }}>Click station node to inspect PRS quota</span>
          </div>

          {/* SVG Node-Link Schematic */}
          <div style={{ width: "100%", overflowX: "auto" }}>
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              style={{ width: "100%", minWidth: "580px", height: "auto", display: "block" }}
            >
              {/* Background Full Track Line */}
              <line
                x1={startX}
                x2={endX}
                y1={trackY}
                y2={trackY}
                stroke="var(--line)"
                strokeWidth={5}
                strokeLinecap="round"
              />

              {/* Segment 1: Booked Phantom Segment (Ajmer to Jaipur) - Dashed Amber */}
              <line
                x1={startX}
                x2={boardingX}
                y1={trackY}
                y2={trackY}
                stroke="#f59e0b"
                strokeWidth={5}
                strokeDasharray="6 4"
                strokeLinecap="round"
              />

              {/* Segment 2: Actual Traveled Segment (Jaipur to Delhi) - Vibrant Solid Emerald */}
              <line
                x1={boardingX}
                x2={endX}
                y1={trackY}
                y2={trackY}
                stroke="#10b981"
                strokeWidth={5}
                strokeLinecap="round"
              />

              {/* Station Nodes */}
              {STATIONS.map((st, i) => {
                const cx = startX + i * stationSpacing;
                const isSelected = selectedStation.code === st.code;
                const isOrigin = st.type === "origin";
                const isBoarding = st.type === "boarding";

                const nodeColor = isOrigin
                  ? "#f59e0b"
                  : isBoarding
                  ? "#10b981"
                  : st.type === "destination"
                  ? "var(--accent)"
                  : "var(--muted)";

                return (
                  <g
                    key={st.code}
                    onClick={() => setSelectedStation(st)}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Selected halo */}
                    {isSelected && (
                      <circle
                        cx={cx}
                        cy={trackY}
                        r={16}
                        fill={nodeColor}
                        fillOpacity={0.25}
                        stroke={nodeColor}
                        strokeWidth={1.5}
                      />
                    )}

                    {/* Node circle */}
                    <circle
                      cx={cx}
                      cy={trackY}
                      r={isOrigin || isBoarding ? 9 : 6.5}
                      fill={isOrigin || isBoarding ? nodeColor : "var(--panel)"}
                      stroke={nodeColor}
                      strokeWidth={2.5}
                    />

                    {/* Station Code */}
                    <text
                      x={cx}
                      y={trackY - 14}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight={isOrigin || isBoarding || isSelected ? "800" : "600"}
                      fill={isSelected ? "var(--text)" : "var(--muted)"}
                    >
                      {st.code}
                    </text>

                    {/* Status Subtext below */}
                    <text
                      x={cx}
                      y={trackY + 22}
                      textAnchor="middle"
                      fontSize="9.5"
                      fontWeight="700"
                      fill={isOrigin ? "#f59e0b" : isBoarding ? "#ef4444" : "var(--muted)"}
                    >
                      {st.status.split(" ")[0]}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Interactive Station Inspector Box */}
          <div
            style={{
              marginTop: "10px",
              padding: "10px 14px",
              background: "var(--panel)",
              borderRadius: "10px",
              border: "1px solid var(--line)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "14px",
              flexWrap: "wrap"
            }}
          >
            <div>
              <span className="eyebrow" style={{ fontSize: "10px", margin: 0 }}>
                STATION INSPECTOR: {selectedStation.name} ({selectedStation.code}) · {selectedStation.km} km
              </span>
              <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--text)" }}>
                {selectedStation.explanation}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: "10px", color: "var(--muted)", display: "block" }}>PRS QUOTA POOL</span>
              <strong style={{ fontSize: "12px", color: selectedStation.type === "origin" ? "#10b981" : "var(--accent)" }}>
                {selectedStation.pool}
              </strong>
            </div>
          </div>
        </div>

        {/* Comparative Quota Analysis Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
          {/* Option A: Standard Direct Search */}
          <div
            style={{
              padding: "16px",
              background: "var(--panel2)",
              borderRadius: "12px",
              border: "1.5px solid var(--line)",
              position: "relative"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="eyebrow" style={{ color: "var(--muted)" }}>STANDARD DIRECT BOOKING</span>
              <span style={{ fontSize: "10.5px", color: "#ef4444", fontWeight: 800, padding: "2px 6px", background: "rgba(239, 68, 68, 0.1)", borderRadius: "4px" }}>
                High Waitlist Risk
              </span>
            </div>
            <h3 style={{ margin: "6px 0 4px", fontSize: "15px" }}>Jaipur (JP) → New Delhi (NDLS)</h3>
            <div style={{ display: "grid", gap: "6px", fontSize: "12.5px", margin: "10px 0" }}>
              <div>Quota Assigned: <strong>{hack.directQuota}</strong></div>
              <div>Current Availability: <strong style={{ color: "#ef4444" }}>{hack.directStatus}</strong></div>
              <div>Base Ticket Fare: <strong>₹{hack.fareOriginal}</strong></div>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: "11px", lineHeight: "1.4" }}>
              Intermediate station quota cap. High likelihood of remaining unconfirmed after final chart preparation.
            </p>
          </div>

          {/* Option B: Dash Algorithmic Quota Hack */}
          <div
            style={{
              padding: "16px",
              background: "rgba(16, 185, 129, 0.05)",
              borderRadius: "12px",
              border: "1.5px solid #10b981",
              position: "relative",
              boxShadow: "0 4px 20px rgba(16, 185, 129, 0.12)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="eyebrow" style={{ color: "#10b981" }}>DASH STATION QUOTA JUMP</span>
              <span style={{ fontSize: "10.5px", color: "#10b981", fontWeight: 800, padding: "2px 6px", background: "rgba(16, 185, 129, 0.15)", borderRadius: "4px" }}>
                ✓ 100% Confirmed Berth
              </span>
            </div>
            <h3 style={{ margin: "6px 0 4px", fontSize: "15px", color: "var(--text)" }}>
              Book from {hack.originStation} (AII) → NDLS
            </h3>
            <div style={{ display: "grid", gap: "6px", fontSize: "12.5px", margin: "10px 0" }}>
              <div>Origin Depot Quota: <strong style={{ color: "#10b981" }}>{hack.hackQuota}</strong></div>
              <div>Current Availability: <strong style={{ color: "#10b981" }}>{hack.hackStatus}</strong></div>
              <div>Ticket Fare: <strong>₹{hack.fareWithHack}</strong> (+₹{hack.fareDelta} difference)</div>
            </div>
            <p style={{ margin: 0, fontSize: "11px", color: "var(--text)", lineHeight: "1.4" }}>
              Board safely at <strong>Jaipur Junction (JP)</strong> with guaranteed coach &amp; berth allotment.
            </p>
          </div>
        </div>

        {/* Regulatory / Commercial Legality Notice */}
        <div
          style={{
            padding: "12px 14px",
            background: "var(--panel2)",
            borderRadius: "10px",
            border: "1px solid var(--line)",
            marginBottom: "18px"
          }}
        >
          <strong style={{ fontSize: "12px", color: "var(--text)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <span>⚖️</span>
            <span>100% Legally Compliant (Indian Railways Commercial Circular No. 2018/TG-I/20/P)</span>
          </strong>
          <p className="muted" style={{ margin: 0, fontSize: "11.5px", lineHeight: "1.5" }}>
            {hack.ruleExplanation} The passenger retains full berth ownership, and the TTE is electronically notified via handheld terminal (HHT) of your Jaipur boarding point.
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
            style={{
              background: "#10b981",
              color: "#ffffff",
              border: "none",
              padding: "10px 18px",
              fontWeight: 800
            }}
          >
            ✓ Apply Quota Hack (Board at Jaipur +₹{hack.fareDelta})
          </button>
        </div>
      </div>
    </div>
  );
}
