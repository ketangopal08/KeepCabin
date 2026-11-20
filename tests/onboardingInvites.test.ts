import { describe, it, expect } from 'vitest'
import { planManagerInvites, type TeamDraft } from '../lib/onboardingInvites'

const fin = (email = ''): TeamDraft => ({ id: 'f', name: 'Finance', isFinance: true, managerEmail: email })
const team = (id: string, name: string, email = ''): TeamDraft => ({ id, name, isFinance: false, managerEmail: email })

describe('planManagerInvites', () => {
  it('finance + design managers', () => expect(planManagerInvites([fin('ana@co.com'), team('d', 'Design', 'ketan@co.com')], false)).toEqual({
    invites: [
      { email: 'ana@co.com', role: 'finance', team_id: 'f', team_name: 'Finance' },
      { email: 'ketan@co.com', role: 'manager', team_id: 'd', team_name: 'Design' },
    ],
    errors: [],
  }))
  it('trims and lower-cases', () => expect(planManagerInvites([fin(' Ana@Co.com ')], false).invites[0]!.email).toBe('ana@co.com'))
  it('finance required unless self', () => expect(planManagerInvites([fin('')], false).errors).toEqual(["Add a Finance manager's email, or tick “I'll handle finance myself”."]))
  it('finance self → no finance invite', () => expect(planManagerInvites([fin('ana@co.com'), team('d', 'Design', 'k@co.com')], true).invites.map(i => i.team_id)).toEqual(['d']))
  it('blank optional team → skipped', () => expect(planManagerInvites([fin('ana@co.com'), team('d', 'Design')], false).invites).toHaveLength(1))
  it('invalid email', () => expect(planManagerInvites([fin('ana@co.com'), team('d', 'Design', 'not-an-email')], false)).toEqual({ invites: [], errors: ['Design: enter a valid email.'] }))
  it('duplicate email across teams', () => expect(planManagerInvites([fin('a@co.com'), team('d', 'Design', 'A@co.com')], false).errors).toEqual(['a@co.com is entered for more than one team.']))
})
