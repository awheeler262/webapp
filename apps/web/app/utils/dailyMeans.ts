import type { Entry } from './parseHealthFile'

export type DailyMean = {
  date: Date
  meanSystolic: number
  meanDiastolic: number
  meanPulse: number
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

export function dailyMeans(entries: Entry[]): DailyMean[] {
  const byDate = new Map<string, Entry[]>()
  for (const entry of entries) {
    const existing = byDate.get(entry.date)
    if (existing) {
      existing.push(entry)
    } else {
      byDate.set(entry.date, [entry])
    }
  }

  return Array.from(byDate.entries())
    .map(([date, dayEntries]) => ({
      date: new Date(`${date}T00:00:00`),
      meanSystolic: average(dayEntries.map(e => e.systolic)),
      meanDiastolic: average(dayEntries.map(e => e.diastolic)),
      meanPulse: average(dayEntries.map(e => e.pulse))
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
}

function rollingAverage(values: number[], windowSize: number): number[] {
  const half = Math.floor(windowSize / 2)
  return values.map((_, i) => {
    const window = values.slice(Math.max(0, i - half), Math.min(values.length, i + half + 1))
    return average(window)
  })
}

// Centered rolling average, used as a lightweight stand-in for a statistical
// smoother (e.g. loess) on the trend line -- see health.vue's chart action.
export function smoothedDailyMeans(data: DailyMean[], windowSize = 30): DailyMean[] {
  const systolic = rollingAverage(data.map(d => d.meanSystolic), windowSize)
  const diastolic = rollingAverage(data.map(d => d.meanDiastolic), windowSize)
  const pulse = rollingAverage(data.map(d => d.meanPulse), windowSize)
  return data.map((d, i) => ({ date: d.date, meanSystolic: systolic[i]!, meanDiastolic: diastolic[i]!, meanPulse: pulse[i]! }))
}
