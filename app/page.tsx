"use client";

import { useEffect, useMemo, useState } from "react";
import { demoTrains, fallbackJourneys, savedPassengers, stationClusters } from "../lib/data";
import { Berth, Passenger, Priority, Train } from "../lib/types";
import { rankTrains, tradeoffs } from "../lib/recommendation";

const priorities:[Priority,string,string][] = [
 ["balanced","Balanced","A sensible compromise across availability, time, fare and comfort."],
 ["availability","Best chance","Prefer stronger current availability signals."],
 ["fare","Lower fare","Keep the group total lower where practical."],
 ["arrival","Earlier arrival","Reach Delhi earlier, while respecting constraints."],
 ["comfort","Comfort","Give more weight to class and onboard comfort."],
];
const classOrder=["1A","2A","3A","3E","CC","EC","SL","2S"];
const quotas=["General","Tatkal","Ladies","Senior Citizen"];
const berths:Berth[]=["Any","Lower","Middle","Upper","Side Lower","Side Upper"];

function isoDate(offset:number){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+offset);return d.toISOString().slice(0,10);}
function prettyDate(v:string){const d=new Date(`${v}T12:00:00`);return new Intl.DateTimeFormat("en-IN",{weekday:"short",day:"2-digit",month:"short"}).format(d);}
function minutes(t:string){const [h,m]=t.split(":").map(Number);return h*60+m;}
function normalize(raw:any,index:number):Train{
 const nestedTrain=raw.train||{}; const nestedFrom=raw.from||{}; const nestedTo=raw.to||{};
 const avClasses=(raw.availableClasses||raw.classes||raw.classCodes||[]).map((x:any)=>typeof x==="string"?x:x.code).filter(Boolean);
 const from=raw.fromStation||raw.sourceStation||nestedFrom.name||"Jaipur Junction"; const fromCode=raw.fromStationCode||raw.source||nestedFrom.code||"JP";
 const to=raw.toStation||raw.destinationStation||nestedTo.name||"Delhi"; const toCode=raw.toStationCode||raw.destination||nestedTo.code||"NDLS";
 const departure=raw.departureTime||raw.departure||nestedFrom.departure||"—"; const arrival=raw.arrivalTime||raw.arrival||nestedTo.arrival||"—";
 const durationMinutes=typeof raw.duration==="number"?raw.duration:(typeof raw.durationMinutes==="number"?raw.durationMinutes:null);
 const duration=typeof raw.duration==="string"?raw.duration:durationMinutes!=null?`${Math.floor(durationMinutes/60)}h ${durationMinutes%60}m`:"—";
 const number=raw.trainNumber||raw.number||nestedTrain.number||index; const name=raw.trainName||raw.name||nestedTrain.name||"Unnamed service";
 const liveInfo=raw.live||{};
 return {id:`live-${number}`,number:String(number),name,from,fromCode,to,toCode,departure,arrival,duration,runsOn:raw.runsOn||raw.runDays||nestedTrain.runDays||[],classes:avClasses,classAvailability:avClasses.map((code:string)=>({code,status:"Refresh live",source:"live"})),fare:Number(raw.fare||raw.minFare||0),availability:liveInfo.delayMinutes!=null?(liveInfo.delayMinutes===0?"On time":`${liveInfo.delayMinutes} min delay`):"Refresh live",availabilityType:"unknown",amenities:raw.amenities||["Reserved seating"],trainType:raw.trainType||raw.type||nestedTrain.type||"Rail service",scheduleSource:"Live railway data service",liveSource:"live",lastUpdated:raw.lastUpdatedAt||undefined};
}

