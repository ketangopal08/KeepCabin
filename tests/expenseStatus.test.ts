import { describe, it, expect } from 'vitest'
import { statusMeta, statusText, trackerSteps } from '../app/utils/expenseStatus'

const log = (...a: [string, string][]) => a.map(([action, ts]) => ({ action, actor_name: 'X', timestamp: ts }))

describe('statusMeta / statusText', () => {
  it('known', () => expect(statusMeta('pending_finance')).toEqual({ label: 'Awaiting finance', variant: 'info' }))
  it('unknown → neutral raw', () => expect(statusMeta('weird')).toEqual({ label: 'weird', variant: 'neutral' }))
  it('scheduled with date', () => expect(statusText('scheduled', '2026-11-30')).toBe('Pays on 30 Nov'))
  it('scheduled without date', () => expect(statusText('scheduled', null)).toBe('Scheduled'))
})

describe('trackerSteps', () => {
  it('pending manager', () => expect(trackerSteps({ status: 'pending_manager', action_log: log(['submitted', '2026-11-18T05:00:00Z']) }).map(s => s.state))
    .toEqual(['done', 'current', 'upcoming', 'upcoming', 'upcoming']))
  it('rejected by manager', () => {
    const s = trackerSteps({ status: 'rejected', action_log: [...log(['submitted', '2026-11-18T05:00:00Z']), { action: 'rejected', actor_name: 'Manager', timestamp: '2026-11-19T05:00:00Z', note: 'Duplicate' }] })
    expect(s.map(x => x.state)).toEqual(['done', 'rejected', 'upcoming', 'upcoming', 'upcoming'])
    expect(s[1]!.detail).toBe('Duplicate')
  })
  it('legacy rejected without log entry', () => {
    const s = trackerSteps({ status: 'rejected', rejection_reason: 'Duplicate', action_log: log(['submitted', '2026-11-18T05:00:00Z']) })
    expect(s.map(x => x.state)).toEqual(['done', 'rejected', 'upcoming', 'upcoming', 'upcoming'])
    expect(s[1]!.detail).toBe('Duplicate')
  })
  it('rejected by finance', () => expect(trackerSteps({ status: 'rejected', action_log: [...log(['submitted', '2026-11-18T05:00:00Z'], ['approved', '2026-11-18T06:00:00Z']), { action: 'rejected', actor_name: 'Finance', timestamp: '2026-11-19T05:00:00Z', note: 'No GST' }] }).map(s => s.state))
    .toEqual(['done', 'done', 'rejected', 'upcoming', 'upcoming']))
  it('scheduled shows payout date', () => {
    const s = trackerSteps({ status: 'scheduled', payout_date: '2026-11-30', action_log: log(['submitted', '2026-11-18T05:00:00Z'], ['approved', '2026-11-18T06:00:00Z'], ['finance_approved', '2026-11-19T06:00:00Z']) })
    expect(s.map(x => x.state)).toEqual(['done', 'done', 'done', 'current', 'upcoming'])
    expect(s[3]!.detail).toBe('Pays on 30 Nov')
  })
  it('paid shows UTR', () => {
    const s = trackerSteps({ status: 'paid', utr_number: 'ABC123', payout_date: '2026-11-30', action_log: log(['submitted', '2026-11-18T05:00:00Z'], ['approved', '2026-11-18T06:00:00Z'], ['finance_approved', '2026-11-19T06:00:00Z'], ['paid', '2026-11-30T06:00:00Z']) })
    expect(s.every(x => x.state === 'done')).toBe(true)
    expect(s[4]!.detail).toBe('UTR ABC123')
  })
  it('legacy paid without finance_approved still all done', () => expect(trackerSteps({ status: 'paid', utr_number: 'U1', action_log: log(['submitted', '2026-11-01T05:00:00Z'], ['approved', '2026-11-02T05:00:00Z'], ['paid', '2026-11-03T05:00:00Z']) }).every(x => x.state === 'done')).toBe(true))
  it('formats action timestamps in IST', () => {
    const s = trackerSteps({ status: 'pending_manager', action_log: log(['submitted', '2026-11-19T20:00:00Z']) })
    expect(s[0]!.detail!.endsWith('20 Nov')).toBe(true)
  })
})
