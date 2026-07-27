import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Gauge, Calendar, User, Bus, AlertTriangle, CheckCircle2, MapPin } from 'lucide-react'
import { useShiftStore } from '../../store/useShiftStore'
import { useManagerStore } from '../../store/useManagerStore'
import { useToastStore } from '../../store/useToastStore'
import { Button } from '../../components/shared/Button'
import { Card } from '../../components/shared/Card'
import { formatDate, hoursSince, todayKey } from '../../utils/formatters'
import { DEMO } from '../../config'

export default function DriverApp() {
  const navigate = useNavigate()
  const startShift = useShiftStore((s) => s.startShift)
  const shiftStarted = useShiftStore((s) => s.shiftStarted)
  const addToast = useToastStore((s) => s.addToast)

  const locations = useManagerStore((s) => s.locations)
  const allDrivers = useManagerStore((s) => s.drivers)
  const allVehicles = useManagerStore((s) => s.vehicles)
  // In the demo build the dashboard is anchored to a frozen date, so stamp
  // live shifts with it too, otherwise they wouldn't show as "today".
  const referenceToday = useManagerStore((s) => s.referenceToday)

  const activeLocations = locations.filter((l) => l.active)
  const [locationId, setLocationId] = useState(activeLocations[0]?.id || '')
  const [driverId, setDriverId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [odoStart, setOdoStart] = useState('')
  const [errors, setErrors] = useState({})

  const today = new Date()

  const drivers = useMemo(
    () => allDrivers.filter((d) => d.locationId === locationId && d.status === 'active'),
    [allDrivers, locationId],
  )
  const vehicles = useMemo(
    () => allVehicles.filter((v) => v.locationId === locationId),
    [allVehicles, locationId],
  )

  const selectedVehicle = useMemo(() => vehicles.find((v) => v.id === vehicleId), [vehicles, vehicleId])

  const inspectionWarning = useMemo(() => {
    if (!selectedVehicle) return null
    if (!selectedVehicle.lastInspection) return { never: true }
    const hrs = hoursSince(`${selectedVehicle.lastInspection}T08:00:00`)
    return {
      stale: hrs > 24,
      date: selectedVehicle.lastInspection,
      failed: selectedVehicle.inspectionResult === 'fail',
    }
  }, [selectedVehicle])

  const onLocationChange = (id) => {
    setLocationId(id)
    setDriverId('')
    setVehicleId('')
    setOdoStart('')
  }

  const onVehicleChange = (id) => {
    setVehicleId(id)
    const v = vehicles.find((x) => x.id === id)
    if (v) setOdoStart(String(v.odometer))
  }

  const validate = () => {
    const e = {}
    if (!locationId) e.locationId = 'Select a location'
    if (!driverId) e.driverId = 'Please select your name'
    if (!vehicleId) e.vehicleId = 'Please select a vehicle'
    if (!odoStart || isNaN(Number(odoStart))) e.odoStart = 'Enter a valid odometer reading'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleStart = () => {
    if (!validate()) return
    startShift({ driverId, vehicleId, locationId, shiftDate: DEMO ? referenceToday : todayKey(), odoStart: Number(odoStart) })
    addToast('Shift started — drive safe!', 'success')
    navigate('/driver/inspection')
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-black tracking-tight text-white">Start Your Shift</h1>
        <p className="mt-1 text-sm text-graytext">
          {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {shiftStarted && (
        <Card className="mb-5 border-green/30 bg-green-light">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-green" size={22} />
            <div className="flex-1 text-sm font-semibold text-green-dark">
              You already have an active shift in progress.
            </div>
            <Button size="sm" onClick={() => navigate('/driver/log')}>Resume</Button>
          </div>
        </Card>
      )}

      <Card className="space-y-5">
        {/* Location */}
        <Field label="Location" icon={MapPin} error={errors.locationId}>
          <select value={locationId} onChange={(e) => onLocationChange(e.target.value)} className={inputCls(errors.locationId)}>
            <option value="">Select location…</option>
            {activeLocations.map((l) => (
              <option key={l.id} value={l.id}>{l.city} · {l.code}</option>
            ))}
          </select>
        </Field>

        {/* Driver */}
        <Field label="Driver" icon={User} error={errors.driverId}>
          <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className={inputCls(errors.driverId)} disabled={!locationId}>
            <option value="">{locationId ? 'Select your name…' : 'Select a location first'}</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.name} · {d.employeeId}</option>
            ))}
          </select>
          {locationId && drivers.length === 0 && (
            <p className="mt-1 text-xs font-semibold text-amber">No active staff at this location yet — a manager can add staff in the dashboard.</p>
          )}
        </Field>

        {/* Vehicle */}
        <Field label="Vehicle / Bus" icon={Bus} error={errors.vehicleId}>
          <select value={vehicleId} onChange={(e) => onVehicleChange(e.target.value)} className={inputCls(errors.vehicleId)} disabled={!locationId}>
            <option value="">{locationId ? 'Select a vehicle…' : 'Select a location first'}</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id} disabled={v.status === 'out-of-service'}>
                {v.busNum} — {v.make} {v.model} ({v.year})
                {v.status === 'out-of-service' ? ' ⛔ out of service' : v.status === 'flagged' ? ' ⚠ flagged' : ''}
              </option>
            ))}
          </select>
        </Field>

        {/* Inspection status */}
        {selectedVehicle && inspectionWarning && (
          <div className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm ${
            inspectionWarning.failed || inspectionWarning.stale || inspectionWarning.never
              ? 'bg-amber/10 text-amber'
              : 'bg-green-light text-green-dark'
          }`}>
            {inspectionWarning.failed || inspectionWarning.stale || inspectionWarning.never ? (
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            )}
            <div className="font-semibold">
              {inspectionWarning.never
                ? 'No inspection on record — a pre-trip inspection is required before service.'
                : (
                  <>
                    Last inspection: {formatDate(selectedVehicle.lastInspection)}
                    {inspectionWarning.failed && ' — previous inspection FAILED. '}
                    {inspectionWarning.stale
                      ? ' (over 24 hrs ago — new pre-trip inspection required).'
                      : !inspectionWarning.failed && ' — current.'}
                  </>
                )}
            </div>
          </div>
        )}

        {/* Odometer */}
        <Field label="Odometer Start (km)" icon={Gauge} error={errors.odoStart}>
          <input
            type="number"
            inputMode="numeric"
            value={odoStart}
            onChange={(e) => setOdoStart(e.target.value)}
            placeholder="e.g. 87432"
            className={`tabular ${inputCls(errors.odoStart)}`}
          />
        </Field>

        {/* Date */}
        <Field label="Shift Date" icon={Calendar}>
          <input type="text" readOnly value={formatDate(today)} className="h-12 w-full rounded-xl border border-line bg-white/5 px-4 font-semibold text-graytext" />
        </Field>

        <Button size="lg" fullWidth icon={Play} onClick={handleStart}>Start Shift</Button>
      </Card>

      <p className="mt-6 text-center text-[11px] text-muted">Powered by Drivex</p>
    </div>
  )
}

function Field({ label, icon: Icon, error, children }) {
  // Control nested inside <label> so it's programmatically associated (screen
  // readers announce it; tapping the label focuses the input).
  return (
    <div>
      <label className="block">
        <span className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-white">
          {Icon && <Icon size={15} className="text-graytext" />} {label}
        </span>
        {children}
      </label>
      {error && <p className="mt-1 text-xs font-semibold text-danger">{error}</p>}
    </div>
  )
}

const inputCls = (error) =>
  `h-12 w-full rounded-xl border bg-surface px-4 font-semibold text-white outline-none transition-colors focus:border-green disabled:bg-white/5 disabled:text-graytext ${
    error ? 'border-danger' : 'border-line'
  }`
