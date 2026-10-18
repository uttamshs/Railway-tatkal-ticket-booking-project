"use client";

import React, { useState } from "react";
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
  quotaShare: number; // percentage of total train rake allocation
  status: string;
  type: "origin" | "intermediate" | "boarding" | "destination";
  explanation: string;
}

const STATIONS: StationInfo[] = [
  {
    code: "AII",
    name: "Ajmer Junction (Origin Depot)",
    km: 0,
    pool: "GNWL (General Master Pool)",
    quotaShare: 72,
    status: "AVL 24 Confirmed",
    type: "origin",
    explanation: "Train originates here. Indian Railways PRS allocates 70–75% of rake berths exclusively to the originating terminal under GNWL, which clears first."
  },
  {
    code: "KSG",
    name: "Kishangarh",
    km: 26,
    pool: "Wayside Pool",
    quotaShare: 4,
    status: "WL 4",
    type: "intermediate",
    explanation: "Minor wayside halt sharing a tiny pooled quota with negligible confirmation clearance priority."
  },
  {
    code: "JP",
    name: "Jaipur Junction (Your Boarding)",
    km: 135,
    pool: "RLWL (Remote Location Quota)",
    quotaShare: 14,
    status: "WL 18 Waitlisted",
    type: "boarding",
    explanation: "High-demand intermediate hub. Restricted to Remote Location Quota (RLWL) which has a strict quota cap and is difficult to confirm."
  },
  {
    code: "AWR",
    name: "Alwar Junction",
    km: 286,
    pool: "PQWL (Pooled Quota)",
    quotaShare: 5,
    status: "WL 8",
    type: "intermediate",
    explanation: "Pooled sub-allocation for intermediate passengers, with low clearance rate during chart preparation."
  },
  {
    code: "RE",
    name: "Rewari Junction",
    km: 360,
    pool: "RAC Spillover Pool",
    quotaShare: 5,
    status: "RAC 2",
    type: "intermediate",
    explanation: "Junction connecting Haryana lines, absorbing spillover RAC allocations."
  },
  {
    code: "NDLS",
    name: "New Delhi (Terminus)",
    km: 443,
    pool: "Corridor Destination",
    quotaShare: 0,
    status: "End Terminal",
    type: "destination",
    explanation: "Final destination terminal for all corridor passenger pools."
  }
];

