import { getOrgContext } from '~~/lib/org'
import { createClient } from '@supabase/supabase-js'
import type { OrgRole } from '~~/lib/supabase'

export default defineEventHandler(async (event) => {
  const ctx = await getOrgContext(event)
  if (!ctx) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const body = await readBody<{ email: string; role: OrgRole; team_id?: string }>(event)

  // Owner can invite manager/finance; manager can invite employee to their team
  if (ctx.member.role === 'owner' && !['manager', 'finance'].includes(body.role)) {
    throw createError({ statusCode: 403, message: 'Owner can only invite manager or finance' })
  }
  if (ctx.member.role === 'manager') {
    if (body.role !== 'employee') throw createError({ statusCode: 403, message: 'Manager can only invite employees' })
    body.team_id = ctx.member.team_id ?? undefined
  }
  if (!['owner', 'manager'].includes(ctx.member.role)) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.supabaseServiceKey)

  const { data: invite, error } = await supabase
    .from('invites')
    .insert({
      org_id: ctx.org.id,
      email: body.email.trim().toLowerCase(),
      role: body.role,
      team_id: body.team_id ?? null,
    })
    .select()
    .single()
  if (error) throw createError({ statusCode: 500, message: error.message })

  // Send email via Resend
  const inviteUrl = `${config.appUrl}/invite?token=${invite.token}`

  if (!config.resendApiKey) {
    console.warn('[invite] RESEND_API_KEY not set — skipping email, invite URL:', inviteUrl)
    return { ok: true, inviteUrl }
  }

  // Use onboarding@resend.dev for dev (works without domain verification).
  // Switch to a verified domain address in production.
  const fromAddress = config.appUrl?.startsWith('http://localhost')
    ? 'KeepCabin <onboarding@resend.dev>'
    : 'KeepCabin <noreply@keepcabin.app>'

  const res = await $fetch<{ id?: string; name?: string; message?: string }>('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: {
      from: fromAddress,
      to: [body.email],
      subject: `You're invited to join ${ctx.org.name} on KeepCabin`,
      html: `
        <p>Hi,</p>
        <p><strong>${ctx.org.name}</strong> has invited you to join KeepCabin as a <strong>${body.role}</strong>.</p>
        <p><a href="${inviteUrl}" style="background:#111;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;">Accept Invite</a></p>
        <p>This link expires in 7 days.</p>
      `,
    },
  }).catch((e: any) => {
    throw createError({ statusCode: 502, message: `Email failed: ${e?.data?.message ?? e?.message ?? 'unknown'}` })
  })

  return { ok: true, emailId: (res as any).id }
})
