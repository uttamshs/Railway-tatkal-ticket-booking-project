"use client";

import { useEffect, useRef, useState } from "react";
import { ChatMessage, generateCopilotResponse } from "../lib/aiCopilot";
import { Train } from "../lib/types";

interface Props {
  trains: Train[];
  selectedTrain: Train | null;
  onSelectTrain: (train: Train) => void;
  onOpenQuotaModal: (train: Train) => void;
  onSwitchView: (view: "canvas" | "list") => void;
  onSetPriority: (p: any) => void;
}

export function DashAICopilot({
  trains,
  selectedTrain,
  onSelectTrain,
  onOpenQuotaModal,
  onSwitchView,
  onSetPriority
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init-1",
      sender: "assistant",
      text: "👋 Hi Harshit! I am **Dash AI Copilot**. I analyze multi-criteria trade-offs across the Jaipur ↔ Delhi corridor. Ask me about **fastest morning arrivals**, **quota-jumping hacks**, **senior lower berth allocation**, or **Pareto optimality**!",
      timestamp: "Just now"
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const resp = generateCopilotResponse(query, trains, selectedTrain);
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "assistant",
        text: resp.text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        action: resp.action
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }, 600);
  };

  const handleAction = (action?: ChatMessage["action"]) => {
    if (!action) return;
    if (action.type === "select_train") {
      const t = trains.find(item => item.id === action.payload || item.number === action.payload) || trains[0];
      onSelectTrain(t);
    } else if (action.type === "open_quota_hack") {
      const t = trains.find(item => item.number === action.payload) || trains[0];
      onOpenQuotaModal(t);
    } else if (action.type === "switch_view") {
      onSwitchView(action.payload);
    } else if (action.type === "set_priority") {
      onSetPriority(action.payload);
    }
  };

  return (
    <>
      {/* Floating Launcher Button */}
      <button
        className="copilot-launcher-btn"
        onClick={() => setIsOpen(true)}
        title="Open Dash AI Copilot"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 80,
          background: "var(--accent)",
          color: "var(--bg)",
          border: "none",
          borderRadius: "999px",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          boxShadow: "0 8px 24px rgba(30, 64, 175, 0.25)",
          fontWeight: 800,
          fontSize: "13.5px",
          cursor: "pointer",
          transition: "transform 0.2s"
        }}
      >
        <span style={{ fontSize: "16px" }}>✦</span>
        <span>Dash AI Copilot</span>
        {selectedTrain && (
          <span style={{ fontSize: "11px", opacity: 0.85, paddingLeft: "4px" }}>
            · {selectedTrain.number}
          </span>
        )}
      </button>

      {/* Floating Slide-Over Drawer / Panel */}
      {isOpen && (
        <div className="copilot-overlay" onClick={() => setIsOpen(false)}>
          <div
            className="copilot-drawer"
            onClick={e => e.stopPropagation()}
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(440px, 95vw)",
              background: "var(--panel)",
              borderLeft: "1px solid var(--line)",
              zIndex: 90,
              display: "flex",
              flexDirection: "column",
              boxShadow: "-10px 0 40px rgba(0,0,0,0.3)",
              animation: "slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "18px 20px",
                borderBottom: "1px solid var(--line)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--panel2)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "var(--accent)",
                    color: "var(--bg)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 900
                  }}
                >
                  ✦
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "15px" }}>Dash AI Copilot</h3>
                  <span style={{ fontSize: "11px", color: "#10b981", fontWeight: 700 }}>
                    ● Online · Corridor Intelligence Active
                  </span>
                </div>
              </div>
              <button
                className="icon-button"
                onClick={() => setIsOpen(false)}
                style={{ fontSize: "24px" }}
              >
                ×
              </button>
            </div>

            {/* Quick Prompt Chips */}
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--line)",
                background: "var(--panel)",
                display: "flex",
                gap: "6px",
                overflowX: "auto"
              }}
            >
              {[
                "⚡ Fastest morning train",
                "💡 Explain Ajmer quota hack",
                "🔍 Swarna Rajdhani vs Vande Bharat",
                "👴 Senior citizen lower berth",
                "📊 Explain Pareto frontier"
              ].map(chip => (
                <button
                  key={chip}
                  onClick={() => handleSend(chip)}
                  style={{
                    whiteSpace: "nowrap",
                    fontSize: "11px",
                    padding: "5px 10px",
                    borderRadius: "999px",
                    border: "1px solid var(--line)",
                    background: "var(--panel2)",
                    color: "var(--text)",
                    cursor: "pointer"
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Message Feed */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "18px 16px",
                display: "flex",
                flexDirection: "column",
                gap: "14px"
              }}
            >
              {messages.map(m => {
                const isUser = m.sender === "user";
                return (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: isUser ? "flex-end" : "flex-start",
                      maxWidth: "88%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isUser ? "flex-end" : "flex-start"
                    }}
                  >
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: "14px",
                        background: isUser ? "var(--accent)" : "var(--panel2)",
                        color: isUser ? "var(--bg)" : "var(--text)",
                        border: isUser ? "none" : "1px solid var(--line)",
                        fontSize: "13px",
                        lineHeight: "1.55",
                        whiteSpace: "pre-wrap"
                      }}
                    >
                      {m.text}

                      {/* Interactive UI Trigger Button */}
                      {m.action && (
                        <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px dashed rgba(255,255,255,0.2)" }}>
                          <button
                            className="primary-button"
                            onClick={() => handleAction(m.action)}
                            style={{
                              fontSize: "11.5px",
                              padding: "6px 12px",
                              background: isUser ? "#fff" : "var(--accent)",
                              color: isUser ? "var(--accent)" : "var(--bg)",
                              fontWeight: 800,
                              width: "100%",
                              borderRadius: "6px"
                            }}
                          >
                            {m.action.label}
                          </button>
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: "10px", color: "var(--muted)", marginTop: "4px", padding: "0 4px" }}>
                      {m.timestamp}
                    </span>
                  </div>
                );
              })}

              {isTyping && (
                <div style={{ alignSelf: "flex-start", padding: "8px 14px", background: "var(--panel2)", borderRadius: "10px", fontSize: "12px", color: "var(--muted)" }}>
                  Dash AI is formulating trade-off analysis…
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Box */}
            <div
              style={{
                padding: "14px 16px",
                borderTop: "1px solid var(--line)",
                background: "var(--panel2)",
                display: "flex",
                gap: "8px"
              }}
            >
              <input
                type="text"
                placeholder="Ask Dash AI about trains, trade-offs, quotas…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSend()}
                style={{ flex: 1, fontSize: "13px" }}
              />
              <button
                className="primary-button"
                onClick={() => handleSend()}
                style={{ padding: "0 16px" }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
