/**
 * Park N Fly backend — serves the built SPA and a session-authenticated JSON
 * API backed by Postgres.
 *
 * Security model:
 *   - Every /api route except /health, /login and /kiosk-login requires a valid
 *     session cookie (httpOnly JWT). No anonymous data access.
 *   - Passwords are bcrypt-hashed; the bootstrap owner is seeded server-side and
 *     legacy plaintext is upgraded on boot / first login.
 *   - Sensitive writes (accounts, locations create/delete, system reset,
 *     password resets) require the owner role. Request bodies are field-
 *     whitelisted so clients can't inject role/password escalations.
 *   - The driver tablet authenticates as a scoped "kiosk" via an access code.
 *
 * If DATABASE_URL is unset the server still serves the app; the API reports
 * configured:false and the frontend runs local-only.
 */

import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { COLLECTIONS, DDL, isCollection, sanitizeWrite } from './schema.js'
import {
  hashPassword, verifyPassword, isHashed,
  setSessionCookie, clearSessionCookie, requireAuth, requireRole,
} from './auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, '..', 'dist')
const PORT = process.env.PORT || 3000
const DATABASE_URL = process.env.DATABASE_URL
const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false

const pool = DATABASE_URL ? new pg.Pool({ connectionString: DATABASE_URL, ssl }) : null
const configured = () => !!pool

// Bootstrap owner — seeded server-side with a hashed password. Override via env.
const BOOTSTRAP = {
  id: 'ACC-OWNER',
  name: process.env.BOOTSTRAP_OWNER_NAME || 'DriveX',
  email: process.env.BOOTSTRAP_OWNER_EMAIL || 'Info@drivexcanada.com',
  role: 'owner',
  locationId: null,
  password: process.env.BOOTSTRAP_OWNER_PASSWORD || 'Test2026!',
}
// Access code the driver tablet enters to unlock the kiosk session.
const KIOSK_CODE = process.env.KIOSK_ACCESS_CODE || 'parknfly'

const app = express()
app.set('trust proxy', 1) // Railway terminates TLS at a proxy; needed for secure cookies + rate-limit IPs.

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // Tailwind + libraries (e.g. Recharts) inject inline styles; Google Fonts stylesheet.
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'], // inspection/incident photos are data URLs
        connectSrc: ["'self'"],
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false, // avoid blocking cross-origin font/image loads
  }),
)
app.use(express.json({ limit: '8mb' }))
app.use(cookieParser())

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'too_many_attempts' } })
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false })

const api = express.Router()

// Helper: strip password before returning account rows.
const safeAccount = (data) => {
  const { password, ...rest } = data
  return rest
}

// ---- Public routes --------------------------------------------------------
api.get('/health', (_req, res) => res.json({ ok: true, configured: configured() }))

api.post('/login', loginLimiter, async (req, res) => {
  if (!configured()) return res.status(503).json({ error: 'no_database' })
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'missing_credentials' })
  try {
    const r = await pool.query('SELECT data FROM accounts')
    const acct = r.rows
      .map((x) => x.data)
      .find((a) => String(a.email || '').toLowerCase() === String(email).trim().toLowerCase())
    if (!acct) return res.status(401).json({ error: 'invalid_credentials' })
    const { ok, needsUpgrade } = await verifyPassword(password, acct.password)
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' })
    if (needsUpgrade) {
      const h = await hashPassword(password)
      await pool.query('UPDATE accounts SET data = data || $2::jsonb WHERE id = $1', [acct.id, JSON.stringify({ password: h })])
    }
    const profile = { id: acct.id, name: acct.name, email: acct.email, role: acct.role, locationId: acct.locationId ?? null }
    setSessionCookie(req, res, profile)
    res.json({ account: profile })
  } catch (e) {
    console.error('login failed', e)
    res.status(500).json({ error: 'login_failed' })
  }
})

api.post('/kiosk-login', loginLimiter, (req, res) => {
  const { code, locationId } = req.body || {}
  if (String(code || '') !== String(KIOSK_CODE)) return res.status(401).json({ error: 'invalid_code' })
  const profile = { id: 'KIOSK', name: 'Driver Tablet', role: 'kiosk', locationId: locationId ?? null }
  setSessionCookie(req, res, profile)
  res.json({ account: profile })
})

api.post('/logout', (_req, res) => {
  clearSessionCookie(res)
  res.status(204).end()
})

api.get('/me', requireAuth, (req, res) => {
  const { id, name, email, role, locationId } = req.user
  res.json({ account: { id, name, email: email || null, role, locationId: locationId ?? null } })
})

// ---- Everything below requires a valid session ----------------------------
api.use(requireAuth)

