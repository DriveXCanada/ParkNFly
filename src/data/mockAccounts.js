/**
 * MOCK DATA — ShuttleLog
 * Data store: Railway Postgres
 * Table: Accounts (Owner + Managers)
 * Replace this file with: real authentication (a hashed-password auth provider)
 *
 * BACKEND: Replace with → GET /Accounts table + a real auth provider.
 * Fields: Account_ID, Name, Email, Role, Location_ID, Password_Hash
 *
 * ⚠️ SIMULATED AUTH ONLY. Passwords are stored in plain text in the browser
 * for the prototype so the login flow can be demonstrated. This is NOT secure
 * and MUST be replaced with real authentication before launch.
 *
 * Demo credentials (shown on the login screen):
 *   Owner   → owner@parknfly.ca / admin123
 *   Manager → halifax@parknfly.ca / manager123
 */

export const mockAccounts = [
  {
    id: 'ACC-OWNER',
    name: 'Operations Owner',
    email: 'owner@parknfly.ca',
    role: 'owner',
    locationId: null, // owner sees all locations
    password: 'admin123',
  },
  {
    id: 'ACC-MGR-HFX',
    name: 'Pat Reardon',
    email: 'halifax@parknfly.ca',
    role: 'manager',
    locationId: 'LOC-HFX',
    password: 'manager123',
  },
  {
    id: 'ACC-MGR-YYZ',
    name: 'Lillian Okafor',
    email: 'toronto@parknfly.ca',
    role: 'manager',
    locationId: 'LOC-YYZ',
    password: 'manager123',
  },
]

export const DEMO_CREDENTIALS = [
  { label: 'Owner', email: 'owner@parknfly.ca', password: 'admin123' },
  { label: 'Manager (Halifax)', email: 'halifax@parknfly.ca', password: 'manager123' },
]

export default mockAccounts
