import { describe, it, expect } from 'vitest'
import { toCSV } from '../src/utils/csv'
import { minutesBetween, formatMinutes, dateKey } from '../src/utils/formatters'
import { timingStats, rangeSummary } from '../src/utils/analytics'

describe('csv', () => {
  it('escapes commas, quotes, and newlines', () => {
    const rows = [{ a: 'plain', b: 'has, comma' }, { a: 'quote"d', b: 'line\nbreak' }]
    const cols = [
      { header: 'A', value: (r) => r.a },
      { header: 'B', value: (r) => r.b },
    ]
    const csv = toCSV(rows, cols)
    expect(csv.split('\n')[0]).toBe('A,B')
    expect(csv).toContain('"has, comma"')
    expect(csv).toContain('"quote""d"')
    expect(csv).toContain('"line\nbreak"')
  })

  it('renders empty for null/undefined cells', () => {
    const csv = toCSV([{ a: null }], [{ header: 'A', value: (r) => r.a }])
    expect(csv).toBe('A\n')
  })
})

describe('formatters', () => {
  it('minutesBetween computes whole minutes and guards bad input', () => {
    expect(minutesBetween('2026-01-01T08:00:00', '2026-01-01T09:30:00')).toBe(90)
    expect(minutesBetween(null, '2026-01-01T09:30:00')).toBeNull()
  })

  it('formatMinutes handles 0 and hour rollover', () => {
    expect(formatMinutes(0)).toBeTypeOf('string')
    expect(formatMinutes(90)).toContain('1')
  })

  it('dateKey returns an ISO date string', () => {
    expect(dateKey(new Date('2026-06-18T12:00:00'))).toBe('2026-06-18')
  })
})

describe('analytics — defensive on empty data', () => {
  it('timingStats([]) does not throw', () => {
    expect(() => timingStats([])).not.toThrow()
  })

  it('rangeSummary with empty collections does not throw and returns an object', () => {
    const out = rangeSummary([], [], [], [], '2026-06-01', '2026-06-30')
    expect(out).toBeTypeOf('object')
  })
})
