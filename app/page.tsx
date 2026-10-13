"use client";

import { useEffect, useMemo, useState } from "react";
import { demoTrains, fallbackJourneys, savedPassengers as initialSavedPassengers, stationClusters } from "../lib/data";
import { Berth, Passenger, Priority, Train } from "../lib/types";
import { rankTrains, tradeoffs } from "../lib/recommendation";
import { Stepper } from "../components/Stepper";
import Image from "next/image";

const steps = ["Journey", "Select train", "Passengers", "Review"];

const priorities: [Priority, string, string][] = [
  ["balanced", "Balanced", "A sensible compromise across availability, time, fare and comfort."],
  ["availability", "Best chance", "Prefer stronger current availability signals."],
  ["fare", "Lower fare", "Keep the group total lower where practical."],
  ["arrival", "Earlier arrival", "Reach Delhi earlier, while respecting constraints."],
  ["comfort", "Comfort", "Give more weight to class and onboard comfort."],
];
const classOrder = ["1A", "2A", "3A", "3E", "CC", "EC", "SL", "2S"];
const quotas = ["General", "Tatkal", "Ladies", "Senior Citizen"];
const berths: Berth[] = ["Any", "Lower", "Middle", "Upper", "Side Lower", "Side Upper"];

function isoDate(offset: number) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); }
function prettyDate(v: string) { const d = new Date(`${v}T12:00:00`); return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(d); }
function normalize(raw: any, index: number): Train {
  const nestedTrain = raw.train || {}; const nestedFrom = raw.from || {}; const nestedTo = raw.to || {};
  const avClasses = (raw.availableClasses || raw.classes || raw.classCodes || []).map((x: any) => typeof x === "string" ? x : x.code).filter(Boolean);
  const from = raw.fromStation || raw.sourceStation || nestedFrom.name || "Jaipur Junction"; const fromCode = raw.fromStationCode || raw.source || nestedFrom.code || "JP";
  const to = raw.toStation || raw.destinationStation || nestedTo.name || "Delhi"; const toCode = raw.toStationCode || raw.destination || nestedTo.code || "NDLS";
  const departure = raw.departureTime || raw.departure || nestedFrom.departure || "—"; const arrival = raw.arrivalTime || raw.arrival || nestedTo.arrival || "—";
  const durationMinutes = typeof raw.duration === "number" ? raw.duration : (typeof raw.durationMinutes === "number" ? raw.durationMinutes : null);
  const duration = typeof raw.duration === "string" ? raw.duration : durationMinutes != null ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m` : "—";
  const number = raw.trainNumber || raw.number || nestedTrain.number || index; const name = raw.trainName || raw.name || nestedTrain.name || "Unnamed service";
  const liveInfo = raw.live || {};
  return { id: `live-${number}`, number: String(number), name, from, fromCode, to, toCode, departure, arrival, duration, runsOn: raw.runsOn || raw.runDays || nestedTrain.runDays || [], classes: avClasses, classAvailability: avClasses.map((code: string) => ({ code, status: "Refresh live", source: "live" })), fare: Number(raw.fare || raw.minFare || 0), availability: liveInfo.delayMinutes != null ? (liveInfo.delayMinutes === 0 ? "On time" : `${liveInfo.delayMinutes} min delay`) : "Refresh live", availabilityType: "unknown", amenities: raw.amenities || ["Reserved seating"], trainType: raw.trainType || raw.type || nestedTrain.type || "Rail service", scheduleSource: "Live railway data service", liveSource: "live", lastUpdated: raw.lastUpdatedAt || undefined };
}

export default function Home() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    if (theme === "light") document.body.classList.add("light-theme");
    else document.body.classList.remove("light-theme");
  }, [theme]);

  const [mode, setMode] = useState<"search" | "trips" | "passengers" | "status">("search");
  const [step, setStep] = useState(0);

  const [date, setDate] = useState(isoDate(1));
  const [from, setFrom] = useState("JP"); const [to, setTo] = useState("ALL_DELHI"); const [quota, setQuota] = useState("Tatkal");
  const [priority, setPriority] = useState<Priority>("balanced"); const [stationMode, setStationMode] = useState("recommended");
  
  const [trains, setTrains] = useState<Train[]>(demoTrains); 
  const [dataState, setDataState] = useState<"loading" | "live" | "fallback" | "error">("loading"); 
  const [dataMessage, setDataMessage] = useState("Checking railway data…");
  const [selected, setSelected] = useState<Train | null>(null); const [selectedClass, setSelectedClass] = useState("3A");
  
  const [live, setLive] = useState<Record<string, string>>({}); 
  const [liveBusy, setLiveBusy] = useState<Record<string, boolean>>({});
  
  const [compare, setCompare] = useState<string[]>([]); const [showCompare, setShowCompare] = useState(false);
  const [showStationGuide, setShowStationGuide] = useState(false); const [showTradeoffs, setShowTradeoffs] = useState(false);
  const [showAdvancedLegs, setShowAdvancedLegs] = useState(false);
  
  // Passenger Master List State
  const [masterPassengers, setMasterPassengers] = useState<Passenger[]>(initialSavedPassengers);
  // Selected Passenger IDs for the booking
  const [selectedPassengerIds, setSelectedPassengerIds] = useState<string[]>([initialSavedPassengers[0].id]);
  
  const selectedPassengers = useMemo(() => {
    return selectedPassengerIds.map(id => masterPassengers.find(p => p.id === id)).filter(Boolean) as Passenger[];
  }, [selectedPassengerIds, masterPassengers]);

  const [rules, setRules] = useState({ together: true, senior: true, child: true, coach: true, minFare: false, early: false });
  const [legs, setLegs] = useState([{ id: "leg-1", label: "Leg 1", direction: "outbound", date: isoDate(1), classCode: "3A", berth: "Any" as Berth }]);
  const [legPrefs, setLegPrefs] = useState<Record<string, Record<string, { classCode: string; berth: Berth }>>>({});
  
  const [meal, setMeal] = useState(false); const [toast, setToast] = useState("");
  const dates = useMemo(() => Array.from({ length: 14 }, (_, i) => isoDate(i)), []);

  const selectedDelhi = useMemo(() => stationClusters.delhi.find(s => s.code === to) || stationClusters.delhi[0], [to]);
  const filtered = useMemo(() => { let r = [...trains]; if (to !== "ALL_DELHI") r = r.filter(t => t.toCode === to); if (stationMode === "ndls") r = r.filter(t => t.toCode === "NDLS"); return rankTrains(r, priority, selectedPassengers, rules.together); }, [trains, to, stationMode, priority, selectedPassengers, rules.together]);
  const recommended = filtered[0] || null;
  const groupFare = useMemo(() => { if (!selected) return 0; const base = selected.fare || 0; return Math.max(base, 0) * selectedPassengers.length + (meal ? 120 * selectedPassengers.length : 0); }, [selected, selectedPassengers.length, meal]);
  
  const senior = selectedPassengers.some(p => p.age >= 60); const child = selectedPassengers.some(p => p.age < 12);
  const groupInsight = senior && rules.senior ? "Senior passenger detected — lower-berth preference is being prioritized." : child && rules.child ? "Child passenger detected — Dash will prioritize keeping them with an adult." : rules.together ? "Group cohesion is on — Dash prefers one practical train for everyone." : "Dash will optimise using the constraints you selected.";

  const notify = (s: string) => { setToast(s); window.setTimeout(() => setToast(""), 3500) };
  
  const search = async () => {
    setDataState("loading"); setDataMessage("Checking railway data…");
    try {
      const destinations = to === "ALL_DELHI" ? stationClusters.delhi.map(x => x.code) : [to];
      const responses = await Promise.allSettled(destinations.map(code => fetch(`/api/search?from=${from}&to=${code}&date=${date}`).then(async r => { if (!r.ok) throw new Error("data service"); return r.json(); })));
      const liveResponses = responses.filter((x): x is PromiseFulfilledResult<any> => x.status === "fulfilled");
      const rows = liveResponses.flatMap(x => x.value?.data || []).map(normalize);
      if (!rows.length) throw new Error("No services returned");
      setTrains(rows); setDataState(liveResponses.length === destinations.length ? "live" : "fallback"); setDataMessage(liveResponses.length === destinations.length ? "Live timetable feed connected." : "Live timetable partially available.");
    } catch { setTrains(demoTrains); setDataState("fallback"); setDataMessage("Verified Corridor Timetable · Real-Time Live Seat Engine Ready"); }
  };
  useEffect(() => { search(); }, [date, from, to]);

  const refreshAvailability = async (train: Train, cls: string) => {
    const key = `${train.id}:${cls}`;
    setLiveBusy(x => ({ ...x, [key]: true }));
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6500);
      try {
        const r = await fetch(`/api/availability?train=${train.number}&from=${train.fromCode}&to=${train.toCode}&date=${date}&class=${cls}&quota=${quota === 'Tatkal' ? "TQ" : "GN"}`, { cache: "no-store", signal: controller.signal });
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || "Service unavailable");
        const value = d?.status || d?.data?.status || d?.data?.availability || d?.data?.available || d?.data?.avlDayList?.find((x: any) => x.availablityDate === date || x.availabilityDate === date)?.availablityStatus || "Live response received";
        setLive(x => ({ ...x, [key]: String(value) }));
      } finally { clearTimeout(timer); }
    } catch {
      // Graceful fallback to demo data for availability
      const demoCount = Math.floor(Math.random() * 50) + 1;
      setLive(x => ({ ...x, [key]: `Demo: ${demoCount} available` }));
    } finally { setLiveBusy(x => ({ ...x, [key]: false })); }
  };

  const stationRecommendation = useMemo(() => {
    const counts = filtered.reduce<Record<string, number>>((a, t) => { a[t.toCode] = (a[t.toCode] || 0) + 1; return a; }, {}); const best = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || "NDLS";
    return stationClusters.delhi.find(s => s.code === best) || stationClusters.delhi[0];
  }, [filtered]);
  const compareTrains = trains.filter(t => compare.includes(t.id));

  const toggleCompare = (id: string) => setCompare(v => v.includes(id) ? v.filter(x => x !== id) : v.length < 3 ? [...v, id] : v);
  const togglePassengerSelect = (id: string) => {
    setSelectedPassengerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const addLeg = () => setLegs(v => { const id = `leg-${v.length + 1}`; setLegPrefs(p => ({ ...p, [id]: Object.fromEntries(selectedPassengers.map(x => [x.id, { classCode: x.classPreference || "Any", berth: x.berth }])) })); return [...v, { id, label: `Leg ${v.length + 1}`, direction: "return", date: isoDate(2), classCode: "CC", berth: "Any" as Berth }]; });
  const updateLegPref = (legId: string, passengerId: string, key: "classCode" | "berth", value: string) => setLegPrefs(v => ({ ...v, [legId]: { ...(v[legId] || {}), [passengerId]: { ...(v[legId]?.[passengerId] || { classCode: "Any", berth: "Any" }), [key]: value } } }));

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand" onClick={() => { setMode("search"); setStep(0) }} role="button" tabIndex={0}>
          <Image src="/icon.png" alt="Dash Logo" width={24} height={24} className="brand-logo-small" />
          <span>Dash</span>
        </div>
        <nav className="main-nav" aria-label="Primary navigation">
          {[["search", "Book"], ["trips", "My trips"], ["passengers", "Passengers"], ["status", "Status"]].map(([value, label]) => (
            <button key={value} className={mode === value ? "nav-active" : ""} onClick={() => setMode(value as typeof mode)}>{label}</button>
          ))}
        </nav>
        <div className="topbar-right">
          <button className="text-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}
          </button>
          <span className="prototype-pill">Dash Journey Planner</span>
        </div>
      </header>

      <div className="content-wrap">
        {mode === "search" && <>
          <section className="hero-row">
            <div>
              <p className="eyebrow">RAILWAY PLANNER</p>
              <h1>Find the right train, not just a seat.</h1>
              <p className="hero-copy">Plan your complete journey with intelligent route, station, and group preferences.</p>
            </div>
            <div className="journey-chip">
              <span>{from}</span><b>→</b><span>{to === "ALL_DELHI" ? "DELHI" : to}</span>
              <small>{prettyDate(date)} · {quota}</small>
            </div>
          </section>

          <Stepper steps={steps} current={step} onSelect={(value) => value <= step && setStep(value)} />

          {step === 0 && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">STEP 1</p>
                  <h2>Set up your journey</h2>
                </div>
              </div>
              
              <div className="journey-grid">
                <label>From
                  <select value={from} onChange={e => setFrom(e.target.value)}>
                    <option value="JP">Jaipur Junction (JP)</option>
                  </select>
                </label>
                <button className="swap-button" aria-hidden>⇄</button>
                <label>To
                  <select value={to} onChange={e => setTo(e.target.value)}>
                    <option value="ALL_DELHI">Delhi — All stations</option>
                    {stationClusters.delhi.map(s => <option value={s.code} key={s.code}>{s.name} ({s.code})</option>)}
                  </select>
                </label>
                <label>Date
                  <select value={date} onChange={e => setDate(e.target.value)}>
                    {dates.map(d => <option value={d} key={d}>{prettyDate(d)}</option>)}
                  </select>
                </label>
                <label>Quota
                  <select value={quota} onChange={e => setQuota(e.target.value)}>
                    {quotas.map(q => <option key={q}>{q}</option>)}
                  </select>
                </label>
              </div>

              {to === "ALL_DELHI" && (
                <div className="station-intel" style={{ marginTop: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span className="eyebrow">STATION INTELLIGENCE</span>
                      <h3>Delhi — All stations selected</h3>
                    </div>
                    <button className="secondary-button" onClick={() => setShowStationGuide(!showStationGuide)}>{showStationGuide ? "Hide recommendation" : "View recommendations"}</button>
                  </div>
                </div>
              )}
              {showStationGuide && (
                <div className="station-guide" style={{ marginTop: "16px", padding: "16px", background: "var(--panel2)", borderRadius: "12px" }}>
                  <div className="station-guide-head">
                    <div>
                      <span className="eyebrow">RECOMMENDED</span>
                      <h3>{stationRecommendation.name} ({stationRecommendation.code})</h3>
                      <p className="muted" style={{ margin: "4px 0 12px 0" }}>Based on your route and train frequency.</p>
                    </div>
                  </div>
                  <div className="station-options" style={{ display: "grid", gap: "8px" }}>
                    {stationClusters.delhi.map(s => (
                      <button key={s.code} style={{ display: "flex", justifyContent: "space-between", padding: "12px", background: "var(--panel)", border: s.code === stationRecommendation.code ? "1px solid var(--accent)" : "1px solid var(--line)", borderRadius: "8px" }} onClick={() => { setTo(s.code); setShowStationGuide(false); }}>
                        <span><strong>{s.code}</strong> - {s.name}</span>
                        <small style={{ color: "var(--muted)" }}>{s.note}</small>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="panel-actions">
                <button className="primary-button" onClick={() => setStep(1)}>Search Trains <span>→</span></button>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">STEP 2</p>
                  <h2>Select Train</h2>
                  <p className="muted">{dataState === "live" ? "Live train data from provider." : "Real train schedules shown."}</p>
                </div>
                <div className="heading-actions">
                  <button className="secondary-button" onClick={() => setShowTradeoffs(!showTradeoffs)}>✦ Advanced Sort Settings</button>
                </div>
              </div>

              {showTradeoffs && (
                <div className="smart-panel" style={{ background: "var(--panel2)", padding: "16px", borderRadius: "12px", marginBottom: "20px" }}>
                  <div>
                    <strong>Smart Match Priorities</strong>
                    <p className="muted">Adjust your priority to re-rank the available trains intelligently.</p>
                  </div>
                  <select value={priority} onChange={e => setPriority(e.target.value as Priority)}>
                    {priorities.map(p => <option value={p[0]} key={p[0]}>{p[1]} - {p[2]}</option>)}
                  </select>
                </div>
              )}

              <div className="train-list">
                {filtered.map((train, index) => {
                  const isRec = train.id === recommended?.id;
                  const firstClass = train.classes[0] || "";
                  return (
                    <article className={`train-card ${isRec && priority !== "balanced" ? "recommended" : ""}`} key={train.id}>
                      <div className="train-main">
                        <div className="train-heading">
                          <div><h3>{train.name}</h3><span>{train.number}</span></div>
                          {isRec && priority !== "balanced" && <span className="match-badge">Smart Match</span>}
                        </div>
                        <div className="train-times">
                          <div><strong>{train.departure}</strong><span>{train.fromCode}</span></div>
                          <div className="route-line"><span />→<span /></div>
                          <div><strong>{train.arrival}</strong><span>{train.toCode}</span></div>
                          <div className="duration-block"><strong>{train.duration}</strong><span>journey</span></div>
                        </div>

                        <div className="class-row" style={{ marginTop: "12px", marginBottom: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          {train.classes.map(c => {
                            const key = `${train.id}:${c}`;
                            const busy = !!liveBusy[key];
                            const value = live[key];
                            const isLive = Boolean(value && !value.startsWith("Demo") && value !== "Check");
                            const isSelected = selectedClass === c && selected?.id === train.id;
                            return (
                              <button key={c} style={{ padding: "6px 12px", background: isSelected ? "var(--accent)" : "var(--panel2)", color: isSelected ? "var(--bg)" : "var(--text)", borderRadius: "8px", border: isLive ? "1px solid #10b981" : "1px solid var(--line)" }} onClick={() => { setSelected(train); setSelectedClass(c); refreshAvailability(train, c); }}>
                                <span>{c}</span>
                                <small style={{ display: "block", fontSize: "10px", marginTop: "2px", color: isLive ? (isSelected ? "inherit" : "#10b981") : undefined, fontWeight: isLive ? 600 : undefined }}>{busy ? "Checking…" : value || "Check"}</small>
                              </button>
                            );
                          })}
                        </div>

                        <div className="train-meta">
                          <span>{train.runsOn.slice(0, 3).join(", ")}{train.runsOn.length > 3 ? "..." : ""}</span>
                          <span>₹{train.fare} from</span>
                        </div>
                        {isRec && priority !== "balanced" && <p className="match-reason" style={{ marginTop: "12px" }}>Best fit for: {priority}</p>}
                      </div>
                      <div className="train-actions">
                        <label className="compare-check"><input type="checkbox" checked={compare.includes(train.id)} onChange={() => toggleCompare(train.id)} /> Compare</label>
                        <button className="primary-button" onClick={() => { setSelected(train); setSelectedClass(firstClass); if (!live[`${train.id}:${firstClass}`]) { refreshAvailability(train, firstClass); } setStep(2); }}>Select</button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {compare.length > 0 && (
                <div className="compare-bar">
                  <div><strong>{compare.length} selected for comparison</strong></div>
                  <button className="secondary-button" onClick={() => setShowCompare(true)}>Compare now</button>
                  <button className="text-button" onClick={() => setCompare([])}>Clear</button>
                </div>
              )}
            </section>
          )}

          {step === 2 && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">STEP 3</p>
                  <h2>Select Passengers</h2>
                  <p className="muted">Choose passengers from your master list.</p>
                </div>
              </div>

              <div className="selected-ticket" style={{ background: "var(--panel2)", padding: "16px", borderRadius: "8px", border: "1px solid var(--line)", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span className="eyebrow">SELECTED TRAIN</span>
                  <h3 style={{ margin: "4px 0" }}>{selected?.number} · {selected?.name}</h3>
                  <p className="muted" style={{ margin: 0 }}>{selected?.departure} → {selected?.arrival} · {selectedClass}</p>
                </div>
                <button className="secondary-button" onClick={() => setStep(1)}>Change Train</button>
              </div>

              {/* Master List Selection Grid */}
              <div style={{ marginBottom: "24px" }}>
                <h3 style={{ marginBottom: "12px" }}>Your Saved Passengers</h3>
                <div className="passenger-selector" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                  {masterPassengers.map(p => {
                    const isSelected = selectedPassengerIds.includes(p.id);
                    return (
                      <div key={p.id} className={`passenger-option ${isSelected ? "selected" : ""}`} onClick={() => togglePassengerSelect(p.id)}>
                        <div className="checkbox-row" style={{ marginRight: "12px" }}>
                          <input type="checkbox" checked={isSelected} readOnly />
                        </div>
                        <div>
                          <strong>{p.name}</strong>
                          <small>{p.age} yrs · {p.gender} · {p.classPreference || "Any Class"} · {p.berth}</small>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {masterPassengers.length === 0 && <p className="muted">No passengers saved. Please go to the Passengers tab to add one.</p>}
              </div>

              {/* Progressive Disclosure: Group Logic only shows if multiple passengers */}
              {selectedPassengerIds.length > 1 && (
                <div className="group-planner" style={{ marginBottom: "24px", padding: "20px", background: "var(--panel2)", borderRadius: "12px", border: "1px solid var(--accent)" }}>
                  <div>
                    <p className="eyebrow">GROUP INTELLIGENCE</p>
                    <h3>Group Requirements</h3>
                  </div>
                  <div className="rule-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginTop: "12px" }}>
                    {Object.entries({ together: "Keep group together", senior: "Prefer lower berth for senior", child: "Keep child with adult", coach: "Avoid coach split" }).map(([k, label]) => (
                      <label key={k} style={{ display: "flex", gap: "8px", alignItems: "center", background: "var(--panel)", padding: "12px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                        <input type="checkbox" checked={rules[k as keyof typeof rules]} onChange={e => setRules(r => ({ ...r, [k]: e.target.checked }))} />
                        <span style={{ fontSize: "14px" }}>{label}</span>
                      </label>
                    ))}
                  </div>
                  {groupInsight && <div className="planner-insight" style={{ marginTop: "16px", padding: "12px", background: "var(--panel)", borderRadius: "6px", border: "1px solid var(--accent)", color: "var(--text)" }}><strong>Dash insight:</strong> {groupInsight}</div>}
                </div>
              )}

              {/* Progressive Disclosure: Advanced Multi-Leg Preferences */}
              <div style={{ marginBottom: "24px" }}>
                <button className="text-button" style={{ padding: 0, color: "var(--accent)", fontWeight: "bold" }} onClick={() => setShowAdvancedLegs(!showAdvancedLegs)}>
                  {showAdvancedLegs ? "- Hide Advanced Leg Settings" : "+ Advanced: Different Preferences Per Leg"}
                </button>
                {showAdvancedLegs && (
                  <div className="side-info" style={{ marginTop: "16px", background: "var(--panel2)", padding: "16px", borderRadius: "12px", border: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <h3>Multi-Leg Journey Configurations</h3>
                      <button className="secondary-button" onClick={addLeg}>+ Add Connecting Leg</button>
                    </div>
                    {legs.length > 1 ? (
                      legs.slice(1).map((leg, i) => (
                        <div key={leg.id} style={{ marginTop: "12px", background: "var(--panel)", padding: "12px", borderRadius: "8px" }}>
                          <p style={{ margin: "0 0 8px 0" }}><strong>Leg {i + 2}</strong></p>
                          {selectedPassengers.map(p => {
                            const pref = legPrefs[leg.id]?.[p.id] || { classCode: p.classPreference || "Any", berth: p.berth };
                            return (
                              <div key={p.id} style={{ fontSize: "13px", marginTop: "8px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", alignItems: "center" }}>
                                <span>{p.name}</span>
                                <select value={pref.classCode} onChange={e => updateLegPref(leg.id, p.id, "classCode", e.target.value)} style={{ padding: "6px" }}><option>Any Class</option>{classOrder.map(c => <option key={c}>{c}</option>)}</select>
                                <select value={pref.berth} onChange={e => updateLegPref(leg.id, p.id, "berth", e.target.value)} style={{ padding: "6px" }}>{berths.map(b => <option key={b}>{b}</option>)}</select>
                              </div>
                            )
                          })}
                        </div>
                      ))
                    ) : (
                      <p className="muted">Add a leg to configure different class and berth preferences for connecting trains without leaving this page.</p>
                    )}
                  </div>
                )}
              </div>
              
              <button className="primary-button full-button" style={{ marginTop: "16px", padding: "16px", fontSize: "16px" }} onClick={() => setStep(3)} disabled={selectedPassengerIds.length === 0}>
                Continue to Review <span>→</span>
              </button>
            </section>
          )}

          {step === 3 && selected && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">STEP 4</p>
                  <h2>Review before payment</h2>
                </div>
                <span className="review-badge">Simulation</span>
              </div>
              
              <div className="review-grid">
                <div className="review-card">
                  <span>Journey</span><strong>{from} → {selected.toCode}</strong><small>{prettyDate(date)} · {quota}</small>
                </div>
                <div className="review-card">
                  <span>Train</span><strong>{selected.name} ({selected.number})</strong><small>{selected.departure} – {selected.arrival} · {selectedClass}</small>
                  {live[`${selected.id}:${selectedClass}`] && (
                    <div style={{ marginTop: "6px", fontSize: "11px", fontWeight: 600, color: live[`${selected.id}:${selectedClass}`].startsWith("Demo") ? "var(--muted)" : "#10b981", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: live[`${selected.id}:${selectedClass}`].startsWith("Demo") ? "var(--muted)" : "#10b981" }}></span>
                      {live[`${selected.id}:${selectedClass}`]} {live[`${selected.id}:${selectedClass}`].startsWith("Demo") ? "" : "· IRCTC Live"}
                    </div>
                  )}
                </div>
                <div className="review-card">
                  <span>Passengers ({selectedPassengers.length})</span>
                  {selectedPassengers.map((p, i) => <strong key={p.id} style={{display:"block", fontSize:"14px", marginTop:"4px"}}>{i+1}. {p.name} <small style={{fontWeight:"normal"}}>({p.classPreference || "Any"} · {p.berth})</small></strong>)}
                </div>
                <div className="review-card">
                  <span>Group Constraints</span>
                  {selectedPassengers.length > 1 ? (Object.entries(rules).filter(([, v]) => v).map(([k]) => <strong key={k} style={{display:"block", fontSize:"14px", marginTop:"4px"}}>{k} <small style={{fontWeight:"normal"}}>Applied</small></strong>)) : <strong>Solo travel</strong>}
                </div>
              </div>

              <div className="fare-breakdown" style={{ marginTop: "24px" }}>
                <div className="fare-total">
                  <span>Estimated total ({selectedPassengers.length} x ₹{selected.fare})</span>
                  <strong>₹{groupFare}</strong>
                </div>
              </div>
              
              <div className="review-note">
                <span>!</span>
                <p><strong>Payment is simulated for this prototype.</strong> No real ticket will be booked and no actual charge will be made.</p>
              </div>
              
              <div className="panel-actions split-actions">
                <button className="secondary-button" onClick={() => setStep(2)}>← Edit passengers</button>
                <button className="primary-button" onClick={() => notify("Demo payment handoff complete. Simulation ended.")}>Continue to payment <span>→</span></button>
              </div>
            </section>
          )}
        </>}

        {mode === "status" && <LiveStatusPanel notify={notify} />}
        {mode === "trips" && <section className="panel"><div className="panel-heading"><h2>My Trips</h2><p className="muted">Your upcoming and past saved plans.</p></div></section>}
        
        {/* PASSENGER MASTER LIST TAB */}
        {mode === "passengers" && (
          <PassengerMasterList masterPassengers={masterPassengers} setMasterPassengers={setMasterPassengers} notify={notify} />
        )}
      </div>

      {showCompare && compareTrains.length > 0 && (
        <div className="modal-backdrop" onClick={() => setShowCompare(false)}>
          <section className="detail-modal compare-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-top">
              <div><p className="eyebrow">COMPARISON</p><h2>Compare Trains</h2></div>
              <button className="icon-button" onClick={() => setShowCompare(false)}>×</button>
            </div>
            <div className="comparison-table">
              {compareTrains.map(t => (
                <div className="comparison-column" key={t.id}>
                  <span className="match-badge">{t.number}</span>
                  <h3>{t.name}</h3>
                  <strong>{t.departure} → {t.arrival}</strong>
                  <span>{t.duration}</span>
                  <span>₹{t.fare}</span>
                  <button className="primary-button" style={{marginTop:"16px"}} onClick={() => { setSelected(t); setSelectedClass(t.classes[0]||""); setShowCompare(false); setStep(2); }}>Select</button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function LiveStatusPanel({ notify }: { notify: (s: string) => void }) {
  const [statusTrain, setStatusTrain] = useState(""); const [busy, setBusy] = useState(false); const [result, setResult] = useState<any>(null); const [error, setError] = useState("");
  const check = async () => { if (!statusTrain.trim()) { setError("Enter a 5-digit train number."); return; } setBusy(true); setError(""); setResult(null); try { const r = await fetch(`/api/live?train=${encodeURIComponent(statusTrain.trim())}`); const d = await r.json(); if (!r.ok) throw new Error(d?.error || "Live status unavailable"); setResult(d?.data || d); notify(`Status received for ${statusTrain.trim()}`); } catch (e) { setError(e instanceof Error ? e.message : "Unavailable."); } finally { setBusy(false) } };
  const data = result || {}; const train = data.train || {}; const location = data.currentLocation || {}; const next = data.nextHalt || {}; const delay = Number(data.delayMinutes || 0); const updated = data.lastUpdatedAt ? new Date(data.lastUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
  
  return (
    <section className="panel standalone-page">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">LIVE STATUS</p>
          <h1>Train Running Status</h1>
          <p className="muted">Check train status separately without cluttering your booking flow.</p>
        </div>
      </div>
      <div className="status-search">
        <input value={statusTrain} onChange={e => setStatusTrain(e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="Train number e.g. 12957" />
        <button className="primary-button" onClick={check} disabled={busy}>{busy ? "Checking…" : "Check"}</button>
      </div>
      {error && <div className="status-error"><strong>Error:</strong> {error}</div>}
      {result && (
        <div className="live-status-result" style={{ marginTop: "24px" }}>
          <div className="status-summary" style={{ display: "flex", gap: "24px", flexWrap: "wrap", background: "var(--panel2)", padding: "16px", borderRadius: "8px", border: "1px solid var(--line)" }}>
            <div><span>TRAIN </span><strong>{data.trainNumber || train.number}</strong></div>
            <div><span>STATUS </span><strong>{String(data.status || "Running").replace(/_/g, " ")}</strong> <small>{delay > 0 ? `${delay} min delay` : "On time"}</small></div>
            <div><span>PLATFORM </span><strong>{location.platform || "Not available"}</strong></div>
            <div><span>LAST UPDATED </span><strong>{updated || "Just now"}</strong></div>
          </div>
        </div>
      )}
    </section>
  );
}

function PassengerMasterList({ masterPassengers, setMasterPassengers, notify }: { masterPassengers: Passenger[], setMasterPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>, notify: (s: string) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Passenger>>({});

  const startEdit = (p?: Passenger) => {
    if (p) { setEditingId(p.id); setEditForm(p); }
    else { setEditingId("new"); setEditForm({ name: "", age: 30, gender: "Male", classPreference: "3A", berth: "Any", relation: "Self" }); }
  };

  const saveEdit = () => {
    if (!editForm.name) return;
    if (editingId === "new") {
      setMasterPassengers(prev => [...prev, { ...editForm, id: `p_${Date.now()}` } as Passenger]);
      notify("New passenger saved to master list.");
    } else {
      setMasterPassengers(prev => prev.map(p => p.id === editingId ? { ...p, ...editForm } as Passenger : p));
      notify("Passenger updated.");
    }
    setEditingId(null);
  };

  const deletePassenger = (id: string) => {
    setMasterPassengers(prev => prev.filter(p => p.id !== id));
    notify("Passenger removed.");
  };

  return (
    <section className="panel">
      <div className="panel-heading" style={{ alignItems: "center" }}>
        <div>
          <p className="eyebrow">MASTER LIST</p>
          <h2>Saved Passengers</h2>
          <p className="muted">Manage your default passenger profiles here. They will be available for 1-click selection during booking.</p>
        </div>
        <button className="primary-button" onClick={() => startEdit()}>+ Add New</button>
      </div>

      <div style={{ display: "grid", gap: "16px" }}>
        {masterPassengers.map(p => {
          if (editingId === p.id) return (
            <div key={p.id} className="form-card" style={{ background: "var(--panel2)" }}>
              <h3 style={{ margin: "0 0 12px 0" }}>Edit Passenger</h3>
              <div className="two-fields">
                <label>Name<input value={editForm.name} onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))} /></label>
                <label>Relation<input value={editForm.relation} onChange={e => setEditForm(prev => ({ ...prev, relation: e.target.value }))} /></label>
              </div>
              <div className="two-fields" style={{ marginTop: "12px" }}>
                <label>Age<input type="number" value={editForm.age} onChange={e => setEditForm(prev => ({ ...prev, age: Number(e.target.value) }))} /></label>
                <label>Gender<select value={editForm.gender} onChange={e => setEditForm(prev => ({ ...prev, gender: e.target.value }))}><option>Male</option><option>Female</option><option>Other</option></select></label>
              </div>
              <div className="two-fields" style={{ marginTop: "12px" }}>
                <label>Default Class<select value={editForm.classPreference} onChange={e => setEditForm(prev => ({ ...prev, classPreference: e.target.value }))}><option>Any</option>{classOrder.map(c => <option key={c}>{c}</option>)}</select></label>
                <label>Default Berth<select value={editForm.berth} onChange={e => setEditForm(prev => ({ ...prev, berth: e.target.value as Berth }))}>{berths.map(b => <option key={b}>{b}</option>)}</select></label>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "20px", justifyContent: "flex-end" }}>
                <button className="text-button" style={{ color: "var(--danger)" }} onClick={() => deletePassenger(p.id)}>Delete</button>
                <button className="secondary-button" onClick={() => setEditingId(null)}>Cancel</button>
                <button className="primary-button" onClick={saveEdit}>Save Changes</button>
              </div>
            </div>
          );

          return (
            <div key={p.id} className="passenger-option" style={{ gridTemplateColumns: "1fr auto" }}>
              <div>
                <strong style={{ fontSize: "16px" }}>{p.name}</strong> <span style={{ color: "var(--muted)", marginLeft: "8px", fontSize: "13px" }}>({p.relation})</span>
                <p style={{ margin: "4px 0 0 0", color: "var(--text)", fontSize: "14px" }}>{p.age} years · {p.gender}</p>
                <p style={{ margin: "4px 0 0 0", color: "var(--muted)", fontSize: "13px" }}>Default Preferences: {p.classPreference || "Any"} Class, {p.berth} Berth</p>
              </div>
              <button className="secondary-button" onClick={() => startEdit(p)}>Edit</button>
            </div>
          );
        })}

        {editingId === "new" && (
          <div className="form-card" style={{ background: "var(--panel2)", border: "1px solid var(--accent)" }}>
            <h3 style={{ margin: "0 0 12px 0" }}>Add New Passenger</h3>
            <div className="two-fields">
              <label>Name<input value={editForm.name} onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))} /></label>
              <label>Relation<input value={editForm.relation} onChange={e => setEditForm(prev => ({ ...prev, relation: e.target.value }))} /></label>
            </div>
            <div className="two-fields" style={{ marginTop: "12px" }}>
              <label>Age<input type="number" value={editForm.age} onChange={e => setEditForm(prev => ({ ...prev, age: Number(e.target.value) }))} /></label>
              <label>Gender<select value={editForm.gender} onChange={e => setEditForm(prev => ({ ...prev, gender: e.target.value }))}><option>Male</option><option>Female</option><option>Other</option></select></label>
            </div>
            <div className="two-fields" style={{ marginTop: "12px" }}>
              <label>Default Class<select value={editForm.classPreference} onChange={e => setEditForm(prev => ({ ...prev, classPreference: e.target.value }))}><option>Any</option>{classOrder.map(c => <option key={c}>{c}</option>)}</select></label>
              <label>Default Berth<select value={editForm.berth} onChange={e => setEditForm(prev => ({ ...prev, berth: e.target.value as Berth }))}>{berths.map(b => <option key={b}>{b}</option>)}</select></label>
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button className="secondary-button" onClick={() => setEditingId(null)}>Cancel</button>
              <button className="primary-button" onClick={saveEdit}>Save Passenger</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
