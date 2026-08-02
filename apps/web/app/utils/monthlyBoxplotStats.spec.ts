import { describe, expect, it } from 'vitest'
import { monthlyBoxplotStats } from './monthlyBoxplotStats'
import type { Entry } from './parseHealthFile'

function entry(overrides: Partial<Entry>): Entry {
  return {
    date: '2026-08-01',
    time: '08:00',
    systolic: 120,
    diastolic: 80,
    pulse: 60,
    notes: '',
    ...overrides
  }
}

describe('monthlyBoxplotStats', () => {
  it('computes quartiles/outliers per month and sorts months chronologically', () => {
    const entries: Entry[] = [
      entry({ date: '2026-08-01', systolic: 110 }),
      entry({ date: '2026-08-08', systolic: 115 }),
      entry({ date: '2026-08-15', systolic: 120 }),
      entry({ date: '2026-08-22', systolic: 125 }),
      entry({ date: '2026-08-29', systolic: 200 }),
      entry({ date: '2026-07-01', systolic: 90 }),
      entry({ date: '2026-07-15', systolic: 100 }),
      entry({ date: '2026-07-29', systolic: 110 })
    ]

    expect(monthlyBoxplotStats(entries, 'systolic')).toEqual([
      { yearMonth: '2026-07', min: 90, q1: 95, median: 100, q3: 105, max: 110, outliers: [] },
      { yearMonth: '2026-08', min: 110, q1: 115, median: 120, q3: 125, max: 125, outliers: [200] }
    ])
  })

  it('reads the requested metric', () => {
    const entries: Entry[] = [
      entry({ date: '2026-08-01', systolic: 120, diastolic: 70 }),
      entry({ date: '2026-08-02', systolic: 130, diastolic: 90 })
    ]

    expect(monthlyBoxplotStats(entries, 'diastolic')).toEqual([
      { yearMonth: '2026-08', min: 70, q1: 75, median: 80, q3: 85, max: 90, outliers: [] }
    ])
  })
})
