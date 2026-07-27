import { useState } from 'react'
import { KeyRound, Check } from 'lucide-react'
import { changePasswordRequest } from '../../api/client'
import { useManagerStore } from '../../store/useManagerStore'
import { useToastStore } from '../../store/useToastStore'
import { Card } from '../shared/Card'
import { Button } from '../shared/Button'

const inputCls =
  'h-11 w-full rounded-xl border border-line bg-surface px-4 font-semibold text-white outline-none focus:border-brand'

/**
 * Change the signed-in account's own password. Requires the cloud backend
 * (passwords are verified and hashed server-side).
 */
export default function ChangePassword() {
  const synced = useManagerStore((s) => s.synced)
  const addToast = useToastStore((s) => s.addToast)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (next.length < 8) return setError('New password must be at least 8 characters.')
    if (next !== confirm) return setError('New password and confirmation do not match.')
    setBusy(true)
    try {
      await changePasswordRequest(current, next)
      setCurrent(''); setNext(''); setConfirm('')
      addToast('Password changed.', 'success')
    } catch (err) {
      if (err.status === 401) setError('Your current password is incorrect.')
      else if (err.status === 400) setError('New password must be at least 8 characters.')
      else if (err.status === 0) setError("Can't reach the server. Check your connection.")
      else setError('Could not change the password. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card padded className="space-y-3">
      <h2 className="flex items-center gap-2 text-base font-extrabold text-white">
        <KeyRound size={18} className="text-brand" /> Change Password
      </h2>
      {!synced ? (
        <p className="text-sm text-graytext">
          Password changes require the cloud backend. Connect the database to enable this.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="cp-current" className="mb-1 block text-xs font-bold uppercase tracking-wide text-graytext">Current password</label>
            <input id="cp-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="cp-new" className="mb-1 block text-xs font-bold uppercase tracking-wide text-graytext">New password</label>
              <input id="cp-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="cp-confirm" className="mb-1 block text-xs font-bold uppercase tracking-wide text-graytext">Confirm new</label>
              <input id="cp-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
            </div>
          </div>
          {error && <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{error}</div>}
          <Button type="submit" icon={Check} disabled={busy}>{busy ? 'Saving…' : 'Update Password'}</Button>
        </form>
      )}
    </Card>
  )
}
