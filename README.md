# Park N Fly — Driver & Vehicle Tracker (by Drivex)

A dark-themed, mobile-first driver/vehicle operations tracker for Park N Fly,
built by **Drivex**. Two interfaces:

- **Driver app** (`/driver`) — tablet-optimized: shift start, pre-trip
  inspection, trip logging, breaks, incidents, fuel, end-of-shift PDF.
- **Manager dashboard** (`/manager`) — login-gated: live fleet, trips,
  fleet & fuel, staff, incidents, alerts/maintenance, reports, settings.
  Owner tier manages locations & manager accounts.

State persists in the browser (localStorage), structured to move onto a real
backend later (every integration point is tagged `// AIRTABLE:`).

## Demo vs. clean (blank) mode

A single build flag controls whether the app ships with sample data:

| `VITE_DEMO` | Behavior |
|-------------|----------|
| _unset / `false`_ (default) | **Clean, empty system** — no sample data. Just a bootstrap owner login + the inspection checklist. Ready to onboard real locations, staff, and vehicles. |
| `true` | **Demo mode** — seeds sample drivers, vehicles, 14 days of shifts, inspections, and incidents for client showcases. |

**First-time login (clean mode):** `owner@parknfly.ca` / `changeme`
→ change these in [`src/config.js`](src/config.js) (`BOOTSTRAP_OWNER`) before launch.

## Local development

```bash
npm install
npm run dev          # clean/blank system
VITE_DEMO=true npm run dev   # with demo data
```

Open `http://localhost:5173/driver` or `/manager`.

## Deploy on Railway

This repo includes `railway.json`. On Railway:

1. **New Project → Deploy from GitHub repo** → select `DriveXCanada/ParkNFly`.
2. Railway auto-detects Node/Nixpacks and uses:
   - Build: `npm run build`
   - Start: `npx serve -s dist -l $PORT` (SPA fallback included)
3. (Optional) leave `VITE_DEMO` unset for the clean system, or set it to
   `true` under **Variables** for a demo instance.
4. Deploy → Railway gives you a public URL.

> The app is a static SPA served by `serve`; `serve -s` handles client-side
> routes (`/driver`, `/manager`, …) so deep links work.

## Tech

React (Vite) · React Router · Zustand · Tailwind · Recharts · jsPDF ·
Lucide · vite-plugin-pwa (installable + offline).

---

*Park N Fly · Powered by Drivex — Built to run. Priced to grow.*
