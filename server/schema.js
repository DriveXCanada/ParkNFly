/**
 * Postgres schema for the Park N Fly backend.
 *
 * Storage model: a document store. Each collection is one table shaped
 * `(id text primary key, data jsonb, updated_at timestamptz)`. The whole app
 * record round-trips as JSON in `data`, so the frontend keeps its existing
 * object shapes unchanged and we never have to migrate columns when a shape
 * evolves. Location scoping / filtering already happens client-side.
 *
 * `trips` is intentionally NOT a table — it is derived from Shifts on the
 * client (flattenTrips), so persisting it would just duplicate state.
 *
 * These collection names match the useManagerStore state keys exactly, so the
 * frontend can call `POST /api/<collection>` with the same key it uses locally.
 */

export const COLLECTIONS = [
  'locations',
  'accounts',
  'drivers',
  'vehicles',
  'shifts',
  'inspections',
  'incidents',
]

// Idempotent DDL run on every boot — safe to run repeatedly.
export const DDL = [
  ...COLLECTIONS.map(
    (t) => `CREATE TABLE IF NOT EXISTS ${t} (
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );`,
  ),
  `CREATE TABLE IF NOT EXISTS config (
     key text PRIMARY KEY,
     value jsonb,
     updated_at timestamptz NOT NULL DEFAULT now()
   );`,
]

export const isCollection = (t) => COLLECTIONS.includes(t)
