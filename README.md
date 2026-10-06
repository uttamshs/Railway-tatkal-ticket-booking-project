# Dash — Smart Rail Journey Planner

Dash is a high-fidelity HCI prototype for the Jaipur ↔ Delhi railway corridor. It focuses on the real interaction problem behind a booking: comparing services, choosing the right Delhi station, coordinating a group, handling passenger-specific class/berth preferences, understanding trade-offs, and recovering when a preferred service changes.

## Core improvements
- Date selection through a controlled journey-date dropdown/chip strip.
- Progressive disclosure: primary journey first, advanced tools when needed.
- Delhi station intelligence across NDLS, DLI, DEE, DEC and SSB.
- Explainable Smart Match with visible pros, trade-offs and priority controls.
- Live-data adapter for date-specific train search and class availability.
- Class-aware availability for 1A, 2A, 3A, 3E, CC, EC, SL and 2S when returned by the data source.
- Group Journey Planner with senior/child/group-cohesion constraints.
- Passenger-specific class and berth preferences inside the booking flow.
- Per-leg preferences so different journey legs can use different classes/berth choices.
- Fare transparency for a multi-passenger group.
- Recovery journeys / backup options.
- Journey-change alert intention.
- Explicit simulated payment handoff; Dash does not create a real ticket.
- Data provenance and freshness states; no invented live numbers.

## Railway data integration
Dash calls the server-side route `/api/search` for train search and `/api/availability` for class-level availability. The default adapter is configured for the community `indian-railway-api` service. A deployment can override `RAIL_API_BASE_URL` with another compatible service. Optional RailRadar integration is available for live running status and as an alternative railway-data provider when `RAILRADAR_API_KEY` is supplied.

**Important:** the app only labels data as live after the upstream request succeeds. If the provider is unavailable, Dash shows a clearly labelled fallback timetable rather than inventing availability.

## Local development
```bash
npm install
npm run dev
```
Open http://localhost:3000.

## Production
```bash
npm run build
npm start
```

## Environment variables
```env
RAIL_API_BASE_URL=https://indian-railway-api.onrender.com
# Optional
RAILRADAR_API_KEY=
RAILRADAR_BASE_URL=https://api.railradar.in
```

## Prototype boundary
Dash does not submit an IRCTC booking or payment. The final CTA is a simulated secure-payment handoff for the HCI prototype.

## Booking flow

Dash uses a focused four-step booking flow:

1. **Journey** — origin, Delhi station cluster, date and quota.
2. **Select train** — Smart Match, train comparison and class-specific live availability refresh.
3. **Passengers** — passenger-specific class/berth preferences, group constraints and per-leg overrides.
4. **Review & payment** — ticket-style journey summary, fare estimate, backup journeys and simulated secure-payment handoff.

Advanced information is shown inside the step where it is useful instead of competing on the main booking screen.

## Local live-status configuration

For local development, create `.env.local` from `.env.example` and set `RAILRADAR_API_KEY`. Keep `.env.local` private; it is intentionally ignored by Git.

The browser never receives the RailRadar key. Dash calls the provider through its server-side `/api/live` route.
