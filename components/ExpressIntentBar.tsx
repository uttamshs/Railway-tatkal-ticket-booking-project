"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  BookingIntent,
  DEFAULT_HORIZON_DAYS,
  INSTANT_SUFFICIENT_FIELDS,
  describeIntent,
  mergeIntents,
  normalizeBookingIntent,
  parseBookingIntent,
  toISODate,
  understoodCount,
} from "../lib/intent";

interface Props {
  /** Called once the request is understood. The host applies route / date / quota and opens the visualizer. */
  onLaunch: (intent: BookingIntent, engine: "instant" | "ai") => void;
}

const LLM_CLIENT_TIMEOUT_MS = 3500;

/** Examples are relative ("tomorrow") so they are valid on any day. Clicking one only fills the box. */
const EXAMPLES: { label: string; text: string }[] = [
  { label: "JP → Delhi · 2A/3A · 10am–10pm", text: "JP to Delhi tomorrow, only 2A and 3A, depart 10 am to 10 pm" },
  { label: "Cheapest sleeper", text: "Cheapest sleeper to New Delhi day after tomorrow" },
  { label: "Fastest AC · morning · ≤ ₹1500", text: "Fastest AC in the morning, under ₹1500, at least 70% chance" },
];

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechCtor = new () => SpeechRecognitionLike;

function getSpeechCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const CSS = `
.ei-card{border:1.5px solid var(--accent);border-radius:16px;padding:18px 18px 14px;background:var(--panel);box-shadow:var(--shadow);}
.ei-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.ei-badge{font-size:11px;font-weight:800;letter-spacing:.12em;color:var(--on-accent);background:var(--accent);padding:3px 9px;border-radius:999px}
.ei-title{margin:0;font-size:17px;letter-spacing:-.01em;color:var(--text)}
.ei-engine{margin-left:auto;font-size:11.5px;color:var(--muted)}
.ei-field{position:relative}
.ei-field textarea{min-height:76px;resize:none;padding:13px 52px 13px 14px;font-size:15px;line-height:1.5}
.ei-mic{position:absolute;right:10px;top:10px;width:36px;height:36px;border-radius:50%;border:1.5px solid var(--line);background:var(--panel2);color:var(--text);display:grid;place-items:center;padding:0}
.ei-mic:hover{border-color:var(--accent)}
.ei-mic[data-on="true"]{background:var(--accent);color:var(--on-accent);border-color:var(--accent);animation:ei-pulse 1.1s ease-in-out infinite}
.ei-preview{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 2px;min-height:28px;align-items:center}
.ei-hint-text{font-size:12.5px;color:var(--muted);line-height:1.5}
.ei-chip{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid var(--line);background:var(--panel2);color:var(--text);animation:ei-pop 200ms ease-out}
.ei-chip .ei-mark{color:var(--accent);font-weight:800}
.ei-chip.warn{border-color:var(--warn);color:var(--warn)}
.ei-chip.warn .ei-mark{color:var(--warn)}
.ei-foot{display:flex;align-items:center;gap:10px 14px;flex-wrap:wrap;margin-top:10px}
.ei-examples{display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex:1;min-width:0}
.ei-examples>span{font-size:12px;color:var(--muted)}
.ei-example{font-size:11.5px;font-weight:600;padding:4px 10px;border-radius:999px;border:1px solid var(--line);background:var(--panel2);color:var(--text)}
.ei-example:hover{border-color:var(--accent)}
.ei-go{display:inline-flex;align-items:center;gap:8px;white-space:nowrap}
.ei-spin{width:13px;height:13px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:ei-rot .7s linear infinite}
.ei-note{margin:8px 0 0;font-size:12.5px;color:var(--warn);font-weight:600}
.ei-keys{margin:8px 0 0;font-size:11.5px;color:var(--muted)}
.ei-divider{display:flex;align-items:center;gap:12px;margin:20px 0 18px;color:var(--muted);font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.ei-divider::before,.ei-divider::after{content:"";flex:1;height:1px;background:var(--line)}
@keyframes ei-pop{from{transform:scale(.92);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes ei-rot{to{transform:rotate(360deg)}}
@keyframes ei-pulse{0%,100%{box-shadow:0 0 0 0 rgba(30,64,175,.35)}50%{box-shadow:0 0 0 7px rgba(30,64,175,0)}}
@media (max-width:560px){.ei-engine{margin-left:0;flex-basis:100%}.ei-go{width:100%;justify-content:center}.ei-card{padding:14px}}
@media (prefers-reduced-motion:reduce){.ei-chip,.ei-mic[data-on="true"],.ei-spin{animation:none}}
`;

function MicIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v4" />
    </svg>
  );
}

/**
 * Express Intent bar — the fastest path from "I need a Tatkal ticket" to a decision.
 *
 * One sentence → route, date, quota, class, departure window, fare / duration / odds limits, priority.
 *  - Live chips under the box show EXACTLY what was understood (and what was not) before anything happens.
 *  - The instant parser runs on-device in <5 ms; a free-tier LLM only assists when the sentence is too
 *    free-form for it, with a hard 3.5 s ceiling — it can never block or break the launch.
 */