api.get('/bootstrap', async (_req, res) => {
  if (!configured()) return res.json({ configured: false })
  try {
    const out = { configured: true }
    for (const t of COLLECTIONS) {
      const r = await pool.query(`SELECT data FROM ${t} ORDER BY updated_at ASC`)
      out[t] = t === 'accounts' ? r.rows.map((row) => safeAccount(row.data)) : r.rows.map((row) => row.data)
    }
    const c = await pool.query('SELECT key, value FROM config')
    out.config = Object.fromEntries(c.rows.map((row) => [row.key, row.value]))
    res.json(out)
  } catch (e) {
    console.error('bootstrap failed', e)
    res.status(500).json({ error: 'bootstrap_failed' })
  }
})

// Change own password (not available to the kiosk session).
api.post('/change-password', async (req, res) => {
  if (req.user.role === 'kiosk') return res.status(403).json({ error: 'forbidden' })
  const { currentPassword, newPassword } = req.body || {}
  if (!newPassword || String(newPassword).length < 8) return res.status(400).json({ error: 'weak_password' })
  try {
    const r = await pool.query('SELECT data FROM accounts WHERE id = $1', [req.user.id])
    if (!r.rows.length) return res.status(404).json({ error: 'not_found' })
    const { ok } = await verifyPassword(currentPassword, r.rows[0].data.password)
    if (!ok) return res.status(401).json({ error: 'wrong_password' })
    const h = await hashPassword(newPassword)
    await pool.query('UPDATE accounts SET data = data || $2::jsonb WHERE id = $1', [req.user.id, JSON.stringify({ password: h })])
    res.json({ ok: true })
  } catch (e) {
    console.error('change-password failed', e)
    res.status(500).json({ error: 'change_failed' })
  }
})

// Owner resets any account's password.
api.post('/accounts/:id/reset-password', requireRole('owner'), async (req, res) => {
  const { newPassword } = req.body || {}
  if (!newPassword || String(newPassword).length < 8) return res.status(400).json({ error: 'weak_password' })
  try {
    const h = await hashPassword(newPassword)
    const r = await pool.query('UPDATE accounts SET data = data || $2::jsonb WHERE id = $1 RETURNING data', [req.params.id, JSON.stringify({ password: h })])
    if (!r.rows.length) return res.status(404).json({ error: 'not_found' })
    res.json({ ok: true })
  } catch (e) {
    console.error('reset-password failed', e)
    res.status(500).json({ error: 'reset_failed' })
  }
})

// Atomic shift commit — shift + inspection + vehicle update + incidents in one
// transaction, so a partial failure can't leave a critically-failed bus "active".
api.post('/commit-shift', writeLimiter, async (req, res) => {
  const { shift, inspection, incidents = [], vehicleId, vehiclePatch } = req.body || {}
  if (!shift || typeof shift.id !== 'string') return res.status(400).json({ error: 'shift_required' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('INSERT INTO shifts (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING', [shift.id, JSON.stringify(sanitizeWrite('shifts', shift))])
    if (inspection && typeof inspection.id === 'string') {
      await client.query('INSERT INTO inspections (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING', [inspection.id, JSON.stringify(sanitizeWrite('inspections', inspection))])
    }
    if (vehicleId && vehiclePatch) {
      await client.query('UPDATE vehicles SET data = data || $2::jsonb, updated_at = now() WHERE id = $1', [vehicleId, JSON.stringify(sanitizeWrite('vehicles', vehiclePatch))])
    }
    for (const inc of incidents) {
      if (inc && typeof inc.id === 'string') {
        await client.query('INSERT INTO incidents (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING', [inc.id, JSON.stringify(sanitizeWrite('incidents', inc))])
      }
    }
    await client.query('COMMIT')
    res.json({ ok: true })
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('commit-shift failed', e)
    res.status(500).json({ error: 'commit_failed' })
  } finally {
    client.release()
  }
})

// Owner: clear operational data (keeps accounts + config so login survives).
api.post('/reset-system', requireRole('owner'), async (_req, res) => {
  try {
    for (const t of ['locations', 'drivers', 'vehicles', 'shifts', 'inspections', 'incidents']) {
      await pool.query(`DELETE FROM ${t}`)
    }
    res.json({ ok: true })
  } catch (e) {
    console.error('reset-system failed', e)
    res.status(500).json({ error: 'reset_failed' })
  }
})

// ---- Generic collection CRUD (authorized per role) ------------------------
const kioskAllowed = new Set(['shifts', 'inspections', 'incidents'])

api.post('/:collection', writeLimiter, async (req, res) => {
  const t = req.params.collection
  if (!isCollection(t)) return res.status(400).json({ error: 'unknown_collection' })
  const role = req.user.role
  if ((t === 'accounts' || t === 'locations') && role !== 'owner') return res.status(403).json({ error: 'forbidden' })
  if (role === 'kiosk' && !kioskAllowed.has(t)) return res.status(403).json({ error: 'forbidden' })

  const rec = sanitizeWrite(t, req.body || {}, { allowSensitive: t === 'accounts' && role === 'owner' })
  if (typeof rec.id !== 'string') return res.status(400).json({ error: 'id_required' })

  try {
    if (t === 'accounts') {
      if (rec.role && rec.role !== 'manager') rec.role = 'manager' // never create owner via API
      if (rec.email) {
        const dup = await pool.query("SELECT 1 FROM accounts WHERE lower(data->>'email') = lower($1) LIMIT 1", [rec.email])
        if (dup.rows.length) return res.status(409).json({ error: 'email_taken' })
      }
      if (rec.password) rec.password = await hashPassword(rec.password)
    }
    if (t === 'locations' && rec.code) {
      const dup = await pool.query("SELECT 1 FROM locations WHERE upper(data->>'code') = upper($1) LIMIT 1", [rec.code])
      if (dup.rows.length) return res.status(409).json({ error: 'code_taken' })
    }
    await pool.query(`INSERT INTO ${t} (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING`, [rec.id, JSON.stringify(rec)])
    res.status(201).json(t === 'accounts' ? safeAccount(rec) : rec)
  } catch (e) {
    console.error('insert failed', t, e)
    res.status(500).json({ error: 'insert_failed' })
  }
})

api.patch('/:collection/:id', writeLimiter, async (req, res) => {
  const t = req.params.collection
  if (!isCollection(t)) return res.status(400).json({ error: 'unknown_collection' })
  const role = req.user.role
  if (t === 'accounts' && role !== 'owner') return res.status(403).json({ error: 'forbidden' })
  if (t === 'locations' && !['owner', 'manager'].includes(role)) return res.status(403).json({ error: 'forbidden' })
  if (role === 'kiosk' && !kioskAllowed.has(t)) return res.status(403).json({ error: 'forbidden' })

  // Generic PATCH never accepts password/role on accounts (dedicated endpoints only).
  const patch = sanitizeWrite(t, req.body || {}, { allowSensitive: false })
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'empty_patch' })
  try {
    const r = await pool.query(`UPDATE ${t} SET data = data || $2::jsonb, updated_at = now() WHERE id = $1 RETURNING data`, [req.params.id, JSON.stringify(patch)])
    if (!r.rows.length) return res.status(404).json({ error: 'not_found' })
    res.json(t === 'accounts' ? safeAccount(r.rows[0].data) : r.rows[0].data)
  } catch (e) {
    console.error('update failed', t, e)
    res.status(500).json({ error: 'update_failed' })
  }
})

