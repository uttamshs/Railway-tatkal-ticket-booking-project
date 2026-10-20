ROLE
You are a senior front-end engineer and data-visualization/HCI designer. I'm building a Tatkal railway ticket booking app. Your job is to ADD a new 3D train-comparison visualization to my EXISTING project without breaking anything that already works.

═══ HARD RULES (apply to every step) ═══
1. DO NOT modify, rename, move, or delete any existing file, function, route, style, or dependency unless I explicitly approve it. Put all new work in NEW files, in a new folder: StationViz3D-style isolation (e.g. /components/TrainViz3D/).
2. The only allowed edit to existing code is a minimal mount point (one import + one route/tab/component). Show me the exact diff and wait for approval before applying it.
3. Do NOT upgrade or remove packages. Only ADD new ones, and tell me which and why.
4. Work on a new git branch: feature/3d-train-viz. Commit after every step with a clear message.
5. After every step, run build, lint, and existing tests. If something fails, fix YOUR code, never the existing code.
6. No fake "done". If something is mocked, label it and isolate it in one data file. Only say a step is complete when it compiles and runs.
7. If anything is ambiguous, ask me instead of guessing.
8. After every step, report: what you did, files added, files modified (must be none except the approved mount point), and build/test results.

═══ PRODUCT CONTEXT ═══
During Tatkal booking (AC opens 10:00, Sleeper opens 11:00) users are under time pressure. The user has already chosen Source Station A, Destination Station B, and a date. The visualization compares ALL train options on that route so they can decide in seconds. Goal: MINIMIZE COGNITIVE LOAD. Each marker in the 3D scene is ONE TRAIN + CLASS.

═══ DATA MODEL ═══
Each option: trainNumber, trainName, travelClass (SL/3A/2A/1A/CC...), departureTime, arrivalTime, fare (₹), duration (hours), tatkalSuccessChance (0–100, estimated likelihood of a confirmed Tatkal ticket). Use ~10–20 realistic mock trains for one example route, in ONE isolated data file shaped so a real API can replace it later.

═══ VISUALIZATION SPEC ═══
- 3D scene (Three.js; React Three Fiber + drei if the project is React). Axes: X = fare, Y = tatkal success chance, Z = duration. Labeled, with gridlines and ticks. Each train is a marker with a short label.
- Composite goodness score 0–1: lower fare better, lower duration better, higher success better. User-adjustable weights via sliders (default: success 50%, fare 25%, duration 25%).
- Color: continuous GREEN (best) → YELLOW → RED (worst) by score, with a legend. Color-blind-safe toggle plus redundant encoding (rank badges #1/#2/#3 or marker size). Never rely on red/green alone.
- Pareto-optimal trains (not beaten on all 3 criteria) get a subtle outline/glow. Top 3 auto-highlighted, with a "Best pick" card.
- Interaction like Google Earth: drag = orbit, right-drag/two-finger = pan, scroll/pinch = zoom, smooth damping, sensible min/max limits. Hover: marker scales up, others dim, tooltip with all details. Click: camera flies smoothly to it, side panel shows details + "Book now" (wire to an existing booking handler ONLY if one exists, otherwise a clearly marked stub). Buttons: reset view, Top/Front/Side presets, auto-rotate toggle.
- Filters: class, max fare, max duration, min success %, departure window. Filtered-out trains fade, not vanish.
- Linked 2D ranked list as a fallback: selecting in either the list or the 3D scene syncs the other. Keyboard accessible. 60fps on a mid-range laptop, usable on mobile touch.
- UI: modern, elegant, dark theme, soft fog and lighting, faint ground grid, tasteful bloom, glassmorphism panels, one font family, consistent spacing, 200–300ms transitions, progressive disclosure (advanced controls collapsed). Loading skeleton, empty state, error state. Desktop = side panel, mobile = bottom sheet. Typed, commented, small components and hooks. Dispose Three.js geometries/materials on unmount.

═══ YOUR TASK NOW: STEP 0 ONLY ═══
1. Save everything above (rules, context, data model, spec) verbatim into a NEW file: docs/3d-train-viz-spec.md. This is the only file you create in this step.
2. Inspect the project and report: framework, language (JS/TS), build tool, styling system, state management, routing, existing booking handler(s), existing test setup, folder structure, and where a mount point would fit best.
3. Propose a file/folder structure for the new feature and the list of new dependencies.
4. List any risks or questions.
Do NOT write feature code yet. STOP and wait for my "go".
