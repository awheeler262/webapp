import { describe, expect, it } from 'vitest'
import { parseCsv } from './parseHealthFile'

describe('parseCsv', () => {
  it('parses comma-delimited rows into Entry objects', () => {
    const file = [
      'date,time,systolic,diastolic,pulse,notes',
      '2026-08-01,23:00,121,81,56,meds; multiple',
      '2026-08-02,11:35,120,80,55,'
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

  it('treats a quoted field as one value even when it contains the delimiter', () => {
    const file = [
      'date,time,systolic,diastolic,pulse,notes',
      '2026-08-01,23:00,121,81,56,"felt dizzy, took extra dose"'
    ].join('\n')

    expect(parseCsv(file)).toEqual([
      {
        date: '2026-08-01',
        time: '23:00',
        systolic: 121,
        diastolic: 81,
        pulse: 56,
        notes: 'felt dizzy, took extra dose'
      }
    ])
  })

  it('unescapes a doubled quote inside a quoted field', () => {
    const file = [
      'date,time,systolic,diastolic,pulse,notes',
      '2026-08-01,23:00,121,81,56,"doctor said ""take with food"""'
    ].join('\n')

    expect(parseCsv(file)).toEqual([
      {
        date: '2026-08-01',
        time: '23:00',
        systolic: 121,
        diastolic: 81,
        pulse: 56,
        notes: 'doctor said "take with food"'
      }
    ])
  })
})
