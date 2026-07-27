import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, MapPin, ListChecks, Bell, Database, Save, ShieldAlert, RotateCcw } from 'lucide-react'
import { useManagerStore } from '../../store/useManagerStore'
import { useAuthStore } from '../../store/useAuthStore'
import { useToastStore } from '../../store/useToastStore'
import { SectionHeader } from '../../components/shared/SectionHeader'
import { Card } from '../../components/shared/Card'
import { Button } from '../../components/shared/Button'
import { Modal } from '../../components/shared/Modal'
import { ParkNFlyMark } from '../../components/shared/Logo'
import { inspectionGroups } from '../../data/inspectionItems'
import { DEMO } from '../../config'

const NOTIFICATION_LABELS = {
  failedInspectionAlerts: 'Failed inspection alerts',
  dailySummaryEmail: 'Daily summary email',
  shiftReminderTexts: 'Shift reminder texts to drivers',
  maintenanceDueAlerts: 'Maintenance-due alerts',
  incidentAlerts: 'Incident report alerts',
}

export default function Settings() {
  const store = useManagerStore()
  const { settings, checklist, criticalItems, locations } = store
  const updateLocation = useManagerStore((s) => s.updateLocation)
  const toggleNotification = useManagerStore((s) => s.toggleNotification)
  const toggleChecklistItem = useManagerStore((s) => s.toggleChecklistItem)
  const toggleCriticalItem = useManagerStore((s) => s.toggleCriticalItem)
  const resetSystem = useManagerStore((s) => s.resetSystem)
  const addToast = useToastStore((s) => s.addToast)

  const currentUser = useAuthStore((s) => s.currentUser)
  const activeLocationId = useAuthStore((s) => s.activeLocationId)
  const isOwner = currentUser?.role === 'owner'

  const activeLocation = locations.find((l) => l.id === activeLocationId)
  const [locName, setLocName] = useState(activeLocation?.name || '')
  const [locCode, setLocCode] = useState(activeLocation?.code || '')
  const [resetOpen, setResetOpen] = useState(false)

  useEffect(() => {
    setLocName(activeLocation?.name || '')
    setLocCode(activeLocation?.code || '')
  }, [activeLocation?.id])

  const saveLocation = () => {
    if (!activeLocation) return
    updateLocation(activeLocation.id, { name: locName, code: locCode.toUpperCase() })
    addToast('Location settings saved', 'success')
  }

  const activeCount = checklist.filter((c) => c.active).length

  return (
    <div className="space-y-6">
      <SectionHeader title="Settings" subtitle="Location, checklist, safety & integration configuration" icon={SettingsIcon} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Location */}
        <Card padded>
          <h2 className="flex items-center gap-2 text-base font-extrabold text-white">
            <MapPin size={18} className="text-green" /> Location — {activeLocation?.city || '—'}
          </h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-graytext">Location Name</label>
              <input value={locName} onChange={(e) => setLocName(e.target.value)} className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-white outline-none focus:border-green" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-graytext">Airport Code</label>
              <input value={locCode} onChange={(e) => setLocCode(e.target.value.toUpperCase())} maxLength={4} className="h-10 w-32 rounded-lg border border-line bg-surface px-3 text-sm font-bold uppercase tracking-wider text-white outline-none focus:border-green" />
            </div>
            <Button size="sm" icon={Save} onClick={saveLocation}>Save Location</Button>
            {isOwner && <p className="text-xs text-graytext">Manage all locations under Owner Admin → Locations.</p>}
          </div>
        </Card>

        {/* Notifications */}
        <Card padded>
          <h2 className="flex items-center gap-2 text-base font-extrabold text-white">
            <Bell size={18} className="text-green" /> Notification Preferences
          </h2>
          <div className="mt-4 space-y-1">
            {Object.entries(NOTIFICATION_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between py-2">
                <span className="text-sm font-semibold text-white">{label}</span>
                <Toggle checked={!!settings.notifications[key]} onChange={() => toggleNotification(key)} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Critical / auto-pull items */}
      <Card padded>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-white">
            <ShieldAlert size={18} className="text-danger" /> Unsafe Items — Auto-Pull from Service
          </h2>
          <span className="tabular text-sm font-bold text-graytext">{criticalItems.length} critical items</span>
        </div>
        <p className="mt-1 text-sm text-graytext">
          If a driver marks any of these items as <span className="font-bold text-danger">FAIL</span> during a
          pre-trip inspection, the bus is automatically taken out of service. Adjust which items count as unsafe.
        </p>

        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {inspectionGroups.map((group) => (
            <div key={group.key}>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-white">
                <span>{group.icon}</span> {group.label}
              </h3>
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const isCritical = criticalItems.includes(item.key)
                  return (
                    <div key={item.key} className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                        {isCritical && <ShieldAlert size={13} className="text-danger" />}
                        {item.label}
                      </span>
                      <Toggle checked={isCritical} onChange={() => toggleCriticalItem(item.key)} danger />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Inspection checklist manager */}
      <Card padded>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-white">
            <ListChecks size={18} className="text-green" /> Inspection Checklist
          </h2>
          <span className="tabular text-sm font-bold text-graytext">{activeCount} of {checklist.length} items active</span>
        </div>
        <p className="mt-1 text-sm text-graytext">Inactive items are hidden from the driver pre-trip inspection.</p>

        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {inspectionGroups.map((group) => (
            <div key={group.key}>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-white"><span>{group.icon}</span> {group.label}</h3>
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const cfg = checklist.find((c) => c.key === item.key)
                  const active = cfg?.active ?? true
                  return (
                    <div key={item.key} className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2">
                      <span className={`text-sm font-semibold ${active ? 'text-white' : 'text-muted line-through'}`}>{item.label}</span>
                      <Toggle checked={active} onChange={() => toggleChecklistItem(item.key)} />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Cloud sync status */}
      <Card padded className={store.synced ? 'border-green/30 bg-green-light' : 'border-dashed border-2 border-line bg-white/5'}>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface shadow-card">
            <Database size={24} className={store.synced ? 'text-green' : 'text-graytext'} />
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-base font-extrabold text-white">
              Cloud Sync
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  store.synced ? 'bg-green/15 text-green' : 'bg-amber/15 text-amber'
                }`}
              >
                {store.synced ? 'Active' : 'Local-only'}
              </span>
            </h2>
            <p className="mt-0.5 max-w-md text-sm text-graytext">
              {store.synced
                ? 'Data is stored in the cloud database and stays in sync across every signed-in device, updating automatically within seconds.'
                : 'This device is not connected to the cloud database — data is stored on this device only. Connect the database on the server to enable cross-device sync.'}
            </p>
          </div>
        </div>
      </Card>

      {/* Owner: reset system */}
      {isOwner && (
        <Card padded className="border-danger/20">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-white">
            <RotateCcw size={18} className="text-danger" /> Reset System Data
          </h2>
          <p className="mt-1 text-sm text-graytext">
            {DEMO
              ? "Wipes everything you've added from this browser and restores the original demo dataset. Cannot be undone."
              : "Wipes all data (locations, managers, staff, vehicles, incidents, shifts, notes) from this browser and returns the system to empty. Cannot be undone."}
          </p>
          <Button className="mt-3" variant="danger" icon={RotateCcw} onClick={() => setResetOpen(true)}>
            {DEMO ? 'Reset to Demo Data' : 'Reset System (Clear All)'}
          </Button>
        </Card>
      )}

      <div className="flex items-center justify-center gap-2 pb-2 text-[11px] text-muted">
        <ParkNFlyMark size={18} />
        Park N Fly · Powered by Drivex — Built to run. Priced to grow.
      </div>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset all system data?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => { resetSystem(); setResetOpen(false); addToast(DEMO ? 'System reset to demo data' : 'System reset — all data cleared', 'warning') }}>Reset Everything</Button>
          </>
        }
      >
        <p className="text-sm text-graytext">
          This permanently clears all locally-stored data and reloads the original seed data. Anything you've added will be lost.
        </p>
      </Modal>
    </div>
  )
}

function Toggle({ checked, onChange, danger }) {
  const onColor = danger ? 'bg-danger' : 'bg-green'
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? onColor : 'bg-white/15'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-surface shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  )
}
