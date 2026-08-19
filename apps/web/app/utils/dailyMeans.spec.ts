import { describe, expect, it } from 'vitest'
import { dailyMeans, smoothedDailyMeans, type DailyMean } from './dailyMeans'
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

describe('dailyMeans', () => {
  it('averages multiple readings on the same day and sorts by date', () => {
    const entries: Entry[] = [
      entry({ date: '2026-08-02', time: '09:00', systolic: 130, diastolic: 90, pulse: 65 }),
      entry({ date: '2026-08-01', time: '08:00', systolic: 120, diastolic: 80, pulse: 58 }),
      entry({ date: '2026-08-01', time: '20:00', systolic: 110, diastolic: 70, pulse: 62 })
    ]

    expect(dailyMeans(entries)).toEqual([
      { date: new Date('2026-08-01T00:00:00'), meanSystolic: 115, meanDiastolic: 75, meanPulse: 60 },
      { date: new Date('2026-08-02T00:00:00'), meanSystolic: 130, meanDiastolic: 90, meanPulse: 65 }
    ])
  })
})

describe('smoothedDailyMeans', () => {
  it('applies a centered rolling average, clamping the window at the edges', () => {
    const data: DailyMean[] = [
      { date: new Date('2026-08-01T00:00:00'), meanSystolic: 100, meanDiastolic: 60, meanPulse: 60 },
      { date: new Date('2026-08-02T00:00:00'), meanSystolic: 110, meanDiastolic: 70, meanPulse: 64 },
      { date: new Date('2026-08-03T00:00:00'), meanSystolic: 120, meanDiastolic: 80, meanPulse: 68 },
      { date: new Date('2026-08-04T00:00:00'), meanSystolic: 130, meanDiastolic: 90, meanPulse: 72 }
    ]

    expect(smoothedDailyMeans(data, 3)).toEqual([
      { date: data[0]!.date, meanSystolic: 105, meanDiastolic: 65, meanPulse: 62 },
      { date: data[1]!.date, meanSystolic: 110, meanDiastolic: 70, meanPulse: 64 },
      { date: data[2]!.date, meanSystolic: 120, meanDiastolic: 80, meanPulse: 68 },
      { date: data[3]!.date, meanSystolic: 125, meanDiastolic: 85, meanPulse: 70 }
    ])
  })
})
