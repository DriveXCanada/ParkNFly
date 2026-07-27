import { useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, ShieldCheck, LogIn } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import { Logo } from '../../components/shared/Logo'
import { Button } from '../../components/shared/Button'

/**
 * One-time unlock for a shared driver tablet. The tablet enters the location
 * access code to establish a scoped kiosk session; after that the driver app
 * works normally until the session is cleared.
 */
export default function KioskUnlock() {
  const loginKiosk = useAuthStore((s) => s.loginKiosk)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!code.trim()) return setError('Enter the access code for this location.')
    setBusy(true)
    setError('')
    const res = await loginKiosk(code.trim(), null)
    setBusy(false)
    if (!res.ok) setError(res.error)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo size={44} dark />
        </div>
        <form onSubmit={submit} className="rounded-2xl bg-surface p-6 shadow-card-hover">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <KeyRound size={16} className="text-brand" /> Unlock Driver Tablet
          </div>
          <p className="mt-1 text-sm text-graytext">
            Enter the access code for this location to start using the driver app on this device.
          </p>

          <label htmlFor="kiosk-code" className="mt-5 mb-1 block text-xs font-bold uppercase tracking-wide text-graytext">
            Access code
          </label>
          <input
            id="kiosk-code"
            type="password"
            inputMode="text"
            autoComplete="off"
            value={code}
            onChange={(e) => { setCode(e.target.value); setError('') }}
            placeholder="••••••••"
            className="h-11 w-full rounded-xl border border-line bg-surface px-4 font-semibold text-white outline-none focus:border-brand"
          />

          {error && (
            <div className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{error}</div>
          )}

          <Button type="submit" size="lg" fullWidth icon={LogIn} className="mt-5" disabled={busy}>
            {busy ? 'Unlocking…' : 'Unlock'}
          </Button>

          <div className="mt-4 flex items-center gap-1.5 text-[11px] leading-snug text-graytext">
            <ShieldCheck size={13} className="shrink-0" />
            <span>The code is set by your manager. Ask them if you don't have it.</span>
          </div>
        </form>

        <div className="mt-4 text-center">
          <Link to="/manager/login" className="text-sm font-bold text-muted hover:text-white">
            Manager sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
