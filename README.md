# DASH — Smart Rail Journey Planner
> **Course:** Human-Computer Interaction (HCI — AI511)  
> **Milestone:** Lab 8: Improve (Implementation, GitHub & Documentation)  
> **Route Corridor:** Jaipur (JP) ↔ Delhi Metropolitan Cluster (NDLS, DLI, DEE, DEC, SSB)  
> **Version:** `v3.0.0`  
> **Evaluation Date:** 07 October 2026  
> **Official Submission Document:** [`docs/documentation.pdf`](docs/documentation.pdf)

---

## 1. Project Introduction
**Dash** is a high-fidelity, human-centered railway journey planner designed specifically for the high-density Jaipur–Delhi transit corridor. While traditional railway booking portals (such as IRCTC) treat ticket purchasing as a rigid transactional form, Dash addresses the complex cognitive and decision-making challenges of real travel: multi-passenger coordination, terminal ambiguity across metropolitan clusters, transparent trade-off evaluation, and contingency recovery when preferred services become unavailable.

---

## 2. Problem Statement
Booking railway journeys in India—particularly on congested corridors under high-stakes quotas like Tatkal—presents severe user experience bottlenecks:
1. **Station Ambiguity in Metropolitan Hubs:** Travellers heading to Delhi often do not know whether to select New Delhi (NDLS), Old Delhi (DLI), Delhi Sarai Rohilla (DEE), Delhi Cantt (DEC), or Shakur Basti (SSB), leading to decision paralysis.
2. **Cognitive Load & Visual Overwhelm:** Legacy interfaces present overwhelming tabular matrices of train data, forcing users to mentally cross-reference arrival times, fares, dynamic quotas, and seat availability.
3. **Rigid Multi-Passenger & Group Workflows:** Official portals mandate navigating away to an isolated "Master List" to edit passenger preferences. When planning multi-leg journeys (e.g. 3AC on Leg 1 requiring a Lower Berth, and Chair Car on Leg 2 requiring a Window Seat), passengers cannot set distinct preferences per leg inline.
4. **Opaque "AI" and Recommendation Claims:** Systems often promote a single "Best Train" without articulating the compromises involved (e.g. earlier arrival vs higher ticket cost vs confirmation probability).
5. **Data Freshness & Trust Ambiguity:** Users are frequently misled by static or cached seat counts that masquerade as live inventory, only to fail during final checkout.

---

## 3. Project Objectives
- **Reduce Cognitive Friction:** Implement progressive disclosure so that primary booking journeys remain streamlined while advanced analytical tools (station guides, trade-off comparisons) open only on explicit user request.
- **Empower Group Travel:** Automatically identify passenger demographics (seniors aged 60+, children under 12) and apply intelligent group constraints (senior lower-berth priority, child-adult proximity, coach split prevention).
- **Solve the Master-List Defect:** Enable seamless in-flow customization of passenger class and berth preferences, including per-leg overrides for multi-leg journeys.
- **Ensure Transparent System Status:** Connect to server-side railway API proxies (RailRadar & Indian Railway API) with explicit timestamped `LIVE` indicators and honest, unmasked `DEMO FALLBACK` modes when external services are unavailable.
- **Provide Contingency Planning:** Proactively generate backup fallback journeys and change-alert intents to safeguard travelers against sudden seat depletion.

---

## 4. Team Members & Roles
| Name | Role | Primary Responsibilities |
| :--- | :--- | :--- |
| **Harshit Kulshrestha** | Lead Developer & UI/UX Architect | React 19 / Next.js implementation, Progressive Disclosure flow, Smart Match 2.0 recommendation engine, Lab 7 usability session analysis, design system & dual-theme architecture. |
| **Uttam (uttamshs)** | Co-Developer & Repository Administrator | GitHub repository setup, version control governance, server-side API proxy routes (RailRadar & IR API), cloud deployment pipeline, and documentation maintenance. |

---

