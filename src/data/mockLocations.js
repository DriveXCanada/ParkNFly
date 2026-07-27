/**
 * MOCK DATA — ShuttleLog
 * Data store: Railway Postgres
 * Table: Locations
 * Replace this file with: useFetchLocations() hook → the backend API
 *
 * BACKEND: Replace with → GET /Locations table
 * Fields: Location_ID, Name, Code, City, Province, Active
 *
 * Lot locations across the country. Drivers, vehicles, and staff are scoped
 * to a location; the Owner manages locations, each Manager runs one location.
 */

export const mockLocations = [
  { id: 'LOC-HFX', name: "Park'N Fly Halifax", code: 'YHZ', city: 'Halifax', province: 'NS', active: true },
  { id: 'LOC-YYZ', name: "Park'N Fly Toronto", code: 'YYZ', city: 'Toronto', province: 'ON', active: true },
  { id: 'LOC-YVR', name: "Park'N Fly Vancouver", code: 'YVR', city: 'Vancouver', province: 'BC', active: false },
]

export const DEFAULT_LOCATION_ID = 'LOC-HFX'

export const getLocationById = (id) => mockLocations.find((l) => l.id === id)
export const getLocationLabel = (id) => {
  const l = getLocationById(id)
  return l ? `${l.city} · ${l.code}` : 'Unknown Location'
}

export default mockLocations
