import type { Entry } from './parseHealthFile'

export type Metric = 'systolic' | 'diastolic' | 'pulse'

export type BoxplotStats = {
  yearMonth: string // %Y-%m
  min: number
  q1: number
  median: number
  q3: number
  max: number
  outliers: number[]
}

// Linear-interpolation quantile (R/ggplot2's default `type 7`).
function quantile(sorted: number[], p: number): number {
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]!
  const frac = idx - lo
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac
}

function boxplotStats(yearMonth: string, values: number[]): BoxplotStats {
  const sorted = [...values].sort((a, b) => a - b)
  const q1 = quantile(sorted, 0.25)
  const median = quantile(sorted, 0.5)
  const q3 = quantile(sorted, 0.75)
  const iqr = q3 - q1
  const lowerFence = q1 - 1.5 * iqr
  const upperFence = q3 + 1.5 * iqr
  const inRange = sorted.filter(v => v >= lowerFence && v <= upperFence)
  const outliers = sorted.filter(v => v < lowerFence || v > upperFence)

  return {
    yearMonth,
    min: inRange.length ? inRange[0]! : sorted[0]!,
    q1,
    median,
    q3,
    max: inRange.length ? inRange[inRange.length - 1]! : sorted[sorted.length - 1]!,
    outliers
  }
}

export function monthlyBoxplotStats(entries: Entry[], metric: Metric): BoxplotStats[] {
  const byMonth = new Map<string, number[]>()
  for (const entry of entries) {
    const yearMonth = entry.date.slice(0, 7)
    const value = entry[metric]
    const existing = byMonth.get(yearMonth)
    if (existing) {
      existing.push(value)
    } else {
      byMonth.set(yearMonth, [value])
    }
  }

  return Array.from(byMonth.entries())
    .map(([yearMonth, values]) => boxplotStats(yearMonth, values))
    .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
}