export default function Home(){
 const [tab,setTab]=useState<"plan"|"trips"|"people"|"status">("plan");
 const [bookingStep,setBookingStep]=useState<"journey"|"trains"|"passengers"|"review">("journey");
 const [date,setDate]=useState(isoDate(1));
 const [from,setFrom]=useState("JP"); const [to,setTo]=useState("ALL_DELHI"); const [quota,setQuota]=useState("Tatkal");
 const [priority,setPriority]=useState<Priority>("balanced"); const [stationMode,setStationMode]=useState("recommended");
 const [trains,setTrains]=useState<Train[]>(demoTrains); const [dataState,setDataState]=useState<"loading"|"live"|"fallback"|"error">("loading"); const [dataMessage,setDataMessage]=useState("Checking railway data…");
 const [selected,setSelected]=useState<Train|null>(null); const [selectedClass,setSelectedClass]=useState("3A");
 const [live,setLive]=useState<Record<string,string>>({}); const [liveBusy,setLiveBusy]=useState<Record<string,boolean>>({}); const [liveUpdated,setLiveUpdated]=useState<Record<string,string>>({});
 const [compare,setCompare]=useState<string[]>([]); const [showCompare,setShowCompare]=useState(false); const [showPlanner,setShowPlanner]=useState(false); const [showStationGuide,setShowStationGuide]=useState(false); const [showTradeoffs,setShowTradeoffs]=useState(false);
 const [bookingMode,setBookingMode]=useState<"solo"|"group">("group");
 const [passengers,setPassengers]=useState<Passenger[]>(savedPassengers.slice(0,3)); const [rules,setRules]=useState({together:true,senior:true,child:true,coach:true,minFare:false,early:false});
 const [legs,setLegs]=useState([{id:"leg-1",label:"Leg 1",direction:"outbound",date:isoDate(1),classCode:"3A",berth:"Any" as Berth}]);
 const [legPrefs,setLegPrefs]=useState<Record<string,Record<string,{classCode:string;berth:Berth}>>>({"leg-1":Object.fromEntries(savedPassengers.slice(0,3).map(p=>[p.id,{classCode:p.classPreference||"Any",berth:p.berth}]))});
 const [meal,setMeal]=useState(false); const [alert,setAlert]=useState(true); const [toast,setToast]=useState(""); const [showData,setShowData]=useState(false);
 const dates=useMemo(()=>Array.from({length:14},(_,i)=>isoDate(i)),[]);

 const selectedDelhi=useMemo(()=>stationClusters.delhi.find(s=>s.code===to)||stationClusters.delhi[0],[to]);
 const filtered=useMemo(()=>{let r=[...trains]; if(to!=="ALL_DELHI")r=r.filter(t=>t.toCode===to); if(stationMode==="ndls")r=r.filter(t=>t.toCode==="NDLS"); return rankTrains(r,priority,passengers,rules.together);},[trains,to,stationMode,priority,passengers,rules.together]);
 const recommended=filtered[0]||null;
 const groupFare=useMemo(()=>{if(!selected)return 0; const base=selected.fare||0; return Math.max(base,0)*passengers.length+(meal?120*passengers.length:0);},[selected,passengers.length,meal]);
 const senior=passengers.some(p=>p.age>=60); const child=passengers.some(p=>p.age<12);
 const groupInsight=senior&&rules.senior?"Senior passenger detected — lower-berth preference is being protected.":child&&rules.child?"Child passenger detected — Dash will keep the child paired with an accompanying adult.":rules.together?"Group cohesion is on — Dash prefers one practical train for everyone.":"Dash will optimise using the constraints you selected.";

 const notify=(s:string)=>{setToast(s);window.setTimeout(()=>setToast(""),2500)};
 const search=async()=>{
  setDataState("loading");setDataMessage("Checking railway data…");
  try{
   const destinations=to==="ALL_DELHI"?stationClusters.delhi.map(x=>x.code):[to];
   const responses=await Promise.allSettled(destinations.map(code=>fetch(`/api/search?from=${from}&to=${code}&date=${date}`).then(async r=>{if(!r.ok)throw new Error("data service");return r.json();})));
   const liveResponses=responses.filter((x): x is PromiseFulfilledResult<any>=>x.status==="fulfilled");
   const rows=liveResponses.flatMap(x=>x.value?.data||[]).map(normalize);
   if(!rows.length)throw new Error("No services returned");
   setTrains(rows);setDataState(liveResponses.length===destinations.length?"live":"fallback");setDataMessage(liveResponses.length===destinations.length?"Live timetable feed connected for this date.":"Live timetable is partially available; only returned stations are shown.");
  }catch{setTrains(demoTrains);setDataState("fallback");setDataMessage("Live feed unavailable right now — showing clearly labelled demo timetable data.");}
 };
 useEffect(()=>{search();},[date,from,to]); // eslint-disable-line react-hooks/exhaustive-deps

 const refreshAvailability=async(train:Train,cls:string)=>{
  const key=`${train.id}:${cls}`;
  setLiveBusy(x=>({...x,[key]:true}));
  try{
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),6500);
   try{
    const r=await fetch(`/api/availability?train=${train.number}&from=${train.fromCode}&to=${train.toCode}&date=${date}&class=${cls}&quota=${quota==='Tatkal'?"TQ":"GN"}`,{cache:"no-store",signal:controller.signal});
    const d=await r.json();
    if(!r.ok)throw new Error(d?.error||"Availability service unavailable");
    const value=d?.status||d?.data?.status||d?.data?.availability||d?.data?.available||d?.data?.avlDayList?.find((x:any)=>x.availablityDate===date||x.availabilityDate===date)?.availablityStatus||"Live response received";
    setLive(x=>({...x,[key]:String(value)}));
    setLiveUpdated(x=>({...x,[key]:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}));
   }finally{clearTimeout(timer);}
  }catch{
   setLive(x=>({...x,[key]:"Unavailable"}));
   notify(`Live ${cls} availability is temporarily unavailable for ${train.number}. No number was invented.`);
  }finally{setLiveBusy(x=>({...x,[key]:false}));}
 };
 const refreshTop=async()=>{
  const targets=filtered.slice(0,6).filter(t=>t.classes.length);
  if(!targets.length)return;
  await Promise.all(targets.map(t=>refreshAvailability(t,t.classes[0])));
 };
 const stationRecommendation=useMemo(()=>{
  const counts=filtered.reduce<Record<string,number>>((a,t)=>{a[t.toCode]=(a[t.toCode]||0)+1;return a},{}); const best=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0]||"NDLS";
  return stationClusters.delhi.find(s=>s.code===best)||stationClusters.delhi[0];
 },[filtered]);
 const compareTrains=trains.filter(t=>compare.includes(t.id));

 const toggleCompare=(id:string)=>setCompare(v=>v.includes(id)?v.filter(x=>x!==id):v.length<3?[...v,id]:v);
 const setBookingModeSafe=(mode:"solo"|"group")=>{setBookingMode(mode);if(mode==="solo")setPassengers(v=>v.slice(0,1));};
 const addPassenger=()=>{if(bookingMode==="solo"){setBookingModeSafe("group");}const next=savedPassengers.find(p=>!passengers.some(x=>x.id===p.id));if(next)setPassengers(v=>[...v,next]);else notify("All saved prototype passenger profiles are already in this group.");};
 const updatePassenger=(id:string,key:keyof Passenger,value:string|number)=>setPassengers(v=>v.map(p=>p.id===id?{...p,[key]:value}:p));
 const addLeg=()=>setLegs(v=>{const id=`leg-${v.length+1}`;setLegPrefs(p=>({...p,[id]:Object.fromEntries(passengers.map(x=>[x.id,{classCode:x.classPreference||"Any",berth:x.berth}]))}));return [...v,{id,label:`Leg ${v.length+1}`,direction:"return",date:isoDate(2),classCode:"CC",berth:"Any" as Berth}];});
 const updateLegPref=(legId:string,passengerId:string,key:"classCode"|"berth",value:string)=>setLegPrefs(v=>({...v,[legId]:{...(v[legId]||{}),[passengerId]:{...(v[legId]?.[passengerId]||{classCode:"Any",berth:"Any"}),[key]:value}}}));

 return <main className="app-shell">
  <header className="topbar">
   <button className="brand" onClick={()=>{setTab("plan");setBookingStep("journey")}} aria-label="Dash home">
     <img src="/icon.png" alt="" className="brand-icon" width="24" height="24" />
     <span>Dash</span>
   </button>

   <nav className="main-nav" aria-label="Primary">
    <button className={tab==="plan"?"nav-active":""} onClick={()=>{setTab("plan");setBookingStep("journey")}}>Book ticket</button>
    <button className={tab==="trips"?"nav-active":""} onClick={()=>setTab("trips")}>My trips</button>
    <button className={tab==="people"?"nav-active":""} onClick={()=>setTab("people")}>Passengers</button>
    <button className={tab==="status"?"nav-active":""} onClick={()=>setTab("status")}>Live status</button>
   </nav>
   <div className="topbar-right"><span className={dataState==="live"?"live-pill":"prototype-pill"}>{dataState==="live"?"● Live rail data":"Rail data adapter"}</span></div>
  </header>

  <div className="content-wrap">
   {tab==="plan"&&<>
    <section className="booking-header">
     <div>
      <p className="eyebrow">DASH · SMART RAIL JOURNEY PLANNER</p>
      <h1>Book the journey, not just the train.</h1>
      <p className="hero-copy">A focused booking flow for groups: choose the journey, compare trains, set passenger preferences, then review before the simulated payment handoff.</p>
     </div>
    </section>

    <nav className="booking-steps" aria-label="Booking progress">
     {([['journey','1','Journey'],['trains','2','Select train'],['passengers','3','Passengers'],['review','4','Review & pay']] as const).map(([key,n,label])=><button key={key} className={bookingStep===key?"booking-step active":"booking-step"} onClick={()=>setBookingStep(key)}><span>{n}</span><b>{label}</b></button>)}
    </nav>

    <section className="booking-party-bar" aria-label="Passengers for this booking">
     <div className="party-main">
      <div className="party-icon">{passengers.length}</div>
      <div>
       <span className="eyebrow">BOOKING FOR</span>
       <strong>{passengers.length === 1 ? "1 passenger · Solo booking" : `${passengers.length} passengers · Group booking`}</strong>
       <div className="party-chips">{passengers.map((p,index)=><span className="party-chip" key={p.id}><i>{index+1}</i>Passenger {index+1}</span>)}</div>
      </div>
     </div>
     <div className="party-actions">
      <div className="party-mode">
       <button className={bookingMode==="solo"?"active":""} onClick={()=>setBookingModeSafe("solo")}>Solo</button>
       <button className={bookingMode==="group"?"active":""} onClick={()=>setBookingModeSafe("group")}>Group</button>
      </div>
      <button className="secondary-button" onClick={()=>setBookingStep("passengers")}>Manage passengers →</button>
     </div>
    </section>

    {bookingStep==="journey"&&<section className="panel booking-panel">
     <div className="panel-heading"><div><p className="eyebrow">STEP 1 · JOURNEY</p><h2>Where and when are you travelling?</h2><p className="muted">Choose from the available dates instead of typing one manually.</p></div><span className="step-state">1 of 4</span></div>
     <div className="traveller-context"><div><span className="eyebrow">BOOKING FOR</span><strong>{passengers.length===1?"Solo passenger":`${passengers.length} passengers · Group booking`}</strong><p>{passengers.length===1?"Passenger details and berth preferences can be reviewed before payment.":"Passenger details, group constraints and individual berth preferences will be carried through the booking."}</p></div><button className="secondary-button" onClick={()=>setBookingStep("passengers")}>Manage passengers →</button></div>
     <div className="journey-grid"><label>From<select value={from} onChange={e=>setFrom(e.target.value)}><option value="JP">Jaipur Junction · JP</option></select></label><div className="swap-button" aria-hidden>→</div><label>To<select value={to} onChange={e=>setTo(e.target.value)}><option value="ALL_DELHI">Delhi · all stations</option>{stationClusters.delhi.map(s=><option value={s.code} key={s.code}>{s.name} · {s.code}</option>)}</select></label><label>Quota<select value={quota} onChange={e=>setQuota(e.target.value)}>{quotas.map(q=><option key={q}>{q}</option>)}</select></label></div>
     <div className="date-strip"><div className="date-title"><span className="eyebrow">JOURNEY DATE</span><select aria-label="Journey date" value={date} onChange={e=>setDate(e.target.value)}>{dates.map(d=><option value={d} key={d}>{prettyDate(d)}</option>)}</select></div>{dates.map(d=><button key={d} className={date===d?"date-chip active":"date-chip"} onClick={()=>setDate(d)}><b>{new Date(`${d}T12:00:00`).getDate()}</b><span>{new Intl.DateTimeFormat("en-IN",{weekday:"short"}).format(new Date(`${d}T12:00:00`))}</span></button>)}</div>
     <div className="station-intel"><div><span className="eyebrow">DELHI STATION INTELLIGENCE</span><h3>{to==="ALL_DELHI"?"Not sure which Delhi station? Dash will compare them.":`${selectedDelhi?.name} selected`}</h3><p>{to==="ALL_DELHI"?`Dash currently sees ${filtered.length} matching service(s) across the Delhi station cluster.`:`You have locked the destination to ${selectedDelhi?.code}.`}</p></div><button className="secondary-button" onClick={()=>setShowStationGuide(!showStationGuide)}>{showStationGuide?"Hide station guide":"Compare Delhi stations"}</button></div>
     {showStationGuide&&<div className="station-guide"><div className="station-guide-head"><div><span className="eyebrow">STATION DECISION</span><h3>Recommended for this journey</h3><p className="muted">The recommendation is based on the services returned for your selected date, not on a universal ranking of stations.</p></div><span className="match-badge">{stationRecommendation.code}</span></div><div className="station-options">{stationClusters.delhi.map(s=><button key={s.code} className={s.code===stationRecommendation.code?"station-option active":"station-option"} onClick={()=>setTo(s.code)}><strong>{s.code}</strong><span>{s.name}</span><small>{s.note}</small><em>{filtered.filter(t=>t.toCode===s.code).length} matching service(s)</em></button>)}</div></div>}
     <div className="data-banner"><span className={dataState==="live"?"data-dot live":"data-dot"}></span><div><strong>{dataState==="live"?"LIVE railway data connected":dataMessage}</strong><small>Class availability is checked only for the class you select — no page-wide loading.</small></div><button className="text-button" onClick={()=>setShowData(true)}>Data & trust</button></div>
     <div className="booking-footer"><span className="muted">{from==="JP"?"Jaipur Junction":"Selected origin"} → {to==="ALL_DELHI"?"Delhi station cluster":selectedDelhi?.name} · {prettyDate(date)}</span><button className="primary-button" onClick={()=>setBookingStep("trains")}>Find trains →</button></div>
    </section>}

    {bookingStep==="trains"&&<section className="panel booking-panel">
     <div className="panel-heading"><div><p className="eyebrow">STEP 2 · SELECT TRAIN</p><h2>{filtered.length} train option{filtered.length===1?"":"s"} for {prettyDate(date)}</h2><p className="muted">Choose a train for the travellers below. Their preferences stay attached to this booking.</p></div><div className="heading-actions"><select aria-label="Smart Match priority" value={priority} onChange={e=>setPriority(e.target.value as Priority)}>{priorities.map(p=><option value={p[0]} key={p[0]}>{p[1]}</option>)}</select></div></div>
     <div className="selection-party"><div><span className="eyebrow">PASSENGERS FOR THIS TICKET</span><strong>{passengers.length===1?"1 passenger · Solo":`${passengers.length} passengers · Group`}</strong><span>{passengers.map((_,index)=>`Passenger ${index+1}`).join(" · ")} · preferences applied after train selection</span></div><button className="text-button" onClick={()=>setBookingStep("passengers")}>Edit passengers →</button></div>
     <div className="selection-toolbar"><div><strong>Smart Match: {priorities.find(p=>p[0]===priority)?.[1]}</strong><span>{priorities.find(p=>p[0]===priority)?.[2]}</span></div><button className="secondary-button" onClick={refreshTop}>↻ Refresh live availability</button><button className="text-button" onClick={()=>setShowTradeoffs(!showTradeoffs)}>{showTradeoffs?"Hide":"Show"} recommendation logic</button></div>
     {showTradeoffs&&<div className="logic-card"><div><b>No perfect train. Just a better fit.</b><p>Dash makes the trade-off visible: a cheaper train may arrive later, while a faster train may cost more or use a different Delhi station.</p></div><div className="logic-tags"><span>Availability</span><span>Fare</span><span>Arrival</span><span>Comfort</span><span>Group constraints</span></div></div>}
     <div className="train-list">{filtered.map(train=>{const cls=train.classes[0]||"";const av=cls?live[`${train.id}:${cls}`]||train.availability:train.availability;const isRec=train.id===recommended?.id;return <article className={isRec?"train-card recommended":"train-card"} key={train.id}><div className="train-main"><div className="train-heading"><div><span className="train-number">{train.number} · {train.trainType||"Express"}</span><h3>{train.name}</h3></div>{isRec&&<span className="match-badge">Best fit</span>}</div><div className="train-times"><div><strong>{train.departure}</strong><span>JP · Jaipur</span></div><div className="route-line"><i></i><span>{train.duration}</span><i></i></div><div><strong>{train.arrival}</strong><span>{train.toCode}</span></div><div className="duration-block"><b>₹{train.fare||"—"}</b><span>per passenger · from</span></div></div><div className="class-row">{train.classes.length?train.classes.map(c=>{const key=`${train.id}:${c}`;const busy=!!liveBusy[key];const value=live[key];return <button key={c} className={selectedClass===c&&selected?.id===train.id?"class-pill active":"class-pill"} onClick={()=>{setSelected(train);setSelectedClass(c);refreshAvailability(train,c)}}><span>{c}<em className="live-mini">LIVE</em></span><small>{busy?"Checking…":value||"Check availability"}</small></button>}):<span className="class-missing">Class availability not returned by the data provider.</span>}</div><div className="train-meta"><span className={live[`${train.id}:${cls}`]&&live[`${train.id}:${cls}`]!=="Unavailable"?"availability live-availability":"availability unknown"}>{live[`${train.id}:${cls}`]||"Live availability · select class"}</span><span>{train.to}</span><span>{train.runsOn.length?`Runs ${train.runsOn.slice(0,3).join(" · ")}${train.runsOn.length>3?" · …":""}`:"Runs on date if returned"}</span></div>{isRec&&<div className="recommendation-reason"><b>Why Dash prefers this</b><span>{train.availabilityType==="available"?"Strong availability signal. ":"Availability is not yet confirmed. "}{train.fare?`Fare starts at ₹${train.fare}. `:"Fare not returned. "}{train.toCode!=="NDLS"?`Trade-off: arrives at ${train.toCode}.`:"Direct New Delhi arrival."}</span></div>}</div><div className="train-actions"><label className="compare-check"><input type="checkbox" checked={compare.includes(train.id)} onChange={()=>toggleCompare(train.id)}/> Compare</label><button className="secondary-button" onClick={()=>{setSelected(train);setSelectedClass(train.classes[0]||"");setShowTradeoffs(true)}}>Why this train?</button><button className="primary-button" onClick={()=>{setSelected(train);setSelectedClass(train.classes[0]||"");setBookingStep("passengers")}}>Select train →</button></div></article>})}</div>
     {compare.length>0&&<div className="compare-bar"><div><strong>{compare.length}/3 selected</strong><span>Compare the same variables side by side.</span></div><button className="secondary-button" onClick={()=>setCompare([])}>Clear</button><button className="primary-button" onClick={()=>setShowCompare(true)} disabled={compare.length<2}>Compare →</button></div>}
     <div className="recovery-strip"><div><span className="eyebrow">RECOVERY READY</span><strong>If your first choice disappears, Dash keeps alternatives visible.</strong><p>Fallback examples remain available without pretending they are currently bookable.</p></div>{fallbackJourneys.map(j=><button className="recovery-option" key={j.number} onClick={()=>notify(`${j.number} kept as a fallback option.`)}><b>{j.number}</b><span>{j.departure} → {j.arrival}</span><small>{j.toCode}</small></button>)}</div>
     <div className="booking-footer"><button className="secondary-button" onClick={()=>setBookingStep("journey")}>← Change journey</button><span className="muted">{selected?`Selected: ${selected.number} · ${selected.name}`:"Choose a train to continue"}</span><button className="primary-button" disabled={!selected} onClick={()=>setBookingStep("passengers")}>Continue to passengers →</button></div>
    </section>}

    {bookingStep==="passengers"&&<section className="panel booking-panel">
     <div className="panel-heading"><div><p className="eyebrow">STEP 3 · PASSENGERS</p><h2>Who is travelling?</h2><p className="muted">Passenger details come first. Then set class and berth preferences for each traveller and each journey leg.</p></div><span className="step-state">{passengers.length} passenger{passengers.length===1?"":"s"} · {bookingMode==="solo"?"Solo":"Group"}</span></div>
     <div className="selected-ticket"><div><span className="eyebrow">SELECTED TRAIN</span><h3>{selected?.number||"No train selected"} · {selected?.name||"Choose a train first"}</h3><p>{selected?`${selected.departure} → ${selected.arrival} · ${selected.toCode} · ${prettyDate(date)}`:"Return to Select train to choose a service."}</p></div><button className="secondary-button" onClick={()=>setBookingStep("trains")}>Change train</button></div>
     {bookingMode==="group"&&<div className="planner-section"><div className="section-title"><div><h3>Group requirements</h3><p>Dash keeps these visible instead of silently applying them.</p></div></div><div className="rule-grid">{[["together","Keep everyone together"],["senior","Prefer lower berth for senior"],["child","Keep child with adult"],["coach","Avoid splitting across coaches"],["minFare","Minimize fare"],["early","Prioritize arrival time"]].map(([k,label])=><label className={rules[k as keyof typeof rules]?"rule active":"rule"} key={k}><input type="checkbox" checked={rules[k as keyof typeof rules]} onChange={e=>setRules(r=>({...r,[k]:e.target.checked}))}/><span><b>{label}</b><small>{k==="together"?"One practical train for the group.":k==="senior"?"Protect lower-berth preference where possible.":k==="child"?"Keep a child paired with an adult.":k==="coach"?"Prefer fewer coach splits.":k==="minFare"?"Lower total cost gets more weight.":"Earlier arrival gets more weight."}</small></span></label>)}</div><div className="constraint-alert"><span>✦</span><div><strong>Dash detected a group constraint</strong><p>{groupInsight}</p></div></div></div>}
     {bookingMode==="solo"&&<div className="solo-preference-banner"><div><span className="eyebrow">SOLO BOOKING</span><strong>One passenger, one preference set.</strong><p>Set the traveller's class and berth below. These preferences will carry into the review.</p></div><span className="solo-check">✓ Ready to configure</span></div>}
     <div className="planner-section"><div className="section-title"><div><h3>Passenger details</h3><p>Enter the traveller information used for this booking. Class and berth are set here too.</p></div><button className="secondary-button" onClick={addPassenger}>+ Add passenger</button></div><div className="passenger-preference-list">{passengers.map((p,index)=><div className="passenger-preference" key={p.id}><div className="passenger-number">{index+1}</div><div className="person"><span className="avatar">{p.name.split(" ").map(x=>x[0]).join("")}</span><div><strong>Passenger {index+1}</strong><small>{p.relation||"Traveller"} · {p.idVerified?"ID verified":"Review ID"}</small></div></div><label>Full name<input value={p.name} onChange={e=>updatePassenger(p.id,"name",e.target.value)} placeholder="Passenger name"/></label><label>Age<input type="number" min="1" max="120" value={p.age} onChange={e=>updatePassenger(p.id,"age",Number(e.target.value)||0)}/></label><label>Gender<select value={p.gender} onChange={e=>updatePassenger(p.id,"gender",e.target.value)}><option>Male</option><option>Female</option><option>Other</option></select></label><label>Class preference<select value={p.classPreference||"Any"} onChange={e=>updatePassenger(p.id,"classPreference",e.target.value)}><option>Any</option>{classOrder.map(c=><option key={c}>{c}</option>)}</select></label><label>Berth preference<select value={p.berth} onChange={e=>updatePassenger(p.id,"berth",e.target.value as Berth)}>{berths.map(b=><option key={b}>{b}</option>)}</select></label><div className="passenger-flags">{p.age>=60&&<span>Senior · lower berth priority</span>}{p.age<12&&<span>Child · keep with adult</span>}{p.age>=12&&p.age<60&&<span>Standard passenger</span>}</div></div>)}</div></div>
     {bookingMode==="group"&&<div className="group-logic-banner"><div><span className="eyebrow">SMART GROUP RULES</span><strong>{groupInsight}</strong><p>These rules influence train ranking and your passenger-specific preferences. A berth preference is a request, not a guarantee.</p></div><div className="group-rule-chips"><span>✓ Keep together</span>{senior&&<span>✓ Senior lower berth</span>}{child&&<span>✓ Child with adult</span>}<span>✓ Avoid coach split</span></div></div>}
     <div className="planner-section"><div className="section-title"><div><h3>Journey legs</h3><p>Useful for connecting or return journeys where class/berth can change.</p></div><button className="secondary-button" onClick={addLeg}>+ Add another leg</button></div><div className="leg-list">{legs.map((leg,i)=><div className="leg-card" key={leg.id}><div className="leg-number">{i+1}</div><div><strong>{i===0?"Jaipur → Delhi":"Return / connecting leg"}</strong><small>{prettyDate(leg.date)} · {selected?.number||"Train not selected"}</small></div><label>Default class<select value={leg.classCode} onChange={e=>setLegs(v=>v.map(x=>x.id===leg.id?{...x,classCode:e.target.value}:x))}>{classOrder.map(c=><option key={c}>{c}</option>)}</select></label><label>Default berth<select value={leg.berth} onChange={e=>setLegs(v=>v.map(x=>x.id===leg.id?{...x,berth:e.target.value as Berth}:x))}>{berths.map(b=><option key={b}>{b}</option>)}</select></label><div className="leg-passenger-overrides"><div><b>Passenger preferences for this leg</b><span>Overrides affect this leg only.</span></div>{passengers.map(p=>{const pref=legPrefs[leg.id]?.[p.id]||{classCode:p.classPreference||"Any",berth:p.berth};return <div className="leg-passenger-row" key={p.id}><strong>Passenger {passengers.findIndex(x=>x.id===p.id)+1}</strong><select aria-label={`Passenger ${passengers.findIndex(x=>x.id===p.id)+1} class for leg ${i+1}`} value={pref.classCode} onChange={e=>updateLegPref(leg.id,p.id,"classCode",e.target.value)}><option>Any</option>{classOrder.map(c=><option key={c}>{c}</option>)}</select><select aria-label={`Passenger ${passengers.findIndex(x=>x.id===p.id)+1} berth for leg ${i+1}`} value={pref.berth} onChange={e=>updateLegPref(leg.id,p.id,"berth",e.target.value)}>{berths.map(b=><option key={b}>{b}</option>)}</select></div>})}</div></div>)}</div></div>
     <div className="booking-footer"><button className="secondary-button" onClick={()=>setBookingStep("trains")}>← Change train</button><span className="muted">{passengers.length} passenger{passengers.length===1?"":"s"} · preferences saved locally in this prototype</span><button className="primary-button" disabled={!selected} onClick={()=>setBookingStep("review")}>Review booking →</button></div>
    </section>}

    {bookingStep==="review"&&<section className="panel booking-panel">
     <div className="panel-heading"><div><p className="eyebrow">STEP 4 · REVIEW & PAYMENT</p><h2>Review your journey before payment.</h2><p className="muted">Everything important is visible here before the final handoff.</p></div><span className="step-state">Final review</span></div>
     <div className="review-ticket"><div className="review-route"><div><span>FROM</span><strong>JP</strong><small>Jaipur Junction</small></div><div className="review-arrow">→</div><div><span>TO</span><strong>{selected?.toCode||"DEL"}</strong><small>{selected?.to||"Delhi"}</small></div></div><div className="review-train"><div><span className="eyebrow">TRAIN</span><h3>{selected?.number||"—"} · {selected?.name||"No train selected"}</h3><p>{selected?`${selected.departure} → ${selected.arrival} · ${selected.duration}`:"Choose a train before reviewing."}</p></div><span className="match-badge">{selectedClass||"Class pending"}</span></div><div className="review-meta"><div><span>Date</span><b>{prettyDate(date)}</b></div><div><span>Quota</span><b>{quota}</b></div><div><span>Passengers</span><b>{passengers.length}</b></div><div><span>Estimated total</span><b>₹{groupFare.toLocaleString("en-IN")}</b></div></div></div>
     <div className="review-grid"><div className="review-card"><span className="eyebrow">PASSENGER DETAILS</span>{passengers.map(p=><div className="review-row" key={p.id}><strong>{p.name}<small>{p.age} · {p.gender}</small></strong><span>{p.classPreference||"Any"} · {p.berth}</span></div>)}</div><div className="review-card"><span className="eyebrow">GROUP RULES</span>{Object.entries(rules).filter(([,v])=>v).map(([k])=><div className="review-row" key={k}><strong>{k==="together"?"Keep together":k==="senior"?"Senior lower berth":k==="child"?"Child with adult":k==="coach"?"Avoid coach split":k==="minFare"?"Minimize fare":"Prioritize arrival"}</strong><span>On</span></div>)}<div className="review-row"><strong>Journey change alert</strong><span>{alert?"On":"Off"}</span></div></div></div>
     <div className="recovery-strip"><div><span className="eyebrow">BACKUP OPTIONS</span><strong>No single train is treated as the only answer.</strong><p>If the chosen service becomes unavailable, these alternatives can be reconsidered.</p></div>{fallbackJourneys.map(j=><button className="recovery-option" key={j.number} onClick={()=>notify(`${j.number} is available as a fallback planning option.`)}><b>{j.number}</b><span>{j.departure} → {j.arrival}</span><small>{j.toCode}</small></button>)}</div>
     <div className="payment-note"><strong>Secure payment handoff — simulation</strong><p>Dash stops before a real railway transaction. This button demonstrates the intended handoff; it does not create or charge a real ticket.</p></div>
     <div className="booking-footer"><button className="secondary-button" onClick={()=>setBookingStep("passengers")}>← Edit passengers</button><span className="muted">Estimated total only · final railway fare is provider-dependent</span><button className="primary-button" disabled={!selected} onClick={()=>notify("Demo payment handoff complete — no real ticket or payment was created.")}>Proceed to secure payment →</button></div>
    </section>}
   </>}

   {tab==="trips"&&<section className="panel standalone-page"><div className="panel-heading"><div><p className="eyebrow">MY TRIPS</p><h1>Every journey stays recoverable.</h1><p className="muted">Saved plans preserve your group and preferences; they do not silently book anything.</p></div><button className="primary-button" onClick={()=>{setTab("plan");setBookingStep("journey")}}>New journey</button></div><div className="trip-list"><article className="trip-card"><div className="trip-date"><strong>07</strong><span>OCT</span></div><div><h3>Jaipur → Delhi</h3><p>{passengers.length} passengers · {quota} · {rules.together?"keep together":"flexible"}</p></div><span className="trip-status">Planning saved</span><button className="text-button" onClick={()=>{setTab("plan");setBookingStep("review")}}>Continue</button></article></div></section>}

   {tab==="people"&&<section className="panel standalone-page"><div className="panel-heading"><div><p className="eyebrow">PASSENGER PROFILES</p><h1>Preferences belong to the passenger.</h1><p className="muted">Defaults live here; journey-specific edits happen in Step 3 of booking.</p></div><button className="primary-button" onClick={()=>{setTab("plan");setBookingStep("passengers")}}>Plan with group</button></div><div className="profile-grid">{savedPassengers.map(p=><article className="profile-card" key={p.id}><div className="profile-top"><span className="avatar large">{p.name.split(" ").map(x=>x[0]).join("")}</span><span className="verified">✓ {p.idVerified?"Verified":"Review"}</span></div><h3>{p.name}</h3><p>{p.age} years · {p.relation}</p><div className="profile-meta"><span>Default berth</span><select aria-label={`${p.name} berth preference`} value={p.berth} onChange={e=>updatePassenger(p.id,"berth",e.target.value as Berth)}>{berths.map(b=><option key={b}>{b}</option>)}</select></div><div className="profile-meta"><span>Preferred class</span><select aria-label={`${p.name} class preference`} value={p.classPreference||"Any"} onChange={e=>updatePassenger(p.id,"classPreference",e.target.value)}><option>Any</option>{classOrder.map(c=><option key={c}>{c}</option>)}</select></div><button className="secondary-button" onClick={()=>{if(!passengers.some(x=>x.id===p.id))setPassengers(v=>[...v,p]);setTab("plan");setBookingStep("passengers")}}>Add to journey</button></article>)}</div></section>}

   {tab==="status"&&<LiveStatusPanel notify={notify} />}
  </div>

  {showCompare&&<div className="modal-backdrop" onClick={()=>setShowCompare(false)}><section className="compare-modal" onClick={e=>e.stopPropagation()}><div className="modal-top"><div><p className="eyebrow">TRADE-OFF VIEW</p><h2>No perfect train. Just a better fit.</h2><p className="muted">Dash keeps the pros and cons visible so the user can choose.</p></div><button className="icon-button" onClick={()=>setShowCompare(false)}>×</button></div><div className="compare-grid">{compareTrains.map(t=>{const tr=tradeoffs(t,compareTrains.filter(x=>x.id!==t.id));return <article className="compare-card" key={t.id}><span className="match-badge">{t.number}</span><h3>{t.name}</h3><strong>{t.departure} → {t.arrival}</strong><span>{t.toCode} · {t.duration}</span><span>₹{t.fare||"—"}</span><div className="pros"><b>Pros</b>{(tr.gains.length?tr.gains:["Direct service","Class options shown"]).map(x=><span key={x}>✓ {x}</span>)}</div><div className="cons"><b>Trade-offs</b>{(tr.sacrifices.length?tr.sacrifices:["Live availability needs refresh"]).map(x=><span key={x}>↳ {x}</span>)}</div><button className="primary-button" onClick={()=>{setSelected(t);setSelectedClass(t.classes[0]||"");setShowCompare(false);setBookingStep("passengers")}}>Select train</button></article>})}</div></section></div>}

  {showData&&<div className="modal-backdrop" onClick={()=>setShowData(false)}><section className="detail-modal" onClick={e=>e.stopPropagation()}><div className="modal-top"><div><p className="eyebrow">DATA & TRUST</p><h2>Dash never hides the boundary.</h2></div><button className="icon-button" onClick={()=>setShowData(false)}>×</button></div><div className="trust-grid"><div><span className="trust-live"></span><h3>Live railway data</h3><p>Train search and class availability are fetched from external railway-data adapters when they respond. Live status uses the configured RailRadar adapter.</p></div><div><span className="trust-demo"></span><h3>Fallback demo data</h3><p>If an upstream service fails, Dash labels the fallback timetable instead of inventing live seat numbers.</p></div><div><span className="trust-user"></span><h3>User decision</h3><p>Recommendations are advisory. Dash never silently books, changes passengers or submits payment.</p></div></div><div className="payment-note"><strong>Payment handoff</strong><p>This prototype does not create a real railway booking. The final action is a simulated handoff to a secure booking/payment flow.</p></div></section></div>}
  {toast&&<div className="toast" role="status">{toast}</div>}
 </main>
}

