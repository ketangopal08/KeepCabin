import { describe, it, expect } from 'vitest'
import { nextPayoutDate, stepApprovers, canActOnStep, type MemberLite } from '../lib/payouts'

// IST = UTC+5:30. Helper: an instant that is the given IST wall-clock time.
const ist = (s: string) => new Date(new Date(`${s}Z`).getTime() - 330 * 60_000)

describe('nextPayoutDate', () => {
  it('semi_monthly: 14th → 15th', () => expect(nextPayoutDate('semi_monthly', ist('2026-11-14T10:00:00'))).toBe('2026-11-15'))
  it('semi_monthly: on the 15th → month end', () => expect(nextPayoutDate('semi_monthly', ist('2026-11-15T09:00:00'))).toBe('2026-11-30'))
  it('semi_monthly: on month end → next 15th', () => expect(nextPayoutDate('semi_monthly', ist('2026-11-30T18:00:00'))).toBe('2026-12-15'))
  it('semi_monthly: Feb end (non-leap)', () => expect(nextPayoutDate('semi_monthly', ist('2027-02-20T12:00:00'))).toBe('2027-02-28'))
  it('monthly: mid month → month end', () => expect(nextPayoutDate('monthly', ist('2026-11-19T12:00:00'))).toBe('2026-11-30'))
  it('monthly: on month end → next month end', () => expect(nextPayoutDate('monthly', ist('2026-11-30T12:00:00'))).toBe('2026-12-31'))
  it('weekly: Thursday → Friday', () => expect(nextPayoutDate('weekly', ist('2026-11-19T12:00:00'))).toBe('2026-11-20'))
  it('weekly: on Friday → next Friday', () => expect(nextPayoutDate('weekly', ist('2026-11-20T12:00:00'))).toBe('2026-11-27'))
  it('uses IST day: 23:30 IST on 14th is still the 14th', () => expect(nextPayoutDate('semi_monthly', ist('2026-11-14T23:30:00'))).toBe('2026-11-15'))
})

const M: MemberLite[] = [
  { user_id: 'owner', role: 'owner', team_id: null },
  { user_id: 'mgrD', role: 'manager', team_id: 'design' },
  { user_id: 'sai', role: 'employee', team_id: 'design' },
  { user_id: 'fin1', role: 'finance', team_id: 'finance' },
  { user_id: 'ops', role: 'employee', team_id: 'ops' }, // ops has no manager
]

describe('stepApprovers', () => {
  it('manager step → team manager', () => expect(stepApprovers('manager', { submitted_by: 'sai', team_id: 'design' }, M)).toEqual(['mgrD']))
  it('manager submits own → owner', () => expect(stepApprovers('manager', { submitted_by: 'mgrD', team_id: 'design' }, M)).toEqual(['owner']))
  it('team without manager → owner', () => expect(stepApprovers('manager', { submitted_by: 'ops', team_id: 'ops' }, M)).toEqual(['owner']))
  it('finance step → finance members', () => expect(stepApprovers('finance', { submitted_by: 'sai', team_id: 'design' }, M)).toEqual(['fin1']))
  it('only finance member submits → owner', () => expect(stepApprovers('finance', { submitted_by: 'fin1', team_id: 'finance' }, M)).toEqual(['owner']))
  it('owner submits → finance does manager step', () => expect(stepApprovers('manager', { submitted_by: 'owner', team_id: 'finance' }, M)).toEqual(['fin1']))
})

describe('canActOnStep', () => {
  it('manager cannot approve own', () => expect(canActOnStep('manager', 'mgrD', { submitted_by: 'mgrD', team_id: 'design' }, M)).toBe(false))
  it('owner can approve manager’s own', () => expect(canActOnStep('manager', 'owner', { submitted_by: 'mgrD', team_id: 'design' }, M)).toBe(true))
  it('other team manager cannot', () => expect(canActOnStep('manager', 'mgrD', { submitted_by: 'ops', team_id: 'ops' }, M)).toBe(false))
  it('finance cannot approve own', () => expect(canActOnStep('finance', 'fin1', { submitted_by: 'fin1', team_id: 'finance' }, M)).toBe(false))
  it('owner cannot approve own', () => expect(canActOnStep('finance', 'owner', { submitted_by: 'owner', team_id: 'finance' }, M)).toBe(false))
  it('employee never', () => expect(canActOnStep('manager', 'sai', { submitted_by: 'ops', team_id: 'design' }, M)).toBe(false))
})
