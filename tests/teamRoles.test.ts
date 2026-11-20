import { describe, it, expect } from 'vitest'
import { isFinanceTeamName, roleForTeam } from '../lib/teamRoles'

describe('isFinanceTeamName', () => {
  it('matches Finance case/space-insensitively', () => {
    expect(isFinanceTeamName('Finance')).toBe(true)
    expect(isFinanceTeamName(' finance ')).toBe(true)
    expect(isFinanceTeamName('FINANCE')).toBe(true)
  })
  it('other teams are not finance', () => {
    expect(isFinanceTeamName('design')).toBe(false)
    expect(isFinanceTeamName('Finance Ops')).toBe(false)
    expect(isFinanceTeamName(null)).toBe(false)
  })
})

describe('roleForTeam', () => {
  it('manager of Finance team → finance', () => expect(roleForTeam('manager', 'Finance')).toBe('finance'))
  it('employee of Finance team → finance', () => expect(roleForTeam('employee', 'Finance')).toBe('finance'))
  it('finance stays finance', () => expect(roleForTeam('finance', 'Finance')).toBe('finance'))
  it('manager of design stays manager', () => expect(roleForTeam('manager', 'design')).toBe('manager'))
  it('no team → unchanged', () => expect(roleForTeam('manager', null)).toBe('manager'))
})
