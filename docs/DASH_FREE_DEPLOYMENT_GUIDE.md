# Dash — Free Deployment Guide (Beginner Friendly)

## Recommended setup

Use **GitHub + Vercel** for the Next.js app.

Dash already uses server-side API routes for railway-data calls, so third-party API requests and optional API keys do not need to be exposed in the browser.

---

## Part 1 — Put Dash on GitHub

### 1. Install Git

If Git is not already installed, install Git for Windows.

Then open **VS Code** and open the Dash project folder.

### 2. Open the VS Code terminal

Run:

```bash
git init
git add .
git commit -m "Initial Dash smart journey planner"
```

### 3. Create a GitHub repository

On GitHub:

1. Click **New repository**.
2. Name it something like `dash-smart-journey-planner`.
3. Keep it public if your course allows public repositories.
4. Do not add another README if Dash already contains one.

Then connect the local project:

```bash
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

After that, the project is version-controlled.

---

## Part 2 — Test Dash locally

Install dependencies:

```bash
npm install
```

Start development:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Test these flows before deploying:

1. Change the journey date.
2. Change Delhi station.
3. Open Station Intelligence.
4. Refresh live availability.
5. Select a class such as 2A, 3A or CC.
6. Open Smart Journey Planner.
7. Add multiple passengers.
8. Edit berth and class preferences.
9. Add another journey leg.
10. Change the same passenger's preference on the second leg.
11. Compare trains.
12. Open Data & Trust.
13. Confirm payment is described as a simulated handoff.

---

# Part 3 — Railway-data configuration

Dash has a server-side railway-data adapter.

The default configuration is:

```env
RAIL_API_BASE_URL=https://indian-railway-api.onrender.com
```

The app calls:

```text
/api/search
/api/availability
```

instead of calling the third-party service directly from the browser.

### Why this matters

It keeps the data boundary in one place and makes it possible to replace the provider later without rewriting the UI.

### Important

The default community railway API is an external service. Its availability and response format are outside Dash's control.

If the service responds successfully, Dash shows the result as live data.

If it fails, Dash switches to clearly labelled fallback timetable data.

**It never invents a live seat count.**

---

# Part 4 — Deploy on Vercel for free

### 1. Create a Vercel account

Go to Vercel and sign in with GitHub.

### 2. Import the GitHub repository

Choose:

**Add New → Project → Import Git Repository**

Select your Dash repository.

Vercel should automatically detect:

```text
Framework: Next.js
Build command: next build
Install command: npm install
```

Do not change these unless Vercel shows a different valid configuration.

### 3. Add environment variables

In Vercel:

**Project → Settings → Environment Variables**

Add:

```text
RAIL_API_BASE_URL
```

Value:

```text
https://indian-railway-api.onrender.com
```

You can also add:

```text
RAILRADAR_BASE_URL
```

Value:

```text
https://api.railradar.in
```

If you have a RailRadar API key:

```text
RAILRADAR_API_KEY
```

Set its value to your private key.

Do **not** put a private API key directly inside `page.tsx`.

### 4. Deploy

Click **Deploy**.

Vercel will:

1. Clone the GitHub repository.
2. Install dependencies.
3. Build the Next.js application.
4. Deploy the server-side API routes.
5. Give you a public URL.

The result will look approximately like:

```text
https://dash-smart-journey-planner.vercel.app
```

Use the exact URL Vercel gives you.

---

# Part 5 — Test the deployed version

Do not stop after seeing the homepage.

Open the public URL in an incognito window and test:

### Journey

- Date dropdown works.
- Delhi — all stations works.
- Individual Delhi stations work.
- Search refreshes for the selected date.

### Live data

- Refresh availability.
- Select 2A / 3A / CC where the train supports it.
- Confirm the timestamp/status changes.
- If the provider is unavailable, confirm that Dash says so rather than displaying a fake number.

### Smart Match

- Change Balanced → Lower fare.
- Change Balanced → Earlier arrival.
- Open the recommendation explanation.
- Compare two or three trains.

### Group planner

- Add multiple passengers.
- Set a senior to Lower berth.
- Set a child with an adult.
- Turn on Keep everyone together.
- Edit passenger class and berth.
- Add a second leg.
- Give the same passenger a different class/berth preference on that leg.

### Trust boundary

Open:

**Data & Trust**

Confirm that the interface explicitly says:

- what is live,
- what is fallback/demo,
- what is user-controlled,
- and that payment is simulated.

---

# Part 6 — GitHub version-control workflow for Lab 8

After each meaningful improvement:

```bash
git status
git add .
git commit -m "Add group journey planner"
git push
```

Useful commits for your project:

```text
Initial Dash prototype
Add date selector and station intelligence
Add live railway data adapter
Add explainable Smart Match
Add group journey planner
Add passenger and per-leg preferences
Add recovery journey and trust boundary
Polish responsive UI
```

This makes your GitHub history demonstrate actual iterative development instead of one giant upload.

---

# Part 7 — If Vercel shows a build error

Do not randomly change files.

Copy the **complete Vercel build error** and check the first TypeScript/Next.js error.

Common checks:

```bash
npm install
npm run build
```

If the local build fails, fix the local error before redeploying.

---

# Part 8 — Important presentation wording

Do NOT say:

> “Dash has live IRCTC data.”

Say:

> “Dash integrates a server-side railway-data adapter. When the upstream service responds, the interface displays live returned data with its freshness state. If it is unavailable, Dash explicitly switches to labelled fallback data rather than fabricating availability.”

For the payment flow, say:

> “The payment step is a simulated handoff. Dash does not create an actual railway booking.”

For Smart Match, say:

> “The recommendation is explainable preference-based decision support. We have deliberately not labelled it as trained machine learning.”

That wording is both technically honest and much harder to challenge in a viva.