function LiveStatusPanel({notify}:{notify:(s:string)=>void}){
 const [statusTrain,setStatusTrain]=useState("12957"); const [busy,setBusy]=useState(false); const [result,setResult]=useState<any>(null); const [error,setError]=useState("");
 const check=async()=>{if(!statusTrain.trim()){setError("Enter a 5-digit train number.");return;}setBusy(true);setError("");setResult(null);try{const r=await fetch(`/api/live?train=${encodeURIComponent(statusTrain.trim())}`);const d=await r.json();if(!r.ok)throw new Error(d?.error||"Live status unavailable");setResult(d?.data||d);notify(`Live running status received for ${statusTrain.trim()}.`);}catch(e){setError(e instanceof Error?e.message:"Live running status is unavailable right now.");}finally{setBusy(false)}};
 const data=result||{}; const train=data.train||{}; const location=data.currentLocation||{}; const next=data.nextHalt||{}; const delay=Number(data.delayMinutes||0); const updated=data.lastUpdatedAt?new Date(data.lastUpdatedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}):null;
 return <section className="panel standalone-page"><div className="panel-heading"><div><p className="eyebrow">LIVE RUNNING STATUS</p><h1>Where is my train?</h1><p className="muted">Live running data is checked directly through Dash's server-side RailRadar adapter. No API key is exposed to the browser.</p></div><span className="live-pill">● Live status</span></div><div className="status-search"><input inputMode="numeric" value={statusTrain} onChange={e=>setStatusTrain(e.target.value.replace(/\D/g,"").slice(0,5))} placeholder="Train number · e.g. 12957"/><button className="primary-button" onClick={check} disabled={busy}>{busy?"Checking live status…":"Check live status"}</button></div>{error&&<div className="status-error"><strong>Live status could not be loaded.</strong><span>{error}</span><small>Dash has not invented a location, delay or platform.</small></div>}{result&&<div className="live-status-result"><div className="status-summary"><div><span>TRAIN</span><strong>{data.trainNumber||train.number||statusTrain}</strong><small>{data.trainName||train.name||"Rail service"}</small></div><div><span>STATUS</span><strong className="status-live-value">{String(data.status||"Running").replace(/_/g," ")}</strong><small>{delay>0?`${delay} min delay`:delay<0?`${Math.abs(delay)} min early`:"On time signal"}</small></div><div><span>LAST UPDATED</span><strong>{updated||"Just now"}</strong><small>{data.isLive===false?"Provider response":"Live provider"}</small></div></div><div className="live-detail-grid"><div className="live-detail-card"><span className="eyebrow">CURRENT LOCATION</span><h3>{location.stationCode||"Location unavailable"}</h3><p>{location.stationName||location.status||"The provider did not return a station name."}</p><small>{location.speedKmh!=null?`${location.speedKmh} km/h`:"Speed not returned"}</small></div><div className="live-detail-card"><span className="eyebrow">NEXT HALT</span><h3>{next.stationName||"Not returned"}</h3><p>{next.stationCode||"—"}</p><small>{next.distance!=null?`${next.distance} km away`:"Distance not returned"}</small></div><div className="live-detail-card"><span className="eyebrow">PLATFORM</span><h3>{location.platform||data.platform||"Not returned"}</h3><p>{data.status?String(data.status).replace(/_/g," "):"Live status"}</p><small>Platform information can change.</small></div></div><div className="status-source">✓ Live provider response · checked just now · Dash displays returned data without inventing missing fields.</div></div>}{!result&&!error&&<div className="status-empty"><span>◎</span><div><strong>Enter a train number to check it live.</strong><p>For the presentation, use a currently running train. The result panel will show status, delay, current location, next halt and platform when the provider returns them.</p></div></div>}</section>
}
