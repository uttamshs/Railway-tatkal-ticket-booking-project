# DASH: Smart Railway Journey Planner
## Project Report & Feature Summary

### High-End Features Implemented

1. **Dynamic Train Search Integration**
   - **Description**: Instead of purely hardcoded mock lists, DASH intelligently hooks into the railway schedule API via server-side routes (`/api/search`).
   - **UX Improvement**: The user gets realistic, up-to-date schedule returns, while the prototype maintains fallback dummy data (`fallbackJourneys`) so that the application never abruptly crashes during demonstrations.

2. **Explainable Smart Match**
   - **Description**: Rather than claiming to use a black-box AI, Smart Match transparently re-ranks available trains based on human priorities (e.g., "Minimize fare", "Earlier arrival", "Confirmation confidence").
   - **UX Improvement**: Directly answers the user's question, "Why is this train recommended?" by explicitly displaying the trade-offs on the train card.

3. **Delhi Station Cluster Intelligence**
   - **Description**: Replaces the confusion of "Which Delhi station should I pick?" with an "All stations" option. DASH then recommends the optimal station (NDLS, DEC, DEE, etc.) based on the actual train routes returning that day.
   - **UX Improvement**: Eliminates decision paralysis. Uses progressive disclosure to show exactly why a station is recommended.

4. **Advanced Group Planner & Constraints Engine**
   - **Description**: DASH detects the makeup of a passenger group (e.g., detecting a passenger aged 60+ or a child). It then automatically suggests constraints like "Keep child with adult" or "Senior lower berth priority".
   - **UX Improvement**: Groups feel like first-class citizens. The UI explicitly states, "Senior passenger detected — lower berth preference prioritized," making the system feel intelligent and empathetic.

5. **Multi-Leg Journey & Per-Leg Preferences**
   - **Description**: Resolves the cumbersome IRCTC issue of needing to edit a "master list" to change preferences for a connecting train. Users can now assign different classes (e.g., 3A vs CC) and berths per leg inline.
   - **UX Improvement**: Keeps the user directly in the booking flow. It's an immense step up in convenience and flow continuity.

6. **Graceful Availability & Demo Fallback**
   - **Description**: DASH checks real-time seat availability through the backend. Since free railway APIs can be notoriously unreliable, if the API times out, DASH immediately falls back to a clearly labelled "DEMO" seat count. 
   - **UX Improvement**: No infinite loading spinners. The user is never blocked by a failed external API call. The distinction between LIVE and DEMO is kept completely transparent.

7. **Secure Server-Side Live Running Status**
   - **Description**: Integrates with the RailRadar API using secure environment variables (`.env.local`). The live status feature is cleanly separated from the primary booking flow to keep the main interface focused on booking (especially important for Tatkal).
   - **UX Improvement**: Users can still get live data (Location, Delay, Platform) when they need it, without it cluttering the decision-making space of finding a train.

---

### Deployment Guide (Moving away from localhost)

As requested, to ensure the prototype can be viewed globally instead of just on `localhost`, deploy it seamlessly using **Vercel** (the creators of Next.js).

#### Step 1: Push to GitHub
1. In the `dash` folder, initialize a git repository if you haven't: `git init`
2. Add the files: `git add .`
3. Commit the changes: `git commit -m "Final DASH prototype"`
4. Create a repository on GitHub and push the code: `git push -u origin main`

#### Step 2: Deploy on Vercel
1. Go to [Vercel.com](https://vercel.com/) and sign in with your GitHub account.
2. Click **Add New Project** and import the `dash` repository you just created.
3. In the **Environment Variables** section of the deployment configuration, add the following keys from your `.env.local`:
   - `RAILRADAR_API_KEY` : `(your actual key)`
   - `RAILRADAR_BASE_URL`: `https://api.railradar.in`
   - `RAIL_API_BASE_URL` : `https://indian-railway-api.onrender.com`
4. Click **Deploy**.

#### Step 3: Access
Vercel will build the project and provide you with a live, secure `https://` URL (e.g., `https://dash-journey.vercel.app`) that you can share with your professor and evaluators. No more `localhost` required!
