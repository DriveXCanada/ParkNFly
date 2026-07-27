import { useState } from 'react'
import { FileText, FileDown, ClipboardCheck, BarChart3, Calendar, CheckCircle2, Clock } from 'lucide-react'
import { useManagerStore } from '../../store/useManagerStore'
import { useScope } from '../../hooks/useScope'
import { useToastStore } from '../../store/useToastStore'
import { SectionHeader } from '../../components/shared/SectionHeader'
import { Card } from '../../components/shared/Card'
import { Button } from '../../components/shared/Button'
import { formatDate, formatDateTime, timeAgo } from '../../utils/formatters'
import { generateShiftReport, generateInspectionReport, generateOperationsSummary } from '../../utils/pdfGenerator'
import { rangeSummary } from '../../utils/analytics'

export default function Reports() {
  const { shifts, drivers, vehicles, inspections, referenceToday } = useScope()
  const reportTimestamps = useManagerStore((s) => s.reportTimestamps)
  const markReportGenerated = useManagerStore((s) => s.markReportGenerated)
  const addToast = useToastStore((s) => s.addToast)

  const findDriver = (id) => drivers.find((d) => d.id === id)
  const findVehicle = (id) => vehicles.find((v) => v.id === id)

  const weekAgo = (() => {
    const d = new Date(`${referenceToday}T12:00:00`)
    d.setDate(d.getDate() - 6)
    return d.toISOString().slice(0, 10)
  })()

  // Daily report state
  const [dailyDate, setDailyDate] = useState(referenceToday)
  const [dailyDriver, setDailyDriver] = useState(drivers[0]?.id || '')

  // Inspection report state
  const [inspStart, setInspStart] = useState(weekAgo)
  const [inspEnd, setInspEnd] = useState(referenceToday)
  const [inspVehicle, setInspVehicle] = useState(vehicles[0]?.id || '')

  // Operations summary state
  const [opStart, setOpStart] = useState(weekAgo)
  const [opEnd, setOpEnd] = useState(referenceToday)

  const generateDaily = () => {
    const shift = shifts.find((s) => s.date === dailyDate && s.driverId === dailyDriver)
    if (!shift) {
      addToast('No shift found for that driver on that date', 'warning')
      return
    }
    generateShiftReport({
      shift,
      inspection: inspections.find((i) => i.shiftId === shift.id),
      driver: findDriver(shift.driverId),
      vehicle: findVehicle(shift.vehicleId),
    })
    markReportGenerated('daily')
    addToast('Daily shift report generated', 'success')
  }

  const generateInspection = () => {
    const list = inspections
      .filter((i) => i.vehicleId === inspVehicle && i.date >= inspStart && i.date <= inspEnd)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
    if (list.length === 0) {
      addToast('No inspections in that range for this vehicle', 'warning')
      return
    }
    const latest = list[0]
    generateInspectionReport({
      inspection: latest,
      driver: findDriver(latest.driverId),
      vehicle: findVehicle(latest.vehicleId),
      shift: shifts.find((s) => s.id === latest.shiftId),
    })
    markReportGenerated('inspection')
    addToast(`Inspection report generated (${list.length} in range)`, 'success')
  }

  const generateOps = () => {
    const summary = rangeSummary(shifts, inspections, drivers, vehicles, opStart, opEnd)
    if (summary.kpis.totalTrips === 0) {
      addToast('No trips in the selected range', 'warning')
      return
    }
    generateOperationsSummary({
      rangeLabel: `${formatDate(opStart)} – ${formatDate(opEnd)}`,
      ...summary,
    })
    markReportGenerated('operations')
    addToast('Operations summary generated', 'success')
  }

  const inputCls =
    'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-white outline-none focus:border-green'

  return (
    <div className="space-y-6">
      <SectionHeader title="Reports" subtitle="Generate and export PDF reports" icon={FileText} />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Daily Shift Report */}
        <ReportCard
          icon={FileDown}
          title="Daily Shift Report"
          description="Single-driver shift report matching the in-bus driver app format — trip log, inspection, and totals."
          includes={['Shift summary & odometer', 'Full trip log table', 'Pre-trip inspection results', 'Dual signature lines']}
          lastGenerated={reportTimestamps.daily}
        >
          <Field label="Date">
            <input type="date" value={dailyDate} max={referenceToday} onChange={(e) => setDailyDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Driver">
            <select value={dailyDriver} onChange={(e) => setDailyDriver(e.target.value)} className={inputCls}>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Button fullWidth icon={FileDown} onClick={generateDaily}>
            Generate PDF
          </Button>
        </ReportCard>

        {/* Fleet Inspection Report */}
        <ReportCard
          icon={ClipboardCheck}
          title="Fleet Inspection Report"
          description="Inspection history for a single vehicle over a date range, with failed items called out."
          includes={['Vehicle & fuel info block', 'Grouped inspection checklist', 'Issues / defects callout', 'Inspector signatures']}
          lastGenerated={reportTimestamps.inspection}
        >
          <div className="grid grid-cols-2 gap-2">
            <Field label="From">
              <input type="date" value={inspStart} max={referenceToday} onChange={(e) => setInspStart(e.target.value)} className={inputCls} />
            </Field>
            <Field label="To">
              <input type="date" value={inspEnd} max={referenceToday} onChange={(e) => setInspEnd(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Vehicle">
            <select value={inspVehicle} onChange={(e) => setInspVehicle(e.target.value)} className={inputCls}>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.busNum} — {v.make} {v.model}
                </option>
              ))}
            </select>
          </Field>
          <Button fullWidth icon={FileDown} onClick={generateInspection}>
            Generate PDF
          </Button>
        </ReportCard>

        {/* Operations Summary */}
        <ReportCard
          icon={BarChart3}
          title="Operations Summary"
          description="Management-level aggregate report across all drivers and vehicles for a date range."
          includes={['Headline KPIs & distance', 'Per-driver breakdown', 'Fleet utilization table', 'Failed-item flags']}
          lastGenerated={reportTimestamps.operations}
        >
          <div className="grid grid-cols-2 gap-2">
            <Field label="From">
              <input type="date" value={opStart} max={referenceToday} onChange={(e) => setOpStart(e.target.value)} className={inputCls} />
            </Field>
            <Field label="To">
              <input type="date" value={opEnd} max={referenceToday} onChange={(e) => setOpEnd(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Button fullWidth icon={FileDown} onClick={generateOps}>
            Generate PDF
          </Button>
        </ReportCard>
      </div>
    </div>
  )
}

function ReportCard({ icon: Icon, title, description, includes, lastGenerated, children }) {
  return (
    <Card padded className="flex flex-col">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-light text-green-dark">
        <Icon size={22} />
      </div>
      <h2 className="mt-3 text-lg font-extrabold text-white">{title}</h2>
      <p className="mt-1 text-sm text-graytext">{description}</p>

      <ul className="mt-3 space-y-1.5">
        {includes.map((item) => (
          <li key={item} className="flex items-center gap-2 text-xs font-semibold text-white">
            <CheckCircle2 size={14} className="shrink-0 text-green" /> {item}
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-3 border-t border-line pt-4">{children}</div>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-graytext">
        <Clock size={12} />
        {lastGenerated ? `Last generated ${timeAgo(lastGenerated)}` : 'Not yet generated'}
      </div>
    </Card>
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
