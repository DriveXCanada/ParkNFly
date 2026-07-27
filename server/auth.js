/**
 * Authentication & authorization helpers.
 *
 * Sessions are stateless JWTs delivered as httpOnly cookies (not readable by
 * page JS, so XSS can't lift them). Passwords are bcrypt-hashed. Legacy
 * plaintext passwords (from the pre-hardening seed) are transparently accepted
 * once and upgraded on next successful login.
 */

import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export const COOKIE_NAME = 'pnf_session'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// A stable secret is required for sessions to survive restarts / multiple
// instances. If unset we generate an ephemeral one and warn — logins still
// work but won't persist across a redeploy until JWT_SECRET is set.
let SECRET = process.env.JWT_SECRET
if (!SECRET) {
  SECRET = crypto.randomBytes(48).toString('hex')
  console.warn('JWT_SECRET not set — using an ephemeral secret. Set JWT_SECRET in the environment for stable sessions.')
}

export const hashPassword = (plain) => bcrypt.hash(String(plain), 10)

// Returns { ok, needsUpgrade }. needsUpgrade=true means the stored value was
// legacy plaintext and matched — caller should re-store a hash.
export async function verifyPassword(plain, stored) {
  if (typeof stored !== 'string' || !stored) return { ok: false, needsUpgrade: false }
  if (stored.startsWith('$2')) {
    return { ok: await bcrypt.compare(String(plain), stored), needsUpgrade: false }
  }
  // Legacy plaintext.
  return { ok: String(plain) === stored, needsUpgrade: true }
}

export const isHashed = (v) => typeof v === 'string' && v.startsWith('$2')

export const signSession = (payload) => jwt.sign(payload, SECRET, { expiresIn: '30d' })

export function setSessionCookie(req, res, payload) {
  const token = signSession(payload)
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure, // true behind Railway's HTTPS proxy (trust proxy on); false on local http
    maxAge: MAX_AGE_MS,
    path: '/',
  })
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' })
}

// Middleware: require a valid session on the request.
export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) return res.status(401).json({ error: 'auth_required' })
  try {
    req.user = jwt.verify(token, SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'invalid_session' })
  }
}

// Middleware factory: require the session role to be one of `roles`.
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'forbidden' })
  }
  next()
}
