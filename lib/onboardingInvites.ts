// Turns the onboarding "Set up your teams" form into manager invites (pure — no imports).

export interface TeamDraft {
  id: string
  name: string
  isFinance: boolean
  managerEmail: string
}

export interface PlannedInvite {
  email: string
  role: 'manager' | 'finance'
  team_id: string
  team_name: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function planManagerInvites(
  teams: TeamDraft[],
  financeSelf: boolean,
): { invites: PlannedInvite[]; errors: string[] } {
  const errors: string[] = []
  const invites: PlannedInvite[] = []
  const seen = new Map<string, number>()

  for (const t of teams) {
    const email = t.managerEmail.trim().toLowerCase()

    if (t.isFinance) {
      if (financeSelf) continue
      if (!email) {
        errors.push("Add a Finance manager's email, or tick “I'll handle finance myself”.")
        continue
      }
    } else if (!email) {
      continue // manager is optional for other teams
    }

    if (!EMAIL_RE.test(email)) {
      errors.push(`${t.name}: enter a valid email.`)
      continue
    }

    seen.set(email, (seen.get(email) ?? 0) + 1)
    invites.push({ email, role: t.isFinance ? 'finance' : 'manager', team_id: t.id, team_name: t.name })
  }

  for (const [email, n] of seen) {
    if (n > 1) errors.push(`${email} is entered for more than one team.`)
  }

  return errors.length ? { invites: [], errors } : { invites, errors: [] }
}
