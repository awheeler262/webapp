import { describe, expect, it } from 'vitest'
import { parseCsv } from './parseHealthCsv'

describe('parseCsv', () => {
  it('parses pipe-delimited rows into Entry objects', () => {
    const file = [
      'date|time|systolic|diastolic|pulse|notes',
      '2026-08-01|23:00|121|81|56|meds; multiple',
      '2026-08-02|11:35|120|80|55|'
    ].join('\n')

    expect(parseCsv(file)).toEqual([
      {
        date: '2026-08-01',
        time: '23:00',
        systolic: 121,
        diastolic: 81,
        pulse: 56,
        notes: 'meds; multiple'
      },
      {
        date: '2026-08-02',
        time: '11:35',
        systolic: 120,
        diastolic: 80,
        pulse: 55,
        notes: ''
      }
    ])
  })
})