## 5. Technologies Used
- **Frontend Framework:** [Next.js 16.3.7](https://nextjs.org/) (App Router architecture with React Server Components)
- **UI Runtime:** [React 19.2.0](https://react.dev/) & React-DOM
- **Language & Type System:** [TypeScript 5.7.0](https://www.typescriptlang.org/) (Strict typing for trains, passengers, and quotas)
- **Styling Architecture:** Modern CSS3 Custom Properties (zero-runtime token-based Dark/Light theme switching, WCAG 2.1 AA accessible contrast)
- **Live Railway Data APIs:**
  - [RailRadar API](https://api.railradar.in) (Real-time train running status, platform numbers, and live delay tracking)
  - Indian Railway REST Service (Timetable, schedule, and class-level seat availability queries)
- **Verification & Documentation:** [Playwright](https://playwright.dev/) (Automated layout rendering & publication-grade PDF synthesis)
- **Deployment Platform:** [Vercel](https://vercel.com/) (Production serverless hosting with environment variable encryption)

---

## 6. Empirical Findings from Lab 7 Usability Testing
During **Lab 7**, we evaluated 11 participants (P01 to P11) across two core tasks (Task 1: Train Search & Selection; Task 2: Passenger Details & Review) followed by an open exploration protocol.
- **Quantitative Benchmark:**
  - **Task 1 Completion Rate:** 100% (Mean Time: ~10.4s)
  - **Task 2 Completion Rate:** 100% (Mean Time: ~13.5s)
  - **Overall Mean SUS Score:** **74.09 / 100** (Grade B+ usability benchmark)
- **Key Qualitative Feedback Collected:**
  - *P01:* "Date selection is better with a dates dropdown instead of typing." (SUS: 72.5)
  - *P02:* "There are too many things competing for my attention." (SUS: 75.0)
  - *P03:* "I don't know which Delhi station I should select. Clarify which station is most relevant." (SUS: 85.0)
  - *P05:* "The recommendation tells me what is best, but I don't completely understand the trade-off." (SUS: 70.0)
  - *P06:* "I can't tell whether the availability is actually real. If it's dummy numbers mention it, otherwise show real time availability." (SUS: 70.0)
  - *P07:* "The group planner doesn't really feel intelligent enough yet. Improve its algorithm." (SUS: 77.5)
  - *P08:* "Fare doesn't feel complete enough for a group. Add price breakdown." (SUS: 67.5)
  - *P09:* "What happens if my preferred train becomes unavailable suddenly?" (SUS: 60.0)
  - *P10:* "Is it actually booking a real ticket? Why end at payment handout?" (SUS: 87.5)
  - *P11:* "Light theme could be better." (SUS: 75.0)

---

## 7. The 12 Meaningful Improvements Implemented in Lab 8
To directly resolve the limitations surfaced in Lab 7, the Lab 8 build incorporates 12 structural improvements:
1. **Controlled Journey-Date Selector:** Replaced free-text date typing with an interactive 14-day date chip strip and formatted dropdown selector (*Eliminates format errors; Nielsen #5*).
2. **Cognitive Load Reduction & Progressive Disclosure:** Focused 4-step linear flow (`Journey` → `Select Train` → `Passengers` → `Review`). Deep-dive comparison tools and cluster guides open on demand (*Aesthetic and Minimalist Design; Nielsen #8*).
3. **Delhi Station Cluster Intelligence:** "Delhi — All Stations" aggregates NDLS, DLI, DEE, DEC, and SSB. Dash explains the routing rationale behind station recommendations (*Match Between System and Real World; Nielsen #2*).
4. **Explainable Smart Match 2.0:** Articulates explicit trade-offs (e.g. faster transit vs early morning departure vs confirmation odds) across controllable priorities (*User Control & Freedom; Nielsen #3*).
5. **Live Railway Data Adapter & Honest Fallback:** Server-side proxy routes for real-time data with refresh timestamps. If external services fail, Dash clearly tags data as `DEMO FALLBACK` instead of faking live availability (*Visibility of System Status; Nielsen #1*).
6. **Intelligent Group Constraint Engine:** Automatically flags senior citizens (age 60+) for lower berth allocation, keeps children (<12) paired with adults, and enables group-together rules (*Flexibility & Efficiency; Nielsen #7*).
7. **In-Flow Passenger Customization & Per-Leg Overrides:** Fixes IRCTC's master-list defect by enabling direct inline preference editing and different class/berth preferences on different legs of a journey (*Major UX Innovation*).
8. **Multi-Passenger Group Fare Transparency:** Complete itemization of per-passenger base fares, optional meals (₹120/meal), and total group costs with zero hidden charges.
9. **Automated Fallback & Recovery Journeys:** Pre-computed contingency backup services (Shatabdi, Rajdhani, Double Decker) with departure buffers and journey-change alert intents (*Error Recovery; Nielsen #9*).
10. **Ethical Prototype Boundary:** Clear labeling of the final checkout step as a **Simulated Secure Payment Handoff**, preventing confusion over whether actual tickets were purchased.
11. **Information-Layered Train Cards:** Visual redesign prioritizing departure time, transit duration, price, and class chips, with collapsible secondary amenities.
12. **Theme Switcher & WCAG AA Accessibility:** Dark/Light theme toggle, visible keyboard focus indicators (`focus-visible`), and verified 4.5:1 text contrast ratios.

---

## 8. Repository Structure & File Map
```
dash/
├── app/
│   ├── api/
│   │   ├── availability/route.ts    # Upstream train class availability proxy
│   │   ├── live/route.ts            # Secure RailRadar live status endpoint
│   │   └── search/route.ts          # Multi-station cluster search proxy
│   ├── globals.css                  # Theme tokens (dark/light), typography, focus states
│   ├── layout.tsx                   # Root HTML shell, responsive viewport metadata
│   └── page.tsx                     # Core 4-step interactive journey planner
├── components/
│   └── Stepper.tsx                  # Accessible visual step progress indicator
├── docs/
│   ├── documentation.pdf            # Comprehensive Lab 8 report & viva guide
│   ├── DASH_FREE_DEPLOYMENT_GUIDE.md# Vercel deployment walkthrough
│   └── DASH_Report.md               # Summary feature release notes
├── lib/
│   ├── data.ts                      # Station cluster definitions, fallback demo timetables
│   ├── recommendation.ts            # Explainable Smart Match & trade-off ranking engine
│   └── types.ts                     # TypeScript interfaces (Train, Passenger, Berth, Priority)
├── public/                          # Optimized SVG/PNG assets and Dash branded icon
├── .env.example                     # Template for railway API environment variables
├── .env.local                       # Private developer API keys (git-ignored)
├── package.json                     # Project manifest (Next.js 16, React 19, TypeScript 5.7)
└── README.md                        # Project documentation & onboarding guide
```

---

## 9. Local Development Quickstart

### Prerequisites
- Node.js (version 18.18.0 or higher)
- npm or pnpm

### Installation & Run
```bash
# Clone the repository
git clone git@github.com:uttamshs/Railway-tatkal-ticket-booking-project.git

# Navigate into project directory
cd dash

# Install dependencies
npm install

# Setup local environment variables
cp .env.example .env.local
# (Optional: Add RAILRADAR_API_KEY in .env.local if live running status is desired)

# Start development server
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 10. Production Deployment (Vercel)
To deploy Dash globally so that evaluators can access it without running `localhost`:
1. Push your latest code to GitHub:
   ```bash
   git add .
   git commit -m "feat: complete Lab 8 improvements, documentation, and styling"
   git push origin main
   ```
2. Log in to [Vercel](https://vercel.com/) and import the `uttamshs/Railway-tatkal-ticket-booking-project` repository.
3. Set the root directory to `dash`.
4. In the **Environment Variables** configuration, set:
   - `RAIL_API_BASE_URL`: `https://indian-railway-api.onrender.com`
   - `RAILRADAR_BASE_URL`: `https://api.railradar.in`
   - `RAILRADAR_API_KEY`: `(your private key)`
5. Click **Deploy**. Vercel will output a live, secure HTTPS production URL (e.g., `https://dash-rail.vercel.app`).

---

## 11. Prototype Boundary & Ethical Notice
Dash is an academic Human-Computer Interaction research prototype developed for coursework evaluation under **AI511 (HCI)**. It does not perform actual financial debit transactions or issue live Indian Railways (IRCTC/CRIS) Passenger Name Records (PNR). The checkout flow concludes at an explicit **Simulated Secure Payment Handoff**.
