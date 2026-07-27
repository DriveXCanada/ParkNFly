import { useState } from 'react'
import { Building2, Plus, MapPin, Power } from 'lucide-react'
import { useManagerStore } from '../../../store/useManagerStore'
import { useToastStore } from '../../../store/useToastStore'
import { SectionHeader } from '../../../components/shared/SectionHeader'
import { Card } from '../../../components/shared/Card'
import { Badge } from '../../../components/shared/Badge'
import { Button } from '../../../components/shared/Button'
import { Modal } from '../../../components/shared/Modal'

const empty = { name: '', code: '', city: '', province: '' }

export default function Locations() {
  const locations = useManagerStore((s) => s.locations)
  const vehicles = useManagerStore((s) => s.vehicles)
  const drivers = useManagerStore((s) => s.drivers)
  const addLocation = useManagerStore((s) => s.addLocation)
  const toggleLocationActive = useManagerStore((s) => s.toggleLocationActive)
  const addToast = useToastStore((s) => s.addToast)

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const [err, setErr] = useState('')

  const submit = () => {
    if (!form.name.trim() || !form.code.trim() || !form.city.trim()) {
      setErr('Name, code, and city are required.')
      return
    }
    addLocation(form)
    addToast(`${form.name} added`, 'success')
    setOpen(false)
    setForm(empty)
    setErr('')
  }

  const inputCls = 'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-white outline-none focus:border-green'

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Locations"
        subtitle="Lot locations across the country"
        icon={Building2}
        action={<Button icon={Plus} onClick={() => setOpen(true)}>Add Location</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {locations.map((loc) => {
          const vCount = vehicles.filter((v) => v.locationId === loc.id).length
          const sCount = drivers.filter((d) => d.locationId === loc.id).length
          return (
            <Card key={loc.id} padded>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-light text-green-dark">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <div className="text-base font-extrabold text-white">{loc.city}</div>
                    <div className="text-xs font-semibold text-graytext">{loc.name}</div>
                  </div>
                </div>
                <Badge color={loc.active ? 'green' : 'gray'} dot>{loc.active ? 'Active' : 'Inactive'}</Badge>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
                <Stat label="Code" value={loc.code} />
                <Stat label="Vehicles" value={vCount} />
                <Stat label="Staff" value={sCount} />
              </div>

              <Button
                className="mt-3"
                size="sm"
                variant="secondary"
                fullWidth
                icon={Power}
                onClick={() => { toggleLocationActive(loc.id); addToast(`${loc.city} ${loc.active ? 'deactivated' : 'activated'}`, 'warning') }}
              >
                {loc.active ? 'Deactivate' : 'Activate'}
              </Button>
            </Card>
          )
        })}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add Location"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button icon={Plus} onClick={submit}>Add Location</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Location Name" full><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Park'N Fly Calgary" /></Field>
          <Field label="Airport Code"><input className={inputCls} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={4} placeholder="YYC" /></Field>
          <Field label="City"><input className={inputCls} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Calgary" /></Field>
          <Field label="Province"><input className={inputCls} value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value.toUpperCase() })} maxLength={2} placeholder="AB" /></Field>
        </div>
        {err && <p className="mt-3 text-sm font-semibold text-danger">{err}</p>}
      </Modal>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="tabular text-base font-black text-white">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-graytext">{label}</div>
    </div>
  )
}

function Field({ label, children, full }) {
  return (
    <label className={`block ${full ? 'col-span-2' : ''}`}>
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-graytext">{label}</span>
      {children}
    </label>
  )
}
