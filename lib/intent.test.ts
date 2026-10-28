import {
  DEFAULT_HORIZON_DAYS,
  INSTANT_SUFFICIENT_FIELDS,
  describeIntent,
  mergeIntents,
  normalizeBookingIntent,
  parseBookingIntent,
  sanitizeLlmIntent,
  toVizIntent,
  understoodCount,
  type BookingIntent,
} from "./intent";

/** Thursday, 29 Oct 2026 — fixed so relative dates are deterministic. */
const TODAY = new Date(2026, 9, 29, 9, 58);

export function runTests(): boolean {
  let passed = 0;
  let failed = 0;
  const assert = (desc: string, cond: boolean, detail?: unknown) => {
    if (cond) passed++;
    else {
      failed++;
      console.error(`FAIL: ${desc}${detail !== undefined ? `  → ${JSON.stringify(detail)}` : ""}`);
    }
  };
  const parse = (t: string) => parseBookingIntent(t, { today: TODAY });
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

  // ── The exact prompt from the product brief ──────────────────────────────
  const brief = parse(
    "Hey, I wanna book a ticket from JP to Delhi, I prefer only 2A and 3A. It should be on 31st Oct, from 10 am to 10 pm time"
  );
  assert("brief: destination = all Delhi stations", brief.to === "ALL_DELHI", brief);
  assert("brief: date = 2026-10-31", brief.date === "2026-10-31", brief);
  assert("brief: classes = 2A, 3A", same(brief.classes, ["2A", "3A"]), brief.classes);
  assert("brief: departs 10:00–22:00", brief.departureAfter === "10:00" && brief.departureBefore === "22:00", brief);
  assert("brief: no warnings", brief.warnings.length === 0, brief.warnings);
  assert("brief: no invented quota / fare / priority", !brief.quota && brief.maxFare === undefined && !brief.emphasis, brief);
  assert("brief: meets the instant-sufficient threshold (no LLM latency)", understoodCount(brief) >= INSTANT_SUFFICIENT_FIELDS);

  // ── Dates ────────────────────────────────────────────────────────────────
  assert("tomorrow", parse("tomorrow").date === "2026-10-30");
  assert("today", parse("today").date === "2026-10-29");
  assert("day after tomorrow", parse("day after tomorrow").date === "2026-10-31");
  assert("31/10", parse("31/10").date === "2026-10-31");
  assert("ISO date", parse("2026-10-31").date === "2026-10-31");
  assert("Oct 31", parse("Oct 31").date === "2026-10-31");
  assert("31st October 2026", parse("31st October 2026").date === "2026-10-31");
  assert("1 Nov", parse("1 nov").date === "2026-11-01");
  assert("on friday → next Friday (30 Oct)", parse("on friday").date === "2026-10-30");
  assert("next monday → 2 Nov", parse("next monday").date === "2026-11-02");
  assert("this thursday (today) stays today", parse("this thursday").date === "2026-10-29");
  assert("next thursday (today) → +7", parse("next thursday").date === "2026-11-05");
  const nov31 = parse("31 Nov");
  assert("31 Nov → warning, no date", !nov31.date && nov31.warnings.length === 1, nov31);
  const far = parse("15 Dec");
  assert("date beyond the 14-day window → warning, no date", !far.date && far.warnings[0]?.includes("outside"), far);
  const past = parse("20 Oct");
  assert("a past day-month rolls to next year and is rejected (outside window)", !past.date && past.warnings.length === 1, past);
  const edge = parseBookingIntent("11 nov", { today: TODAY, horizonDays: DEFAULT_HORIZON_DAYS });
  assert("last selectable day (today+13 = 11 Nov) accepted", edge.date === "2026-11-11", edge);
  assert("first unselectable day (12 Nov) rejected", !parse("12 nov").date);
  assert("date inside '30 Oct 10 am' is not confused with a time", parse("30 Oct 10 am").date === "2026-10-30" && !parse("30 Oct 10 am").departureAfter);

  // ── Classes ──────────────────────────────────────────────────────────────
  assert("only 2A and 3A", same(parse("only 2A and 3A").classes, ["2A", "3A"]));
  assert("3rd AC → 3A", same(parse("3rd AC").classes, ["3A"]));
  assert("first ac → 1A", same(parse("first ac").classes, ["1A"]));
  assert("sleeper → SL", same(parse("sleeper").classes, ["SL"]));
  assert("non-ac → SL", same(parse("non-ac").classes, ["SL"]));
  assert("generic AC → all AC classes", same(parse("AC please").classes, ["1A", "2A", "3A", "CC", "EC"]));
  assert("chair car → CC", same(parse("chair car").classes, ["CC"]));
  assert("no sleeper → everything but SL", same(parse("no sleeper").classes, ["1A", "2A", "3A", "CC", "EC"]));
  assert("not SL or 1A → both excluded", same(parse("not SL or 1A").classes, ["2A", "3A", "CC", "EC"]));
  assert("comma ends negation scope", same(parse("no sleeper, 2A and 3A").classes, ["2A", "3A"]));
  assert("only 2A and 3A, not SL → 2A,3A", same(parse("only 2A and 3A, not SL").classes, ["2A", "3A"]));
  assert("'2 a.m.' is a time, never class 2A", !parse("depart after 2 a.m.").classes);
  assert("'2am' is a time, never class 2A", !parse("after 2am").classes);
  assert("sentence-final '3A.' is still a class", same(parse("only 3A.").classes, ["3A"]));
  assert("naming every class = no filter", !parse("SL 3A 2A 1A CC EC").classes);

  // ── Time windows ─────────────────────────────────────────────────────────
  const t1 = parse("after 6 pm");
  assert("after 6 pm → 18:00", t1.departureAfter === "18:00" && !t1.departureBefore, t1);
  const t2 = parse("before 9:30 am");
  assert("before 9:30 am", t2.departureBefore === "09:30" && !t2.departureAfter, t2);
  const t3 = parse("between 10 and 22");
  assert("between 10 and 22 (24h)", t3.departureAfter === "10:00" && t3.departureBefore === "22:00", t3);
  const t4 = parse("9 to 5 pm");
  assert("9 to 5 pm → 09:00–17:00", t4.departureAfter === "09:00" && t4.departureBefore === "17:00", t4);
  const t5 = parse("from 10:00 to 22:00");
  assert("from 10:00 to 22:00", t5.departureAfter === "10:00" && t5.departureBefore === "22:00", t5);
  const t6 = parse("10 am to 6");
  assert("10 am to 6 → 10:00–18:00", t6.departureAfter === "10:00" && t6.departureBefore === "18:00", t6);
  const t7 = parse("10 pm to 6 am");
  assert("overnight window → warning, nothing applied", !t7.departureAfter && !t7.departureBefore && t7.warnings.length === 1, t7);
  const t8 = parse("10am to 10pm");
  assert("no spaces: 10am to 10pm", t8.departureAfter === "10:00" && t8.departureBefore === "22:00", t8);
  const t9 = parse("2 to 3 passengers");
  assert("'2 to 3 passengers' is not a time", !t9.departureAfter && !t9.departureBefore, t9);
  const t10 = parse("morning");
  assert("morning → 05:00–11:59", t10.departureAfter === "05:00" && t10.departureBefore === "11:59", t10);
  const t11 = parse("evening, after 7 pm");
  assert("explicit time beats part-of-day", t11.departureAfter === "19:00" && !t11.departureBefore, t11);
  const t12 = parse("after 10 am before 8 pm");
  assert("separate after / before", t12.departureAfter === "10:00" && t12.departureBefore === "20:00", t12);
  const arr = parse("reach Delhi before 11 am");
  assert("arrival limit → warning, NOT a departure filter", !arr.departureBefore && !arr.departureAfter && arr.warnings.length === 1, arr);
  const arr2 = parse("I want to arrive by evening");
  assert("arrive by evening → warning, no daypart filter", !arr2.departureAfter && arr2.warnings.length === 1, arr2);

  // ── Fare / duration / odds / priority ────────────────────────────────────
  assert("under ₹1500", parse("under ₹1500").maxFare === 1500);
  assert("below Rs. 1,800", parse("below Rs. 1,800").maxFare === 1800);
  assert("budget of 2k", parse("budget of 2k").maxFare === 2000);
  assert("₹1200 or less", parse("₹1200 or less").maxFare === 1200);
  assert("within 4 hours → duration, not fare", parse("within 4 hours").maxDuration === 4 && parse("within 4 hours").maxFare === undefined);
  assert("under 3.5 hrs", parse("under 3.5 hrs").maxDuration === 3.5);
  assert("tiny number is not a fare", parse("under 5").maxFare === undefined);
  assert("at least 70% chance", parse("at least 70% chance").minSuccess === 70);
  assert("cheapest → fare emphasis", parse("cheapest").emphasis === "fare");
  assert("fastest → duration emphasis", parse("fastest").emphasis === "duration");
  assert("best chance → success emphasis", parse("best chance").emphasis === "success");
  assert("first emphasis in the sentence wins", parse("fastest but cheap").emphasis === "duration");

  const rich = parse("Fastest AC, morning, under ₹1500, at least 70% chance");
  assert(
    "rich prompt",
    same(rich.classes, ["1A", "2A", "3A", "CC", "EC"]) && rich.maxFare === 1500 && rich.minSuccess === 70 &&
      rich.emphasis === "duration" && rich.departureAfter === "05:00",
    rich
  );

  // ── Quota ────────────────────────────────────────────────────────────────
  assert("tatkal quota", parse("Tatkal 3A tomorrow").quota === "Tatkal");
  assert("no quota unless stated", !parse("3A tomorrow").quota);
  assert("senior citizen quota", parse("senior citizen quota").quota === "Senior Citizen");

  // ── Stations ─────────────────────────────────────────────────────────────
  assert("JP to NDLS", parse("JP to NDLS").to === "NDLS");
  assert("Jaipur to New Delhi", parse("Jaipur to New Delhi").to === "NDLS");
  assert("from Jaipur Junction to Delhi Cantt", parse("from Jaipur Junction to Delhi Cantt").to === "DEC");
  assert("JP to DEC (code)", parse("JP to DEC").to === "DEC");
  assert("to Sarai Rohilla", parse("JP to Sarai Rohilla").to === "DEE");
  assert("to Shakur Basti", parse("JP to Shakur Basti").to === "SSB");
  assert("to Delhi Junction", parse("from JP to Delhi Junction").to === "DLI");
  assert("destination before origin: 'to Delhi from Jaipur'", parse("book to Delhi from Jaipur").to === "ALL_DELHI");
  assert("'31 dec' is a date, not Delhi Cantt", (() => { const r = parse("31 dec"); return r.to === undefined; })());
  const ajmer = parse("from Ajmer to Delhi");
  assert("unsupported origin → warning, Delhi still applied", ajmer.to === "ALL_DELHI" && ajmer.warnings.some((x) => x.includes("Ajmer")), ajmer);
  const mumbai = parse("JP to Mumbai tomorrow");
  assert("unsupported destination → warning, no route set", !mumbai.to && mumbai.warnings.some((x) => x.includes("Mumbai")) && mumbai.date === "2026-10-30", mumbai);
  const reverse = parse("Delhi to Jaipur");
  assert("reverse direction → warning, no route set", !reverse.to && reverse.warnings.length === 1, reverse);
  assert("bare 'Delhi' sets the destination", parse("delhi").to === "ALL_DELHI");
  assert("'book a ticket' alone does not create a fake place", parse("I want to book a ticket").warnings.length === 0);

  // ── Robustness ───────────────────────────────────────────────────────────
  assert("empty string", understoodCount(parse("")) === 0 && parse("").warnings.length === 0);
  assert("gibberish", understoodCount(parse("asdf qwer zxcv")) === 0);
  assert("very long input does not throw", (() => { try { parse("a ".repeat(5000)); return true; } catch { return false; } })());
  assert("regex-hostile input does not throw", (() => { try { parse("((([[[ \\ ** ??? $^ 99999999999999999999 %"); return true; } catch { return false; } })());
  const t0 = Date.now();
  for (let i = 0; i < 300; i++) parse("Hey, I wanna book a ticket from JP to Delhi, I prefer only 2A and 3A. It should be on 31st Oct, from 10 am to 10 pm time");
  assert("parser is fast (300 parses < 400 ms)", Date.now() - t0 < 400, Date.now() - t0);

  // ── Examples shown in the UI must actually parse ─────────────────────────
  const ex1 = parse("JP to Delhi tomorrow, only 2A and 3A, depart 10 am to 10 pm");
  assert("example 1", ex1.to === "ALL_DELHI" && ex1.date === "2026-10-30" && same(ex1.classes, ["2A", "3A"]) && ex1.departureAfter === "10:00" && ex1.departureBefore === "22:00", ex1);
  const ex2 = parse("Cheapest sleeper to New Delhi day after tomorrow");
  assert("example 2", ex2.to === "NDLS" && ex2.date === "2026-10-31" && same(ex2.classes, ["SL"]) && ex2.emphasis === "fare", ex2);
  const ex3 = parse("Fastest AC in the morning, under ₹1500, at least 70% chance");
  assert("example 3", ex3.emphasis === "duration" && ex3.maxFare === 1500 && ex3.minSuccess === 70 && ex3.departureAfter === "05:00", ex3);

  // ── Chips ────────────────────────────────────────────────────────────────
  const chips = describeIntent(brief).map((c) => c.label);
  assert("chips: route, date, classes, time", chips.length === 4 && chips[0].startsWith("JP →") && chips[2] === "2A · 3A" && chips[3] === "Departs 10:00–22:00", chips);
  assert("chips: warnings are flagged", describeIntent(ajmer).some((c) => c.warn));
  const viz = toVizIntent(brief, "instant", 7);
  assert("viz intent carries filters and only context chips", viz.nonce === 7 && viz.departureAfter === "10:00" && viz.context.every((c) => c.warn || ["route", "date", "quota", "emphasis"].includes(c.key)), viz);

  // ── LLM output hardening ─────────────────────────────────────────────────
  const opts = { today: TODAY };
  const clean = sanitizeLlmIntent(
    {
      origin: "Jaipur", destination: "New Delhi", date: "2026-10-31", quota: "Tatkal", classes: ["2a", "3A", "bogus", 7],
      departureAfter: "10:00", departureBefore: "22:00", maxFare: 1800, maxDurationHours: 5.1, minSuccessPercent: 60, priority: "fare",
      unsupported: ["Passenger count is chosen in step 3"],
    },
    opts
  );
  assert(
    "sanitize: good payload passes through",
    clean.to === "NDLS" && clean.date === "2026-10-31" && clean.quota === "Tatkal" && same(clean.classes, ["2A", "3A"]) &&
      clean.departureAfter === "10:00" && clean.departureBefore === "22:00" && clean.maxFare === 1800 && clean.maxDuration === 5 &&
      clean.minSuccess === 60 && clean.emphasis === "fare" && clean.warnings.length === 1,
    clean
  );
  const dirty = sanitizeLlmIntent(
    {
      destination: "<script>alert(1)</script>", date: "2031-01-01", quota: "VIP", classes: "3A", departureAfter: "25:99", departureBefore: "7pm",
      maxFare: -5, maxDurationHours: 9999, minSuccessPercent: "high", priority: "DROP TABLE", unsupported: [{ x: 1 }, "ok\u0000note"],
    },
    opts
  );
  assert("sanitize: hostile payload is neutralised", !dirty.date && !dirty.quota && !dirty.classes && !dirty.departureAfter && !dirty.departureBefore && dirty.maxFare === undefined && dirty.maxDuration === undefined && dirty.minSuccess === undefined && !dirty.emphasis, dirty);
  assert("sanitize: hostile destination never becomes a route", !dirty.to, dirty);
  assert("sanitize: non-object input", sanitizeLlmIntent("nope", opts).warnings.length === 0 && sanitizeLlmIntent(null, opts).warnings.length === 0 && sanitizeLlmIntent([], opts).warnings.length === 0);
  assert("sanitize: all six classes = no filter", !sanitizeLlmIntent({ classes: ["SL", "3A", "2A", "1A", "CC", "EC"] }, opts).classes);
  assert("sanitize: inverted time window keeps only the lower bound", (() => { const r = sanitizeLlmIntent({ departureAfter: "20:00", departureBefore: "08:00" }, opts); return r.departureAfter === "20:00" && !r.departureBefore; })());

  // ── Merge policy ─────────────────────────────────────────────────────────
  const local: BookingIntent = { classes: ["2A"], departureAfter: "10:00", warnings: ["w1"] };
  const llm: BookingIntent = { classes: ["SL"], departureAfter: "06:00", departureBefore: "12:00", maxFare: 900, emphasis: "fare", date: "2026-10-31", warnings: ["w1", "w2"] };
  const merged = mergeIntents(local, llm);
  assert("merge: local classes/time win", same(merged.classes, ["2A"]) && merged.departureAfter === "10:00" && merged.departureBefore === undefined, merged);
  assert("merge: LLM fills gaps", merged.maxFare === 900 && merged.emphasis === "fare" && merged.date === "2026-10-31", merged);
  assert("merge: warnings de-duplicated", same(merged.warnings, ["w1", "w2"]), merged.warnings);
  assert("merge: LLM supplies a whole window when local has none", (() => { const r = mergeIntents({ warnings: [] }, llm); return r.departureAfter === "06:00" && r.departureBefore === "12:00"; })());

  // ── Trust-boundary normalisation (what the client does with the API response) ──
  const roundTrip = normalizeBookingIntent(JSON.parse(JSON.stringify(clean)), opts);
  assert("normalize: a sanitized intent survives a JSON round-trip unchanged", same(roundTrip, clean), roundTrip);
  const evil = normalizeBookingIntent(
    { to: "MUMBAI", date: "1999-01-01", quota: "VIP", classes: ["3A", "X", 5], departureAfter: "99:99", departureBefore: "10:00", maxFare: 1e9, maxDuration: 0, minSuccess: 150, emphasis: "drop", warnings: [1, "ok", "x".repeat(500)] },
    opts
  );
  assert(
    "normalize: out-of-range / unknown values are dropped",
    !evil.to && !evil.date && !evil.quota && same(evil.classes, ["3A"]) && !evil.departureAfter && evil.departureBefore === "10:00" &&
      evil.maxFare === undefined && evil.maxDuration === undefined && evil.minSuccess === undefined && !evil.emphasis &&
      evil.warnings.length === 2 && evil.warnings[1].length === 160,
    evil
  );
  assert("normalize: junk input yields an empty intent", understoodCount(normalizeBookingIntent(42, opts)) === 0 && understoodCount(normalizeBookingIntent(undefined, opts)) === 0);

  console.log(`Express-intent tests: ${passed} passed, ${failed} failed.`);
  return failed === 0;
}