export function ExpressIntentBar({ onLaunch }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [llmAvailable, setLlmAvailable] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const headId = useId();
  const noteId = useId();

  // Is a free-tier LLM key configured on the server? (Never blocks anything; default = instant only.)
  useEffect(() => {
    let alive = true;
    fetch("/api/ai-intent", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && d.llm === true) setLlmAvailable(true);
      })
      .catch(() => {});
    setVoiceSupported(getSpeechCtor() !== null);
    return () => {
      alive = false;
      recRef.current?.abort();
    };
  }, []);

  const local = useMemo(
    () => parseBookingIntent(text, { today: new Date(), horizonDays: DEFAULT_HORIZON_DAYS }),
    [text]
  );
  const chips = useMemo(() => describeIntent(local), [local]);
  const understood = understoodCount(local);
  const hasText = text.trim().length > 0;
  const canGo = hasText && !busy && (understood > 0 || llmAvailable);

  const toggleVoice = useCallback(() => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = getSpeechCtor();
    if (!Ctor) return;
    setNote("");
    const rec = new Ctor();
    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      const spoken = Array.from(e.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (spoken) setText(spoken);
    };
    rec.onerror = (e) => {
      const code = e?.error;
      if (code === "not-allowed" || code === "service-not-allowed") setNote("Microphone access is blocked — allow it in your browser to use voice.");
      else if (code === "no-speech") setNote("I didn't hear anything — tap the mic and try again.");
      else if (code !== "aborted") setNote("Voice input isn't available right now — you can still type.");
    };
    rec.onend = () => {
      setListening(false);
      areaRef.current?.focus();
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [listening]);

  const submit = useCallback(async () => {
    const t = text.trim();
    if (!t || busy) return;
    setNote("");
    const today = new Date();
    const opts = { today, horizonDays: DEFAULT_HORIZON_DAYS };
    const parsed = parseBookingIntent(t, opts);
    let final = parsed;
    let engine: "instant" | "ai" = "instant";

    if (llmAvailable && understoodCount(parsed) < INSTANT_SUFFICIENT_FIELDS) {
      setBusy(true);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), LLM_CLIENT_TIMEOUT_MS);
      try {
        const r = await fetch("/api/ai-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: t, today: toISODate(today) }),
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (r.ok) {
          const data = await r.json();
          if (data?.ok === true && data.intent) {
            const llm = normalizeBookingIntent(data.intent, opts);
            if (understoodCount(llm) > 0 || llm.warnings.length > 0) {
              final = mergeIntents(parsed, llm);
              engine = "ai";
            }
          }
        }
      } catch {
        // Timeout / offline / bad response: the instant result is already good enough to proceed.
      } finally {
        clearTimeout(timer);
        setBusy(false);
      }
    }

    if (understoodCount(final) === 0) {
      setNote(
        final.warnings.length > 0
          ? "I understood your request but can't apply it — see the amber note above."
          : "I couldn't pick out a route, date, class or time. Try: “JP to Delhi tomorrow, 2A or 3A, 10 am to 10 pm”."
      );
      return;
    }
    onLaunch(final, engine);
  }, [text, busy, llmAvailable, onLaunch]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <section className="ei-card" aria-labelledby={headId}>
        <div className="ei-head">
          <span className="ei-badge" aria-hidden="true">✦ EXPRESS</span>
          <h3 id={headId} className="ei-title">Just say what you need</h3>
          <span className="ei-engine">{llmAvailable ? "Instant parser + AI assist" : "Understood instantly on this device"}</span>
        </div>

        <div className="ei-field">
          <textarea
            ref={areaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (note) setNote("");
            }}
            onKeyDown={onKeyDown}
            maxLength={400}
            rows={2}
            placeholder="e.g. Hey, I wanna book a ticket from JP to Delhi, only 2A and 3A, on 31st Oct, 10 am to 10 pm"
            aria-label="Describe your journey in one sentence"
            aria-describedby={note ? noteId : undefined}
            spellCheck={false}
          />
          {voiceSupported && (
            <button
              type="button"
              className="ei-mic"
              data-on={listening}
              onClick={toggleVoice}
              aria-pressed={listening}
              aria-label={listening ? "Stop listening" : "Speak your request"}
              title={listening ? "Listening… tap to stop" : "Speak your request"}
            >
              <MicIcon />
            </button>
          )}
        </div>

        <div className="ei-preview" aria-live="polite">
          {chips.length > 0 ? (
            chips.map((c) => (
              <span key={c.key} className={`ei-chip${c.warn ? " warn" : ""}`}>
                <span className="ei-mark" aria-hidden="true">{c.warn ? "⚠" : "✓"}</span>
                {c.warn && <span className="sr-only" style={{ position: "absolute", left: -9999 }}>Not applied: </span>}
                {c.label}
              </span>
            ))
          ) : hasText ? (
            <span className="ei-hint-text">
              {llmAvailable ? "Press Enter — AI will read this one." : "Nothing recognised yet — mention a route, date, class or time."}
            </span>
          ) : listening ? (
            <span className="ei-hint-text">Listening… say your route, date, class and time.</span>
          ) : (
            <span className="ei-hint-text">
              Mention route, date, class, time window, fare cap — or what matters most (cheapest, fastest, best odds). I&apos;ll set every filter for you.
            </span>
          )}
        </div>

        <div className="ei-foot">
          <div className="ei-examples">
            <span>Try:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                className="ei-example"
                onClick={() => {
                  setText(ex.text);
                  setNote("");
                  areaRef.current?.focus();
                }}
              >
                {ex.label}
              </button>
            ))}
          </div>
          <button type="button" className="primary-button ei-go" onClick={() => void submit()} disabled={!canGo} aria-busy={busy}>
            {busy ? (
              <>
                <span className="ei-spin" aria-hidden="true" /> Understanding…
              </>
            ) : (
              <>⚡ Show matching trains <span aria-hidden="true">→</span></>
            )}
          </button>
        </div>

        {note && (
          <p id={noteId} className="ei-note" role="alert">
            {note}
          </p>
        )}
        <p className="ei-keys">Enter to go · Shift+Enter for a new line · you can still adjust every filter afterwards</p>
      </section>
      <div className="ei-divider" aria-hidden="true">
        <span>or set up manually</span>
      </div>
    </>
  );
}
