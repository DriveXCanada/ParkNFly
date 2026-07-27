/**
 * Park N Fly backend — serves the built SPA and a JSON API backed by Postgres.
 *
 * Data lives in Railway Postgres (via DATABASE_URL). The API is same-origin, so
 * the frontend calls `/api/...` with no secrets in the browser. If DATABASE_URL
 * is not set, the server still serves the app and the API reports
 * `configured: false`, so the frontend falls back to local-only mode (exactly
 * the pre-sync behavior) — this makes deploying without a DB a no-op change.
 *
 * Endpoints:
 *   GET    /api/health              → { ok, configured }
 *   GET    /api/bootstrap           → { configured, ...collections, config }
 *   POST   /api/:collection         → insert a record (body must include `id`)
 *   PATCH  /api/:collection/:id     → shallow-merge a partial into a record
 *   DELETE /api/:collection/:id     → delete a record
 *   PUT    /api/config/:key         → upsert a config value ({ value })
 */

import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { COLLECTIONS, DDL, isCollection } from './schema.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, '..', 'dist')
const PORT = process.env.PORT || 3000
const DATABASE_URL = process.env.DATABASE_URL

// SSL: Railway's in-project (private) Postgres URL does not use SSL; a public
// proxy URL does. Default off; set DATABASE_SSL=true when using a public URL.
const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false

const pool = DATABASE_URL ? new pg.Pool({ connectionString: DATABASE_URL, ssl }) : null
const configured = () => !!pool

const app = express()
app.use(express.json({ limit: '8mb' }))

// ---- API ------------------------------------------------------------------
const api = express.Router()

api.get('/health', (_req, res) => res.json({ ok: true, configured: configured() }))

api.get('/bootstrap', async (_req, res) => {
  if (!configured()) return res.json({ configured: false })
  try {
    const out = { configured: true }
    for (const t of COLLECTIONS) {
      const r = await pool.query(`SELECT data FROM ${t} ORDER BY updated_at ASC`)
      // Never ship account passwords to the browser — login goes via /api/login.
      out[t] =
        t === 'accounts'
          ? r.rows.map((row) => {
              const { password, ...safe } = row.data
              return safe
            })
          : r.rows.map((row) => row.data)
    }
    const c = await pool.query('SELECT key, value FROM config')
    out.config = Object.fromEntries(c.rows.map((row) => [row.key, row.value]))
    res.json(out)
  } catch (e) {
    console.error('bootstrap failed', e)
    res.status(500).json({ error: 'bootstrap_failed' })
  }
})

// Server-side credential check so passwords stay out of the client bundle.
// (Still plaintext-in-DB — real hashed auth is a documented follow-up.)
// Registered before /:collection so "login" isn't treated as a collection.
api.post('/login', async (req, res) => {
  if (!configured()) return res.status(503).json({ error: 'no_database' })
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'missing_credentials' })
  try {
    const r = await pool.query('SELECT data FROM accounts')
    const match = r.rows
      .map((x) => x.data)
      .find(
        (a) =>
          String(a.email || '').toLowerCase() === String(email).trim().toLowerCase() &&
          a.password === password,
      )
    if (!match) return res.status(401).json({ error: 'invalid_credentials' })
    const { password: _pw, ...safe } = match
    res.json({ account: safe })
  } catch (e) {
    console.error('login failed', e)
    res.status(500).json({ error: 'login_failed' })
  }
})

api.post('/:collection', async (req, res) => {
  const t = req.params.collection
  if (!configured()) return res.status(503).json({ error: 'no_database' })
  if (!isCollection(t)) return res.status(400).json({ error: 'unknown_collection' })
  const rec = req.body
  if (!rec || typeof rec.id !== 'string') return res.status(400).json({ error: 'id_required' })
  try {
    // Fixed-id seed records (e.g. bootstrap owner) must not clobber later edits,
    // so inserts are create-only. Updates go through PATCH.
    await pool.query(
      `INSERT INTO ${t} (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING`,
      [rec.id, JSON.stringify(rec)],
    )
    res.status(201).json(rec)
  } catch (e) {
    console.error('insert failed', t, e)
    res.status(500).json({ error: 'insert_failed' })
  }
})

api.patch('/:collection/:id', async (req, res) => {
  const t = req.params.collection
  if (!configured()) return res.status(503).json({ error: 'no_database' })
  if (!isCollection(t)) return res.status(400).json({ error: 'unknown_collection' })
  const patch = req.body || {}
  try {
    const r = await pool.query(
      `UPDATE ${t} SET data = data || $2::jsonb, updated_at = now() WHERE id = $1 RETURNING data`,
      [req.params.id, JSON.stringify(patch)],
    )
    if (!r.rows.length) return res.status(404).json({ error: 'not_found' })
    res.json(r.rows[0].data)
  } catch (e) {
    console.error('update failed', t, e)
    res.status(500).json({ error: 'update_failed' })
  }
})

api.delete('/:collection/:id', async (req, res) => {
  const t = req.params.collection
  if (!configured()) return res.status(503).json({ error: 'no_database' })
  if (!isCollection(t)) return res.status(400).json({ error: 'unknown_collection' })
  try {
    await pool.query(`DELETE FROM ${t} WHERE id = $1`, [req.params.id])
    res.status(204).end()
  } catch (e) {
    console.error('delete failed', t, e)
    res.status(500).json({ error: 'delete_failed' })
  }
})

api.put('/config/:key', async (req, res) => {
  if (!configured()) return res.status(503).json({ error: 'no_database' })
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
async function initDb() {
  if (!pool) {
    console.warn('DATABASE_URL not set — running in local-only mode (no sync).')
    return
  }
  for (const stmt of DDL) await pool.query(stmt)
  console.log('Postgres schema ready.')
}

initDb()
  .catch((e) => console.error('DB init failed (serving app anyway):', e))
  .finally(() => app.listen(PORT, () => console.log(`Park N Fly listening on ${PORT} (db=${configured()})`)))
