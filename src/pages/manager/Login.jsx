import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { LogIn, AlertTriangle, ShieldCheck, Tablet } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import { Logo } from '../../components/shared/Logo'
import { Button } from '../../components/shared/Button'
import { DEMO_CREDENTIALS } from '../../data/mockAccounts'
import { DEMO, BOOTSTRAP_OWNER } from '../../config'

// In demo mode show the sample logins; in the clean build show only the
// first-run bootstrap owner credential.
const CREDS = DEMO
  ? DEMO_CREDENTIALS
  : [{ label: 'Owner (first login)', email: BOOTSTRAP_OWNER.email, password: BOOTSTRAP_OWNER.password }]

export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const res = login(email, password)
    if (!res.ok) {
      setError(res.error)
      return
    }
    navigate('/manager')
  }

  const quickFill = (c) => {
    setEmail(c.email)
    setPassword(c.password)
    setError('')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo size={44} dark />
        </div>

        <form onSubmit={submit} className="rounded-2xl bg-surface p-6 shadow-card-hover">
          <h1 className="text-xl font-black tracking-tight text-white">Manager Sign In</h1>
          <p className="mt-1 text-sm text-graytext">Sign in to access the operations dashboard.</p>

          <div className="mt-5 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-graytext">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                placeholder="you@parknfly.ca"
                className="h-11 w-full rounded-xl border border-line bg-surface px-4 font-semibold text-white outline-none focus:border-green"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-graytext">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                placeholder="••••••••"
                className="h-11 w-full rounded-xl border border-line bg-surface px-4 font-semibold text-white outline-none focus:border-green"
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <Button type="submit" size="lg" fullWidth icon={LogIn} className="mt-5">
            Sign In
          </Button>

          {/* Credentials helper (simulated auth) */}
          <div className="mt-5 rounded-xl bg-white/5 p-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-graytext">
              <ShieldCheck size={13} /> {DEMO ? 'Demo credentials' : 'First-time login'}
            </div>
            <div className="mt-2 space-y-1.5">
              {CREDS.map((c) => (
                <button
                  key={c.email}
                  type="button"
                  onClick={() => quickFill(c)}
                  className="flex w-full items-center justify-between rounded-lg bg-surface px-3 py-2 text-left text-xs hover:bg-brand/15"
                >
                  <span className="font-bold text-white">{c.label}</span>
                  <span className="tabular text-graytext">{c.email} · {c.password}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-graytext">
              {DEMO
                ? 'Simulated login for the prototype — not secure. Real authentication arrives with the backend.'
                : 'Simulated login — change the bootstrap owner credentials in src/config.js before launch. Real auth arrives with the backend.'}
            </p>
          </div>
        </form>

        <div className="mt-4 text-center">
          <Link to="/driver" className="inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-white">
            <Tablet size={15} /> Switch to Driver View
          </Link>
        </div>
        <p className="mt-4 text-center text-[11px] text-muted">Powered by Drivex</p>
      </div>
    </div>
  )
}
