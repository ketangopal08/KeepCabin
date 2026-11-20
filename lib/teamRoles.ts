// Role rules tied to a team (pure — no imports).
// Anyone placed in the Finance team gets the `finance` role: Finance work (review, approve, pay)
// is granted by that role, so a Finance-team "manager" or "employee" would otherwise see none of it.

type Role = 'owner' | 'manager' | 'finance' | 'employee'

export function isFinanceTeamName(name: string | null | undefined): boolean {
  return (name ?? '').trim().toLowerCase() === 'finance'
}

export function roleForTeam<R extends Role>(role: R, teamName: string | null | undefined): R | 'finance' {
  if (isFinanceTeamName(teamName) && (role === 'manager' || role === 'employee')) return 'finance'
  return role
}