export function QuotaJumpingModal({ train, onClose, onApplyHack }: Props) {
  const trainNumber = train?.number || "12957";
  const hack = CORRIDOR_QUOTA_HACKS[trainNumber] || CORRIDOR_QUOTA_HACKS["12957"];
  const [selectedStation, setSelectedStation] = useState<StationInfo>(STATIONS[0]);
  const [showLegalDetails, setShowLegalDetails] = useState(false);

  // SVG diagram layout
  const svgWidth = 720;
  const svgHeight = 130;
  const startX = 55;
  const endX = svgWidth - 55;
  const trackY = 56;
  const stationSpacing = (endX - startX) / (STATIONS.length - 1);

  // Jaipur boarding node index is 2
  const boardingIndex = 2;
  const boardingX = startX + boardingIndex * stationSpacing;

  // Selected station coordinate
  const selectedIndex = STATIONS.findIndex(s => s.code === selectedStation.code);
  const selectedX = startX + (selectedIndex >= 0 ? selectedIndex : 0) * stationSpacing;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(8px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        animation: "fadeIn 0.2s ease-out"
      }}
    >
      <div
        className="detail-modal quota-modal"
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(860px, 96vw)",
          maxHeight: "92vh",
          overflowY: "auto",
          background: "var(--panel)",
          borderRadius: "20px",
          border: "1px solid var(--accent)",
          padding: "28px",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.45), 0 0 30px rgba(16, 185, 129, 0.15)",
          animation: "ticketPop 0.28s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
      >
        {/* Header Section */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "18px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 900,
                  letterSpacing: "0.12em",
                  color: "#10b981",
                  textTransform: "uppercase",
                  background: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  padding: "2px 8px",
                  borderRadius: "999px"
                }}
              >
                ⚡ Algorithmic PRS Topology Explorer
              </span>
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                Train #{trainNumber} · {train?.name || "Swarna Jayanti Rajdhani"}
              </span>
            </div>
            <h2 style={{ margin: "2px 0 4px", fontSize: "22px", fontWeight: 800, letterSpacing: "-0.02em" }}>
              Station Quota-Jumping Optimization
            </h2>
            <p className="muted" style={{ margin: 0, fontSize: "13px" }}>
              Leverage originating terminal seat quotas (GNWL) with official Boarding Point Modification to secure 100% confirmed berths.
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            style={{
              background: "var(--panel2)",
              border: "1px solid var(--line)",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              display: "grid",
              placeItems: "center",
              fontSize: "18px",
              cursor: "pointer",
              color: "var(--muted)"
            }}
          >
            ×
          </button>
        </div>

        {/* Visual Route Schematic with Sleeper Tracks & Train Locator */}
        <div
          style={{
            background: "radial-gradient(ellipse at 50% 0%, rgba(16, 185, 129, 0.08) 0%, var(--panel2) 80%)",
            borderRadius: "16px",
            border: "1px solid var(--line)",
            padding: "20px",
            marginBottom: "18px"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)" }}>
              Railway Route Topology: {hack.originStation} ({hack.originCode}) ➔ {hack.destinationStation} ({hack.destinationCode})
            </span>
            <span
              style={{
                fontSize: "10.5px",
                padding: "2px 8px",
                background: "var(--panel)",
                borderRadius: "6px",
                border: "1px solid var(--line)",
                color: "var(--muted)"
              }}
            >
              Click any station node to inspect quota pool allocation
            </span>
          </div>

          {/* SVG Railway Track Canvas */}
          <div style={{ width: "100%", overflowX: "auto" }}>
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              style={{ width: "100%", minWidth: "620px", height: "auto", display: "block" }}
            >
              <defs>
                <filter id="nodeGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Rail Sleepers (Cross Ties) */}
              {Array.from({ length: 48 }).map((_, i) => {
                const tieX = startX + (i / 47) * (endX - startX);
                return (
                  <line
                    key={`tie-${i}`}
                    x1={tieX}
                    x2={tieX}
                    y1={trackY - 9}
                    y2={trackY + 9}
                    stroke="var(--line)"
                    strokeWidth={2}
                    opacity={0.7}
                  />
                );
              })}

              {/* Segment 1: Booked Phantom Segment (AII to JP) - Dashed Amber */}
              <line
                x1={startX}
                x2={boardingX}
                y1={trackY - 4}
                y2={trackY - 4}
                stroke="#f59e0b"
                strokeWidth={3}
                strokeDasharray="6 4"
              />
              <line
                x1={startX}
                x2={boardingX}
                y1={trackY + 4}
                y2={trackY + 4}
                stroke="#f59e0b"
                strokeWidth={3}
                strokeDasharray="6 4"
              />

              {/* Segment 2: Traveled Segment (JP to NDLS) - Solid Emerald */}
              <line
                x1={boardingX}
                x2={endX}
                y1={trackY - 4}
                y2={trackY - 4}
                stroke="#10b981"
                strokeWidth={3.5}
              />
              <line
                x1={boardingX}
                x2={endX}
                y1={trackY + 4}
                y2={trackY + 4}
                stroke="#10b981"
                strokeWidth={3.5}
              />

              {/* Phantom Segment Label */}
              <text
                x={(startX + boardingX) / 2}
                y={trackY - 18}
                fill="#f59e0b"
                fontSize="9.5"
                fontWeight="800"
                textAnchor="middle"
                letterSpacing="0.04em"
              >
                PHANTOM SEGMENT (PAID +₹{hack.fareDelta})
              </text>

              {/* Traveled Segment Label */}
              <text
                x={(boardingX + endX) / 2}
                y={trackY - 18}
                fill="#10b981"
                fontSize="9.5"
                fontWeight="800"
                textAnchor="middle"
                letterSpacing="0.04em"
              >
                PHYSICAL BOARDING &amp; TRAVEL ROUTE (308 km)
              </text>

              {/* Animated Train Indicator placed at selected station */}
              <g
                transform={`translate(${selectedX}, ${trackY})`}
                style={{ transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}
              >
                <circle cx={0} cy={0} r={16} fill="rgba(14, 165, 233, 0.2)" />
                <rect x={-14} y={-10} width={28} height={20} rx={5} fill="var(--accent)" />
                <text x={0} y={4} textAnchor="middle" fill="var(--bg)" fontSize="11" fontWeight="900">
                  🚆
                </text>
              </g>

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
                    {/* Selected Highlight Aura */}
                    {isSelected && (
                      <circle
                        cx={cx}
                        cy={trackY}
                        r={20}
                        fill={nodeColor}
                        fillOpacity={0.25}
                        stroke={nodeColor}
                        strokeWidth={1.5}
                        filter="url(#nodeGlow)"
                      />
                    )}

                    {/* Outer ring */}
                    <circle
                      cx={cx}
                      cy={trackY}
                      r={isOrigin || isBoarding ? 10 : 7}
                      fill={isOrigin || isBoarding ? nodeColor : "var(--panel)"}
                      stroke={nodeColor}
                      strokeWidth={2.5}
                    />

                    {/* Distance in km */}
                    <text
                      x={cx}
                      y={trackY + 24}
                      textAnchor="middle"
                      fontSize="9"
                      fill="var(--muted)"
                      fontWeight="600"
                    >
                      {st.km} km
                    </text>

                    {/* Station Code */}
                    <text
                      x={cx}
                      y={trackY + 36}
                      textAnchor="middle"
                      fontSize="11.5"
                      fontWeight={isOrigin || isBoarding || isSelected ? "800" : "600"}
                      fill={isSelected ? "var(--text)" : "var(--muted)"}
                    >
                      {st.code}
                    </text>

                    {/* Status Pill */}
                    <text
                      x={cx}
                      y={trackY + 48}
                      textAnchor="middle"
                      fontSize="9.5"
                      fontWeight="700"
                      fill={isOrigin ? "#f59e0b" : isBoarding ? "#ef4444" : "#10b981"}
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
              marginTop: "14px",
              padding: "12px 18px",
              background: "var(--panel)",
              borderRadius: "12px",
              border: "1px solid var(--line)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              flexWrap: "wrap"
            }}
          >
            <div style={{ flex: 1, minWidth: "260px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: selectedStation.type === "origin" ? "rgba(245, 158, 11, 0.15)" : selectedStation.type === "boarding" ? "rgba(16, 185, 129, 0.15)" : "var(--panel2)",
                    color: selectedStation.type === "origin" ? "#f59e0b" : selectedStation.type === "boarding" ? "#10b981" : "var(--text)"
                  }}
                >
                  {selectedStation.type.toUpperCase()} NODE
                </span>
                <strong style={{ fontSize: "14px", color: "var(--text)" }}>
                  {selectedStation.name} ({selectedStation.code})
                </strong>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                  • Milestone {selectedStation.km} km
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)", lineHeight: "1.4" }}>
                {selectedStation.explanation}
              </p>
            </div>

            {/* Quota Share Gauge */}
            <div style={{ minWidth: "160px", textAlign: "right" }}>
              <span style={{ fontSize: "10px", color: "var(--muted)", display: "block" }}>
                PRS QUOTA ALLOCATION SHARE
              </span>
              <strong style={{ fontSize: "16px", color: selectedStation.quotaShare >= 50 ? "#10b981" : "var(--accent)" }}>
                {selectedStation.quotaShare}% of Rake
              </strong>
              <div style={{ width: "100%", height: "5px", background: "var(--panel2)", borderRadius: "999px", overflow: "hidden", marginTop: "4px" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${selectedStation.quotaShare}%`,
                    background: selectedStation.quotaShare >= 50 ? "#10b981" : "var(--accent)"
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Side-by-Side Booking Comparison */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "18px" }}>
          {/* Card A: Standard Direct Search */}
          <div
            style={{
              padding: "18px",
              background: "var(--panel2)",
              borderRadius: "14px",
              border: "1px solid var(--line)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "10.5px", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>
                Standard Direct Booking
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: "6px",
                  background: "rgba(239, 68, 68, 0.12)",
                  color: "#ef4444"
                }}
              >
                High Waitlist Risk
              </span>
            </div>

            <h3 style={{ margin: "0 0 8px", fontSize: "16px" }}>Jaipur (JP) → New Delhi (NDLS)</h3>

            <div style={{ display: "grid", gap: "6px", fontSize: "12.5px", marginBottom: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">Assigned Quota Pool:</span>
                <strong>{hack.directQuota}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">Live Seat Status:</span>
                <strong style={{ color: "#ef4444" }}>{hack.directStatus}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">Standard Rail Fare:</span>
                <strong>₹{hack.fareOriginal}</strong>
              </div>
            </div>

            <p className="muted" style={{ margin: 0, fontSize: "11px", lineHeight: "1.4" }}>
              Subject to intermediate RLWL quotas. Over 70% of waitlisted tickets on this corridor fail to clear at chart preparation.
            </p>
          </div>

          {/* Card B: Dash Station Quota Jump (The Winner) */}
          <div
            style={{
              padding: "18px",
              background: "rgba(16, 185, 129, 0.05)",
              borderRadius: "14px",
              border: "2px solid #10b981",
              boxShadow: "0 10px 30px -10px rgba(16, 185, 129, 0.2)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "10.5px", fontWeight: 900, color: "#10b981", textTransform: "uppercase" }}>
                ⚡ Dash Algorithmic Quota Jump
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 900,
                  padding: "2px 8px",
                  borderRadius: "6px",
                  background: "#10b981",
                  color: "#ffffff"
                }}
              >
                ✓ Guaranteed Berth
              </span>
            </div>

            <h3 style={{ margin: "0 0 8px", fontSize: "16px", color: "var(--text)" }}>
              Book from {hack.originStation} (AII) → NDLS
            </h3>

            <div style={{ display: "grid", gap: "6px", fontSize: "12.5px", marginBottom: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">Master Origin Pool:</span>
                <strong style={{ color: "#10b981" }}>{hack.hackQuota}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">Confirmed Availability:</span>
                <strong style={{ color: "#10b981" }}>{hack.hackStatus}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">Fare Difference:</span>
                <strong style={{ color: "#10b981" }}>₹{hack.fareWithHack} (+₹{hack.fareDelta})</strong>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: "11.5px", color: "var(--text)", lineHeight: "1.4" }}>
              Board safely at <strong>Jaipur Junction (JP)</strong>. Electronic reservation chart assigns coach &amp; berth without requiring travel from Ajmer.
            </p>
          </div>
        </div>

        {/* Progressive Disclosure: Regulatory Compliance Box */}
        <div
          style={{
            background: "var(--panel2)",
            borderRadius: "12px",
            border: "1px solid var(--line)",
            padding: "12px 16px",
            marginBottom: "18px"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer"
            }}
            onClick={() => setShowLegalDetails(!showLegalDetails)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span>⚖️</span>
              <strong style={{ fontSize: "12.5px" }}>
                100% Legal &amp; Compliant • Indian Railways Commercial Circular No. 2018/TG-I/20/P
              </strong>
            </div>
            <button
              type="button"
              className="text-button"
              style={{ fontSize: "11px", color: "var(--accent)", padding: 0 }}
            >
              {showLegalDetails ? "Hide rules ▲" : "View IRCTC rules ▼"}
            </button>
          </div>

          {showLegalDetails && (
            <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed var(--line)", fontSize: "11.5px", color: "var(--muted)", lineHeight: "1.5" }}>
              <p style={{ margin: "0 0 6px" }}>
                {hack.ruleExplanation}
              </p>
              <p style={{ margin: 0 }}>
                Under Indian Railways PRS rules, any passenger can book from an earlier originating station (to draw from master GNWL inventory) and declare an intermediate boarding point up to 4 hours before chart preparation without penalty. The TTE's Handheld Terminal (HHT) automatically records the Jaipur boarding status.
              </p>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", alignItems: "center" }}>
          <button type="button" className="secondary-button" onClick={onClose} style={{ fontSize: "12.5px" }}>
            Keep Standard Booking
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              onApplyHack(hack);
              onClose();
            }}
            style={{
              background: "#10b981",
              color: "#ffffff",
              border: "none",
              padding: "11px 20px",
              fontWeight: 800,
              fontSize: "13px",
              borderRadius: "10px",
              boxShadow: "0 4px 15px rgba(16, 185, 129, 0.35)",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer"
            }}
          >
            <span>✓ Apply Quota Hack (Board at JP +₹{hack.fareDelta})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
