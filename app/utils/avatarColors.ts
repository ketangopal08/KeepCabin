// Avatar colours — GitHub dark-mode palette (Primer scales): green, yellow, orange, red, pink, purple, blue.

/** Solid user-avatar backgrounds (scale step 4) — white initials on top. */
export const AVATAR_COLORS = [
  '#2ea043', // green
  '#bb8009', // yellow
  '#db6d28', // orange
  '#f85149', // red
  '#db61a2', // pink
  '#a371f7', // purple
  '#388bfd', // blue
]

/** Stable avatar colour for a person (same email/id → same colour). */
export function personColor(key: string | null | undefined): string {
  const s = key ?? '?'
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!
}

/** "Ketan Gopal" → "KG", "ketan@co.com" → "KE" */
export function personInitials(nameOrEmail: string | null | undefined): string {
  const s = (nameOrEmail ?? '').trim()
  if (!s) return '?'
  if (s.includes('@')) return s.split('@')[0]!.slice(0, 2).toUpperCase()
  return s.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

/** Team-tile gradients (scale step 2 → step 5 of the same hue) — white glyph on top. */
export const TEAM_GRADIENTS: [string, string][] = [
  ['#56d364', '#238636'], // green
  ['#e3b341', '#9e6a03'], // yellow
  ['#ffa657', '#bd561d'], // orange
  ['#ffa198', '#da3633'], // red
  ['#ff9bce', '#bf4b8a'], // pink
  ['#d2a8ff', '#8957e5'], // purple
  ['#79c0ff', '#1f6feb'], // blue
]
