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

// Fields a client is allowed to write per collection. Anything else in a
// request body is dropped, so a caller can't inject e.g. an unexpected field.
export const WRITABLE = {
  locations: ['id', 'name', 'code', 'city', 'province', 'active'],
  accounts: ['id', 'name', 'email', 'password', 'role', 'locationId'],
  drivers: ['id', 'name', 'initials', 'employeeId', 'status', 'locationId', 'notes'],
  vehicles: [
    'id', 'busNum', 'make', 'model', 'year', 'capacity', 'odometer', 'status',
    'lastInspection', 'inspectionResult', 'nextServiceDue', 'maintenanceNotes',
    'locationId', 'downReason',
  ],
  shifts: [
    'id', 'driverId', 'vehicleId', 'locationId', 'date', 'startTime', 'endTime',
    'odoStart', 'odoEnd', 'fuelLitres', 'status', 'inspectionStatus',
    'inspectionComplete', 'breakMinutes', 'activeMinutes', 'breaks', 'trips',
  ],
  inspections: [
    'id', 'shiftId', 'driverId', 'vehicleId', 'locationId', 'date', 'time',
    'results', 'fuelLevel', 'notes', 'signature', 'overallResult', 'complete', 'photos',
  ],
  incidents: [
    'id', 'date', 'time', 'driverId', 'vehicleId', 'locationId', 'type', 'severity',
    'description', 'status', 'reportedBy', 'managerNotes', 'createdAt',
  ],
}

/**
 * Keep only writable fields for a collection. For accounts, `role` and
 * `password` are never accepted through generic collection routes (a manager
 * could otherwise PATCH themselves to owner) — they're handled by dedicated,
 * owner-guarded endpoints instead.
 */
export function sanitizeWrite(collection, body, { allowSensitive = false } = {}) {
  const allow = WRITABLE[collection] || []
  const out = {}
  for (const k of allow) {
    if (body[k] === undefined) continue
    if (collection === 'accounts' && !allowSensitive && (k === 'role' || k === 'password')) continue
    out[k] = body[k]
  }
  return out
}
