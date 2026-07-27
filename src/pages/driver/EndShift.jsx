import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gauge, FileDown, ClipboardCheck, LogOut, Route, Users, Clock, AlertTriangle, Fuel, CheckCircle2 } from 'lucide-react'
import { useShiftStore, selectTripTotals, selectBreakMinutes } from '../../store/useShiftStore'
import { useManagerStore } from '../../store/useManagerStore'
import { useToastStore } from '../../store/useToastStore'
import { allInspectionItems } from '../../data/inspectionItems'
import { Card } from '../../components/shared/Card'
import { Button } from '../../components/shared/Button'
import { Modal } from '../../components/shared/Modal'
import { formatDate, formatMinutes, minutesBetween } from '../../utils/formatters'
import { generateShiftReport, generateInspectionReport } from '../../utils/pdfGenerator'

export default function EndShift() {
  const navigate = useNavigate()
  const store = useShiftStore()
  const drivers = useManagerStore((s) => s.drivers)
  const vehicles = useManagerStore((s) => s.vehicles)
  const commitShift = useManagerStore((s) => s.commitShift)
  const addToast = useToastStore((s) => s.addToast)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState('')

  const {
    shiftStarted, driverId, vehicleId, locationId, shiftDate, odoStart, odoEnd, fuelLitres,
    startedAt, trips, incidents, breaks, inspectionResults, inspectionPhotos, fuelLevel, inspectionNotes,
    inspectionSignature, inspectionComplete, setOdoEnd, setFuelLitres, endShift,
  } = store

  if (!shiftStarted) {
    navigate('/driver', { replace: true })
    return null
  }

  const driver = drivers.find((d) => d.id === driverId)
  const vehicle = vehicles.find((v) => v.id === vehicleId)
  const totals = selectTripTotals(trips)
  const odoEndNum = Number(odoEnd)
  const totalKm =
    odoEnd !== '' && !isNaN(odoEndNum) && odoEndNum >= Number(odoStart) ? odoEndNum - Number(odoStart) : null
  const shiftDuration = minutesBetween(startedAt, new Date().toISOString())
  const breakMinutes = selectBreakMinutes(breaks)
  const activeMinutes = shiftDuration != null ? Math.max(0, shiftDuration - breakMinutes) : null
  const failedItems = allInspectionItems.filter((i) => inspectionResults[i.key] === 'fail')

  // Inspection completeness drives the driver's compliance score.
  const anyChecked = Object.values(inspectionResults).some((v) => v != null)
  const inspectionStatus = inspectionComplete ? 'complete' : anyChecked ? 'incomplete' : 'missing'
  const hasInspection = inspectionStatus !== 'missing'

  const buildShiftObj = () => ({
    id: `S-${Date.now()}`,
    driverId,
    vehicleId,
    locationId,
    date: shiftDate,
    startTime: startedAt,
    endTime: new Date().toISOString(),
    odoStart: Number(odoStart),
    odoEnd: totalKm != null ? odoEndNum : null,
    fuelLitres: fuelLitres !== '' && !isNaN(Number(fuelLitres)) ? Number(fuelLitres) : null,
    status: 'complete',
    inspectionStatus,
    inspectionComplete,
    breaks: breaks.map((b) => ({ ...b })),
    breakMinutes,
    activeMinutes,
    trips: trips.map((t) => ({ ...t })),
  })

  const buildInspectionObj = () => ({
    id: `INSP-${Date.now()}`,
    shiftId: `S-${Date.now()}`,
    driverId,
    vehicleId,
    locationId,
    date: shiftDate,
    time: startedAt,
    results: inspectionResults,
    fuelLevel,
    notes: inspectionNotes,
    signature: inspectionSignature,
    photos: inspectionPhotos || [],
    complete: inspectionComplete,
    overallResult: inspectionComplete ? (failedItems.length > 0 ? 'fail' : 'pass') : 'incomplete',
  })

  const downloadFull = () => {
    generateShiftReport({
      shift: buildShiftObj(),
      inspection: hasInspection ? buildInspectionObj() : null,
      driver,
      vehicle,
    })
    addToast('Full shift report downloaded', 'success')
  }

  const downloadInspection = () => {
    if (!inspectionComplete) {
      addToast('No completed inspection to export', 'warning')
      return
    }
    generateInspectionReport({ inspection: buildInspectionObj(), driver, vehicle, shift: buildShiftObj() })
    addToast('Inspection report downloaded', 'success')
  }

  const handleEndShift = () => {
    if (odoEnd === '' || isNaN(odoEndNum)) return setError('Enter the ending odometer reading first.')
    if (odoEndNum < Number(odoStart)) return setError('Ending odometer must be greater than the start reading.')
    if (fuelLitres === '' || isNaN(Number(fuelLitres))) return setError('Enter the litres of fuel added (enter 0 if none).')
    setError('')
    setConfirmOpen(true)
  }

  const confirmEnd = () => {
    const shiftObj = buildShiftObj()
    const inspObj = hasInspection ? { ...buildInspectionObj(), shiftId: shiftObj.id } : null

    // Auto-download the full shift report.
    generateShiftReport({ shift: shiftObj, inspection: inspObj, driver, vehicle })

    // Commit into the manager system of record (adds shift, applies auto-down).
    commitShift({ shift: shiftObj, inspection: inspObj, incidents: [] })
    const auto = useManagerStore.getState()._autoDown

    endShift()
    if (auto?.autoDown) {
      addToast(`${vehicle?.busNum} auto-pulled from service: critical inspection failure.`, 'warning')
    } else if (inspectionStatus !== 'complete') {
      addToast(
        `Shift ended. Inspection was ${inspectionStatus} — this affects your compliance score.`,
        'warning',
      )
    } else {
      addToast('Shift ended & report downloaded. Compliance recorded ✓', 'success')
    }
    navigate('/driver')
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-black tracking-tight text-white">End of Shift</h1>

      <Card padded className="space-y-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Info label="Driver" value={driver?.name} />
          <Info label="Vehicle" value={vehicle?.busNum} />
          <Info label="Date" value={formatDate(shiftDate)} />
          <Info label="Shift Duration" value={shiftDuration != null ? formatMinutes(shiftDuration) : '—'} />
          <Info label="Break Time" value={formatMinutes(breakMinutes)} />
          <Info label="Active Time" value={activeMinutes != null ? formatMinutes(activeMinutes) : '—'} />
        </div>
        <div className="grid grid-cols-3 gap-3 border-t border-line pt-4">
          <Stat icon={Route} label="Trips" value={totals.totalTrips} />
          <Stat icon={Users} label="Total Pax" value={totals.totalPax} />
          <Stat icon={Clock} label="Pax →/←" value={`${totals.paxTo}/${totals.paxFrom}`} />
        </div>
        {incidents.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-amber/10 px-3 py-2 text-sm font-semibold text-amber">
            <AlertTriangle size={16} /> {incidents.length} incident report(s) filed this shift
          </div>
        )}
      </Card>

      {/* Odometer */}
      <Card padded className="space-y-3">
        <label className="flex items-center gap-1.5 text-sm font-bold text-white">
          <Gauge size={15} className="text-graytext" /> Odometer End (km)
        </label>
        <input
          type="number"
          inputMode="numeric"
          value={odoEnd}
          onChange={(e) => { setOdoEnd(e.target.value); setError('') }}
          placeholder={`Greater than ${Number(odoStart).toLocaleString()}`}
          className="tabular h-12 w-full rounded-xl border border-line bg-surface px-4 font-semibold text-white outline-none focus:border-green"
        />
        <div className="flex items-center justify-between rounded-xl bg-green-light px-4 py-3">
          <span className="text-sm font-bold text-green-dark">Total Distance</span>
          <span className="tabular text-xl font-black text-green-dark">
            {totalKm != null ? `${totalKm.toLocaleString()} km` : '—'}
          </span>
        </div>
      </Card>

      {/* Fuel added */}
      <Card padded className="space-y-3">
        <label className="flex items-center gap-1.5 text-sm font-bold text-white">
          <Fuel size={15} className="text-graytext" /> Fuel Added (litres)
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={fuelLitres}
          onChange={(e) => { setFuelLitres(e.target.value); setError('') }}
          placeholder="How many litres did you put in? (0 if none)"
          className="tabular h-12 w-full rounded-xl border border-line bg-surface px-4 font-semibold text-white outline-none focus:border-green"
        />
        <p className="text-xs text-graytext">Logged to the shift record and the fleet's fuel history.</p>
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
            <AlertTriangle size={16} /> {error}
          </div>
        )}
      </Card>

      {/* Inspection compliance notice */}
      {inspectionStatus === 'complete' ? (
        <Card padded className="flex items-center gap-3 border-green/30 bg-green-light py-3">
          <CheckCircle2 size={18} className="text-green" />
          <span className="text-sm font-semibold text-green-dark">
            Pre-trip inspection complete — positive for your compliance score.
          </span>
        </Card>
      ) : (
        <Card padded className="flex items-start gap-3 border-amber/30 bg-amber/10 py-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber" />
          <div className="text-sm font-semibold text-amber">
            Inspection {inspectionStatus === 'missing' ? 'not started' : 'incomplete'} — ending now will
            lower your compliance score.{' '}
            <button onClick={() => navigate('/driver/inspection')} className="underline">
              Complete it first
            </button>
            .
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Button size="lg" icon={FileDown} onClick={downloadFull}>Full Shift Report</Button>
        <Button size="lg" variant="secondary" icon={ClipboardCheck} onClick={downloadInspection}>Inspection Report</Button>
      </div>

      <Button size="lg" variant="danger" fullWidth icon={LogOut} onClick={handleEndShift}>End Shift</Button>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="End shift?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={confirmEnd}>End Shift</Button>
          </>
        }
      >
        <p className="text-sm text-graytext">
          Your full shift report will download automatically and the shift will be submitted to
          management — <span className="font-bold text-white">{totals.totalTrips} trips</span>,{' '}
          <span className="font-bold text-white">{totals.totalPax} passengers</span>, and{' '}
          <span className="font-bold text-white">{fuelLitres || 0} L</span> fuel.
        </p>
      </Modal>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wide text-graytext">{label}</div>
      <div className="font-extrabold text-white">{value || '—'}</div>
    </div>
  )
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl bg-offwhite px-3 py-2.5 text-center">
      <Icon size={15} className="mx-auto text-green" />
      <div className="tabular mt-1 text-lg font-black text-white">{value}</div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-graytext">{label}</div>
    </div>
  )
}
