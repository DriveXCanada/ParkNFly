/**
 * App configuration.
 *
 * DEMO mode seeds the whole system with sample data (drivers, vehicles, 14
 * days of shifts, inspections, incidents) for demonstrations. When DEMO is
 * false (the default), the system starts BLANK and production-ready: no
 * sample data, just a bootstrap owner account and the inspection checklist.
 *
 * Toggle with the VITE_DEMO environment variable at build time:
 *   VITE_DEMO=true  → sample/demo data (client showcase)
 *   (unset / false) → clean, empty system (real deployment)
 */
export const DEMO = import.meta.env.VITE_DEMO === 'true'

/**
 * Bootstrap owner account used for the first login on a fresh (blank) system.
 * CHANGE THIS before a real launch (and replace simulated auth with a real
 * provider when the backend is wired up).
 */
export const BOOTSTRAP_OWNER = {
  id: 'ACC-OWNER',
  name: 'Owner',
  email: 'owner@parknfly.ca',
  role: 'owner',
  locationId: null,
  password: 'changeme',
}
