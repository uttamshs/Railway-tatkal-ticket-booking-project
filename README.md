# Dash — Smart Rail Journey Planner & Tatkal Decision Support System

**Course:** AI511 — Human-Computer Interaction & Visualization (IIT Ropar)  
**Corridor Focus:** Jaipur Junction (`JP`) ↔ New Delhi Cluster (`NDLS`, `DLI`, `DEE`, `DEC`, `SSB`)

---

## EST Lab Final Submission Links

| Deliverable | Access Link | Format / Notes |
| :--- | :--- | :--- |
| **5-Slide Presentation Deck** | [**View Presentation Deck on Google Drive**](https://drive.google.com/file/d/1UQAANPy1jrTt_3t4kqAFTNuD98ozleab/view?usp=drive_link) | PDF (Also available in-repo at [`docs/Dash_EST_Final_Presentation.pdf`](./docs/Dash_EST_Final_Presentation.pdf) and [`docs/Dash_EST_Final_Presentation.pptx`](./docs/Dash_EST_Final_Presentation.pptx)) |
| **5-Minute Video Walkthrough & Pitch** | [**Watch Video Walkthrough & Pitch on Google Drive**](https://drive.google.com/file/d/1NRPTJO7oJpVztQShGgwkzgOgscfGTAT4/view?usp=drive_link) | Part 1: 5-Slide Technical Walkthrough · Part 2: Live Application Demo & Pitch |
| **Lab 9 Validation Report** | [`docs/Lab 9 Validation Summary Report.pdf`](./docs/Lab%209%20Validation%20Summary%20Report.pdf) | Empirical usability, accessibility (Lighthouse 98/100), and SUS (87.5/100) evaluation |

---

## Team Members & Contributions

* **Harshit (`@iArceus10`)** — *3D/4D InfoVis, Express NLP Intent & HCI Evaluation*
  * **3D/4D WebGL Tatkal Decision Landscape (`components/TrainViz3D/`):** Three.js coordinate space mapping Fare ($X$), Duration ($Z$), and Confirmation Probability ($Y$), Pareto-optimal frontier rings, interactive weight sliders, and linked 2D table.
  * **4D Checkout Survival Scrubber & Plan A + B Tether (`temporalModel.ts`):** Class-specific seat depletion modeling across `0s`, `+60s UPI`, `+2m`, and `+3m` horizons, 3D quota-jump vector arcs, and `Focus Top 3` mode.
  * **Dual-Engine Express Intent Bar (`lib/intent.ts`, `ExpressIntentBar.tsx`):** Sub-5ms deterministic English/Hinglish & voice parser with optional Gemini/Groq LLM extraction and 140 automated unit tests.
* **Uttam Kumar (`@uttamshs`)** — *AI Copilot Backend, Railway API Pipeline & 2D Decision Support*
  * **Bounded-Context AI Copilot (`app/api/copilot/route.ts`, `lib/copilotPrompt.ts`, `DashAICopilot.tsx`):** OpenAI/Gemini-compatible proxy with anti-hallucination prompt rules, IP rate-limiting, and automatic heuristic fallback.
  * **3-Tier Railway API Pipeline (`app/api/availability/`, `app/api/search/`, `app/api/live/`):** Live RailKit SDK and RailRadar integrations with 15-minute in-memory caching, timeout circuit-breakers, and IST (`Asia/Kolkata`) window calculation.
  * **2D Pareto Canvas, Waitlist Probability & Anti-Bot Flow (`ParetoDecisionCanvas.tsx`, `probabilityModel.ts`, `AntiBotCanvasModal.tsx`):** Direct-manipulation budget/duration threshold sliders, Gigerenzer frequency-framing waitlist meters, senior lower-berth group allocation, and kinematic anti-bot checkout verification.

---

## Core System Features

1. **Dual-Engine Express Intent Bar (Step 1):** Type, click a preset, or use voice input (e.g., *"JP to Delhi tomorrow, only 2A and 3A, depart 10 am to 10 pm"*) to configure route, date, quota, classes, and time window in one action and jump directly into the 3D visualizer.
2. **3D/4D Tatkal Decision Space (Step 2):** Interactive Three.js WebGL canvas plotting every train-class option with real-time weight sliders, `+60s UPI` checkout survival forecasting, automatic **Plan A + Backup B** tethering across distinct trains, and `Focus Top 3` clutter reduction.
3. **Station Quota-Jumping Explorer:** Exposes legal upstream General Quota pools (booking from origin **Ajmer Junction `AII`** with boarding at **Jaipur Junction `JP`** under IRCTC Commercial Circular No. 2018/TG-I/20/P) via an interactive route topology map and 3D vector arcs.
4. **2D Pareto Canvas & Calibrated Waitlist Meters:** Coordinated 2D scatter view with draggable budget/duration ceiling lines and frequency-framed confirmation meters (*"8 out of 10 similar waitlists confirmed"*).
5. **Group Berth Intelligence & Kinematic Anti-Bot Verification (Steps 3 & 4):** Automatically assigns lower-berth preferences for senior citizens (60+) and clusters family groups in the same coach, followed by a 1.5-second drag-docking human verification challenge and simulated PNR receipt.

---

## Complete Setup & Replication Guide

### 1. Prerequisites
* **Node.js:** `v20.0.0` or higher (`v22 LTS` recommended)
* **Package Manager:** `npm` (included with Node.js)
* **Git:** To clone the repository

### 2. Clone the Repository & Install Libraries
Run the following commands in your terminal:

```bash
git clone https://github.com/uttamshs/Railway-tatkal-ticket-booking-project.git
cd Railway-tatkal-ticket-booking-project
npm install
```

This installs all required runtime and development packages defined in `package.json`:
* `next` (`16.3.7`), `react` (`19.2.0`), `react-dom` (`19.2.0`)
* `three` (`^0.186.1`) & `@types/three` (WebGL 3D/4D decision landscape)
* `railkit` (`^6.0.1`) (Indian Railways live availability & schedule SDK)
* `typescript` (`^5.7.0`) & `eslint` (`^9.0.0`)

### 3. Start the Application (Works Out-of-the-Box Without API Keys)
You can run the full application immediately **without configuring any paid or external API keys**:

```bash
npm run dev
```

Open **`http://localhost:3000`** in your browser.
* **Zero-Config Resilience:** Every backend endpoint (`/api/search`, `/api/availability`, `/api/live`, `/api/ai-intent`, `/api/copilot`) is engineered with automatic multi-tier fallbacks. When external keys are omitted or rate-limited, the server seamlessly serves the verified Northern / North-Western Railway Jaipur–Delhi corridor schedule and uses the built-in deterministic NLP and heuristic engines with explicit data-provenance badges (`Live check` vs. `Timetable` vs. `Estimated`).

---

## Optional API Keys Configuration Guide (`.env.local`)

To enable live upstream railway scraping and external LLM providers, copy `.env.example` to `.env.local` in the root folder:

```bash
cp .env.example .env.local
```

Below is the complete guide for each optional environment variable in `.env.local` and where to obtain the keys:

```env
# 1. Railway Schedule & Live Availability Providers
RAIL_API_BASE_URL=https://indian-railway-api.onrender.com
RAILRADAR_BASE_URL=https://api.railradar.in
RAILRADAR_API_KEY=your_railradar_api_key_here
RAILKIT_API_KEY=your_railkit_api_key_here

# 2. Express Intent Bar Free-Tier LLM Accelerators (/api/ai-intent)
GEMINI_API_KEY=
GROQ_API_KEY=

# 3. Dash AI Copilot OpenAI-Compatible Provider (/api/copilot)
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
LLM_API_KEY=
LLM_MODEL=gemini-1.5-flash
COPILOT_RATE_LIMIT=20
```

### How to Obtain Each Key
1. **`RAILKIT_API_KEY` (Used by `/api/availability`):**
   * Powered by the [`railkit`](https://www.npmjs.com/package/railkit) npm SDK for live IRCTC seat availability and fare lookups. A default development key is pre-configured with automatic fallback to the verified corridor inventory if the 30-minute quota is exhausted.
2. **`RAILRADAR_API_KEY` (Used by `/api/live` and `/api/search`):**
   * Sign up at [railradar.in](https://railradar.in) to obtain a bearer token for live NTES train running status and delay tracking. If omitted, `/api/live` falls back to the verified Jaipur Junction platform and schedule tracker.
3. **`GEMINI_API_KEY` or `GROQ_API_KEY` (Used by `/api/ai-intent`):**
   * **Google Gemini (Free Tier):** Create a free key at [Google AI Studio](https://aistudio.google.com/app/apikey).
   * **Groq (Free Tier):** Create a free key at [Groq Console](https://console.groq.com/keys).
   * *Note:* The local deterministic parser in `lib/intent.ts` always executes first in `<5ms`; these keys are only called for complex free-form or Hinglish sentences.
4. **`LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` (Used by `/api/copilot`):**
   * Accepts any OpenAI-compatible chat completion endpoint (Google Gemini OpenAI compatibility endpoint, Groq, OpenAI, or Mistral). You can reuse your Google AI Studio key here with `LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/` and `LLM_MODEL=gemini-1.5-flash`. If omitted, `/api/copilot` automatically uses the corridor heuristic engine in `lib/aiCopilot.ts`.

---

## Running Automated Tests & Production Build

### Run the 140 Automated Unit Tests
The repository includes two self-contained test suites covering the 3D/4D scoring engine, Pareto dominance, WCAG AA contrast ratios, 4D temporal depletion, quota-jump math, and NLP intent sanitization:

```bash
# Run 3D Scoring, Pareto, WCAG Contrast, 4D Temporal & Quota-Jump tests (32 assertions)
npx tsx -e "import { runTests } from './components/TrainViz3D/lib/scoringEngine.test'; if (!runTests()) process.exit(1);"

# Run Express Intent NLP Parser & LLM Trust-Boundary Sanitization tests (108 assertions)
npx tsx -e "import { runTests } from './lib/intent.test'; if (!runTests()) process.exit(1);"
```

### Build & Run for Production
```bash
npm run build
npm start
```

---

## Repository Structure

```text
├── app/
│   ├── api/
│   │   ├── ai-intent/route.ts      # Dual-engine NLP intent endpoint (Gemini / Groq + sanitizer)
│   │   ├── availability/route.ts   # 3-tier seat availability endpoint (RailKit + caching + corridor baseline)
│   │   ├── copilot/route.ts        # Bounded-context LLM Copilot proxy with rate limiting & fallback
│   │   ├── live/route.ts           # Live train running status & platform lookup
│   │   └── search/route.ts         # Corridor train search with 15-min cache & upstream cooldown
│   ├── globals.css                 # Light/Dark theme tokens & responsive styles
│   ├── layout.tsx                  # Root layout & metadata
│   └── page.tsx                    # 4-step booking state machine & coordinated views
├── components/
│   ├── TrainViz3D/                 # 3D/4D WebGL Tatkal Decision Landscape (Three.js Scene, HUD, lib)
│   ├── AntiBotCanvasModal.tsx      # Kinematic drag-docking verification & concurrency queue
│   ├── DashAICopilot.tsx           # Conversational assistant drawer with executable UI actions
│   ├── ExpressIntentBar.tsx        # Natural-language & voice intent capture bar
│   ├── ParetoDecisionCanvas.tsx    # 2D SVG Pareto frontier scatter plot with budget/duration sliders
│   ├── QuotaJumpingModal.tsx       # Ajmer (AII) -> Jaipur (JP) route topology & quota-jump explorer
│   └── Stepper.tsx                 # Progress stepper component
├── lib/
│   ├── aiCopilot.ts                # Deterministic corridor trade-off & intent rule engine
│   ├── copilotPrompt.ts            # Anti-hallucination system prompt for /api/copilot
│   ├── data.ts                     # Jaipur <-> Delhi corridor timetable & station clusters
│   ├── intent.ts                   # Instant NLP parser, sanitizer & 3D filter translator
│   ├── intent.test.ts              # 108 unit tests for NLP parsing & security boundaries
│   ├── probabilityModel.ts         # Waitlist confirmation estimator & frequency framing
│   ├── quotaJumping.ts             # Upstream origin station quota-jumping rules
│   ├── recommendation.ts           # Multi-criteria Smart Match ranking engine
│   └── types.ts                    # Shared TypeScript interfaces
└── docs/
    ├── Dash_EST_Final_Presentation.pdf   # 5-Slide Final Presentation Deck (PDF)
    ├── Dash_EST_Final_Presentation.pptx  # 5-Slide Final Presentation Deck (Editable PowerPoint)
    ├── Lab 9 Validation Summary Report.pdf
    └── DASH_Report.md
```

---

## Academic Prototype Disclaimer
Dash is an academic research prototype developed for **AI511 (Human-Computer Interaction & Visualization)** at **IIT Ropar**, not an official commercial railway reservation service. Fallback corridor availability figures are explicitly badged as timetable/estimated baselines when live APIs are rate-limited, and the Step 4 payment step is a simulated checkout handoff that does not process real financial transactions or issue official IRCTC tickets.