api.delete('/:collection/:id', writeLimiter, async (req, res) => {
  const t = req.params.collection
  if (!isCollection(t)) return res.status(400).json({ error: 'unknown_collection' })
  const role = req.user.role
  if (role === 'kiosk') return res.status(403).json({ error: 'forbidden' })
  if ((t === 'accounts' || t === 'locations') && role !== 'owner') return res.status(403).json({ error: 'forbidden' })
  try {
    await pool.query(`DELETE FROM ${t} WHERE id = $1`, [req.params.id])
    res.status(204).end()
  } catch (e) {
    console.error('delete failed', t, e)
    res.status(500).json({ error: 'delete_failed' })
  }
})

api.put('/config/:key', writeLimiter, async (req, res) => {
  if (req.user.role === 'kiosk') return res.status(403).json({ error: 'forbidden' })
  const value = req.body?.value
  try {
    await pool.query(
      `INSERT INTO config (key, value) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [req.params.key, JSON.stringify(value ?? null)],
    )
    res.json({ key: req.params.key, value })
  } catch (e) {
    console.error('config upsert failed', e)
    res.status(500).json({ error: 'config_failed' })
  }
})

app.use('/api', api)

// ---- Static SPA + client-side routing fallback ----------------------------
app.use(express.static(DIST))
app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')))

// ---- Boot -----------------------------------------------------------------
async function seedOwner() {
  const r = await pool.query('SELECT data FROM accounts WHERE id = $1', [BOOTSTRAP.id])
  if (!r.rows.length) {
    const password = await hashPassword(BOOTSTRAP.password)
    await pool.query('INSERT INTO accounts (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING', [BOOTSTRAP.id, JSON.stringify({ ...BOOTSTRAP, password })])
    console.log('Seeded bootstrap owner (hashed).')
  } else if (!isHashed(r.rows[0].data.password)) {
    const password = await hashPassword(r.rows[0].data.password || BOOTSTRAP.password)
    await pool.query('UPDATE accounts SET data = data || $2::jsonb WHERE id = $1', [BOOTSTRAP.id, JSON.stringify({ password })])
    console.log('Upgraded bootstrap owner password to a hash.')
  }
}

async function initDb() {
  if (!pool) {
    console.warn('DATABASE_URL not set — running in local-only mode (no sync).')
    return
  }
  for (const stmt of DDL) await pool.query(stmt)
  await seedOwner()
  console.log('Postgres schema ready.')
}

// Bind immediately so the platform healthcheck passes right away, then
// initialize the database in the background (schema + owner seed). A request
// that lands before init finishes simply retries on the client.
app.listen(PORT, () => console.log(`Park N Fly listening on ${PORT} (db=${configured()})`))
initDb().catch((e) => console.error('DB init failed (serving app anyway):', e))
