import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastHost } from './components/shared/Toast'
import { useAuthStore } from './store/useAuthStore'
import { useManagerStore } from './store/useManagerStore'
import { useShiftStore } from './store/useShiftStore'
import { Logo } from './components/shared/Logo'
import KioskUnlock from './pages/driver/KioskUnlock'

// Layouts
import DriverLayout from './components/driver/DriverLayout'
import ManagerLayout from './components/manager/ManagerLayout'

// Driver pages
import DriverApp from './pages/driver/DriverApp'
import TripLog from './pages/driver/TripLog'
import Inspection from './pages/driver/Inspection'
import DriverTrips from './pages/driver/DriverTrips'
import EndShift from './pages/driver/EndShift'
import IncidentReport from './pages/driver/IncidentReport'

// Manager pages
import Login from './pages/manager/Login'
import Dashboard from './pages/manager/Dashboard'
import Trips from './pages/manager/Trips'
import Fleet from './pages/manager/Fleet'
import Drivers from './pages/manager/Drivers'
import DriverDetail from './pages/manager/DriverDetail'
import Incidents from './pages/manager/Incidents'
import Alerts from './pages/manager/Alerts'
import Reports from './pages/manager/Reports'
import Settings from './pages/manager/Settings'
import Locations from './pages/manager/admin/Locations'
import Managers from './pages/manager/admin/Managers'

import Landing from './pages/Landing'

// Full-screen loader shown while the session is being restored, so guards
// don't flash a redirect before we know whether a session exists.
function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink">
      <div className="animate-pulse"><Logo size={40} dark /></div>
    </div>
  )
}

// Auth guard for the manager/owner area. Authorization is enforced server-side;
// this is UX routing only.
function RequireAuth({ children }) {
  const sessionReady = useAuthStore((s) => s.sessionReady)
  const currentUser = useAuthStore((s) => s.currentUser)
  if (!sessionReady) return <Splash />
  if (!currentUser) return <Navigate to="/manager/login" replace />
  return children
}

// Owner-only guard.
function RequireOwner({ children }) {
  const sessionReady = useAuthStore((s) => s.sessionReady)
  const currentUser = useAuthStore((s) => s.currentUser)
  if (!sessionReady) return <Splash />
  if (!currentUser) return <Navigate to="/manager/login" replace />
  if (currentUser.role !== 'owner') return <Navigate to="/manager" replace />
  return children
}

// Driver tablet gate: when a backend is configured, the tablet must have a
// session (kiosk or a signed-in manager) before it can read/write data.
function RequireKiosk({ children }) {
  const sessionReady = useAuthStore((s) => s.sessionReady)
  const sessionRole = useAuthStore((s) => s.sessionRole)
  const backendConfigured = useAuthStore((s) => s.backendConfigured)
  if (!sessionReady) return <Splash />
  if (backendConfigured && !sessionRole) return <KioskUnlock />
  return children
}

// How often to re-pull shared state so devices converge (ms).
const SYNC_POLL_MS = 25000

export default function App() {
  // Restore the session on load, then poll + refresh on focus so every
  // signed-in device sees the same live data. Polling is skipped while a driver
  // shift is in progress so a background pull can't disrupt live shift entry.
  useEffect(() => {
    useAuthStore.getState().initSession()
    const maybeRefresh = () => {
      if (useShiftStore.getState().shiftStarted) return
      useManagerStore.getState().refresh()
    }
    const id = setInterval(maybeRefresh, SYNC_POLL_MS)
    window.addEventListener('focus', maybeRefresh)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', maybeRefresh)
    }
  }, [])

  return (
    <>
      <ToastHost />
      <Routes>
        <Route path="/" element={<Landing />} />

        {/* Driver app (tablet) — gated by a kiosk session when synced */}
        <Route path="/driver" element={<RequireKiosk><DriverLayout /></RequireKiosk>}>
          <Route index element={<DriverApp />} />
          <Route path="log" element={<TripLog />} />
          <Route path="inspection" element={<Inspection />} />
          <Route path="trips" element={<DriverTrips />} />
          <Route path="incident" element={<IncidentReport />} />
          <Route path="end-shift" element={<EndShift />} />
        </Route>

        {/* Manager login (no layout) */}
        <Route path="/manager/login" element={<Login />} />

        {/* Manager dashboard (desktop) — auth required */}
        <Route
          path="/manager"
          element={
            <RequireAuth>
              <ManagerLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="trips" element={<Trips />} />
          <Route path="fleet" element={<Fleet />} />
          <Route path="drivers" element={<Drivers />} />
          <Route path="drivers/:driverId" element={<DriverDetail />} />
          <Route path="incidents" element={<Incidents />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="admin/locations" element={<RequireOwner><Locations /></RequireOwner>} />
          <Route path="admin/managers" element={<RequireOwner><Managers /></RequireOwner>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
