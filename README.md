# Park N Fly — Driver & Vehicle Tracker (by Drivex)

A dark-themed, mobile-first driver/vehicle operations tracker for Park N Fly,
built by **Drivex**. Two interfaces:

- **Driver app** (`/driver`) — tablet-optimized: shift start, pre-trip
  inspection, trip logging, breaks, incidents, fuel, end-of-shift PDF.
- **Manager dashboard** (`/manager`) — login-gated: live fleet, trips,
  fleet & fuel, staff, incidents, alerts/maintenance, reports, settings.
  Owner tier manages locations & manager accounts.

Data is stored server-side in **Postgres** via a small Express backend, so every
logged-in device sees the same live data. When no database is configured the app
gracefully falls back to browser-local storage (single-device, no sync).

## Demo vs. clean (blank) mode

A single build flag controls whether the app ships with sample data:

| `VITE_DEMO` | Behavior |
|-------------|----------|
| _unset / `false`_ (default) | **Clean, empty system** — no sample data. Just a bootstrap owner login + the inspection checklist. Ready to onboard real locations, staff, and vehicles. |
| `true` | **Demo mode** — seeds sample drivers, vehicles, 14 days of shifts, inspections, and incidents for client showcases. |

**First-time login (clean mode):** the bootstrap owner in
[`src/config.js`](src/config.js) (`BOOTSTRAP_OWNER`). It is seeded into the
database on first boot; rotate the password in-app after launch.

## Architecture

- **Frontend** — React (Vite) SPA. Local state in Zustand; hydrates from the
  backend on load and polls so devices converge.
- **Backend** — `server/index.js` (Express): serves the built app **and** a
  same-origin JSON API (`/api/*`) that reads/writes Postgres. No DB credentials
  ever reach the browser.
- **Database** — Postgres. Tables auto-create on boot (`server/schema.js`); each
  collection is a `(id, data jsonb)` document row.

## Local development

Frontend only (local-only mode, no sync):

```bash
npm install
npm run dev          # clean/blank system → http://localhost:5173
VITE_DEMO=true npm run dev   # with demo data
```

Full stack with sync (needs a Postgres URL in `.env`):

```bash
cp .env.example .env        # set DATABASE_URL
npm run build               # build the SPA the server will serve
npm run dev:server          # Express + Postgres on :3000
# in another terminal, `npm run dev` proxies /api → :3000
```

## Deploy on Railway

This repo includes `railway.json`. On Railway:

1. **New Project → Deploy from GitHub repo** → select `DriveXCanada/ParkNFly`.
2. **Add a database:** in the project, **New → Database → Add PostgreSQL**.
3. In the **app service → Variables**, add
   `DATABASE_URL = ${{ Postgres.DATABASE_URL }}` (references the DB service).
4. Railway auto-detects Node/Nixpacks and uses:
   - Build: `npm run build`
   - Start: `node server/index.js`
5. (Optional) leave `VITE_DEMO` unset for the clean system, or set it to
   `true` for a demo instance.
6. Deploy → Railway gives you a public URL. Tables are created automatically on
   first boot.

> Without `DATABASE_URL` the server still serves the app; it just runs
> local-only (no cross-device sync), so you can deploy first and attach the DB
> after.

## Tech

React (Vite) · React Router · Zustand · Tailwind · Recharts · jsPDF · Lucide ·
vite-plugin-pwa (installable + offline) · Express · Postgres (`pg`).

---

*Park N Fly · Powered by Drivex — Built to run. Priced to grow.*
