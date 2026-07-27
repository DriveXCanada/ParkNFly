import { useState } from 'react'
import { UserCog, Plus, Trash2, Mail, MapPin } from 'lucide-react'
import { useManagerStore } from '../../../store/useManagerStore'
import { useToastStore } from '../../../store/useToastStore'
import { SectionHeader } from '../../../components/shared/SectionHeader'
import { DataTable } from '../../../components/shared/DataTable'
import { Badge } from '../../../components/shared/Badge'
import { Button } from '../../../components/shared/Button'
import { Modal } from '../../../components/shared/Modal'

const empty = { name: '', email: '', password: '', locationId: '' }

export default function Managers() {
  const accounts = useManagerStore((s) => s.accounts)
  const locations = useManagerStore((s) => s.locations)
  const addManager = useManagerStore((s) => s.addManager)
  const removeManager = useManagerStore((s) => s.removeManager)
  const addToast = useToastStore((s) => s.addToast)

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ ...empty, locationId: locations[0]?.id || '' })
  const [err, setErr] = useState('')

  const managers = accounts.filter((a) => a.role === 'manager')
  const locLabel = (id) => {
    const l = locations.find((x) => x.id === id)
    return l ? `${l.city} · ${l.code}` : '—'
  }

  const submit = () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim() || !form.locationId) {
      setErr('All fields are required.')
      return
    }
    if (accounts.some((a) => a.email.toLowerCase() === form.email.trim().toLowerCase())) {
      setErr('An account with that email already exists.')
      return
    }
    addManager({ name: form.name.trim(), email: form.email.trim(), password: form.password, locationId: form.locationId })
    addToast(`Manager ${form.name.trim()} added`, 'success')
    setOpen(false)
    setForm({ ...empty, locationId: locations[0]?.id || '' })
    setErr('')
  }

  const inputCls = 'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-white outline-none focus:border-green'

  const columns = [
    { key: 'name', header: 'Name', render: (a) => <span className="font-extrabold text-white">{a.name}</span> },
    { key: 'email', header: 'Email', render: (a) => <span className="flex items-center gap-1.5 text-graytext"><Mail size={13} /> {a.email}</span> },
    { key: 'location', header: 'Location', render: (a) => <Badge color="green"><MapPin size={11} className="mr-0.5 inline" />{locLabel(a.locationId)}</Badge> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (a) => (
        <button
          onClick={() => { removeManager(a.id); addToast(`${a.name} removed`, 'warning') }}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-danger hover:bg-danger/10"
        >
          <Trash2 size={14} /> Remove
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Managers"
        subtitle="Manager accounts and their assigned locations"
        icon={UserCog}
        action={<Button icon={Plus} onClick={() => setOpen(true)}>Add Manager</Button>}
      />

      <DataTable
        columns={columns}
        data={managers}
        rowKey={(a) => a.id}
        emptyTitle="No managers yet"
        emptyMessage="Add a manager and assign them to a location."
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add Manager"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button icon={Plus} onClick={submit}>Add Manager</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Full Name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jordan Smith" /></Field>
          <Field label="Email (login)"><input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jordan@parknfly.ca" /></Field>
          <Field label="Password"><input className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Set a password" /></Field>
          <Field label="Assigned Location">
            <select className={inputCls} value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
              <option value="">Select location…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.city} · {l.code}</option>
              ))}
            </select>
          </Field>
          {err && <p className="text-sm font-semibold text-danger">{err}</p>}
          <p className="rounded-lg bg-amber/10 px-3 py-2 text-xs font-semibold text-amber">
            Simulated auth — the password is stored in the browser for the prototype and is not secure.
          </p>
        </div>
      </Modal>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-graytext">{label}</span>
      {children}
    </label>
  )
}
