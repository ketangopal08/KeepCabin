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

// Get inviter's display name from auth user metadata
  const authToken = (getHeader(event, 'authorization') ?? '').replace('Bearer ', '')
  const { data: { user: inviterUser } } = await supabase.auth.getUser(authToken)
  const inviterName: string = inviterUser?.user_metadata?.full_name ?? inviterUser?.email ?? ctx.org.name

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

  const inviteUrl = `${config.appUrl}/invite?token=${invite.token}`

  if (!config.brevoApiKey) {
    console.warn('[invite] BREVO_API_KEY not set — skipping email, invite URL:', inviteUrl)
    return { ok: true, inviteUrl }
  }

  const res = await $fetch<{ messageId?: string }>('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': config.brevoApiKey,
      'Content-Type': 'application/json',
    },
    body: {
      sender: { name: 'KeepCabin', email: config.brevoSenderEmail },
      to: [{ email: body.email }],
      subject: `You're invited to join ${ctx.org.name} on KeepCabin`,
      htmlContent: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>You're invited to KeepCabin</title></head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.07);">

        <!-- Header -->
        <tr><td align="center" style="padding:36px 40px 28px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;"><img src="${config.appUrl}/logo.png" width="32" height="32" alt="KeepCabin" style="display:block;border-radius:7px;"></td>
            <td style="padding-left:8px;font-size:17px;font-weight:600;color:#111;letter-spacing:-0.3px;vertical-align:middle;">KeepCabin</td>
          </tr></table>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:0 40px 36px;">
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#111;letter-spacing:-0.4px;">Hi there!</h1>
          <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#444;">
            <strong>${inviterName}</strong> with <strong>${ctx.org.name}</strong> has invited you to join KeepCabin as a <strong style="text-transform:capitalize;">${body.role}</strong>. Click the button below to set up your account and get started:
          </p>

          <!-- CTA button -->
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;"><tr>
            <td align="center" style="background:#111;border-radius:10px;">
              <a href="${inviteUrl}" style="display:inline-block;padding:8px 25px;font-size:14px;font-weight:600;color:#fff;text-decoration:none;letter-spacing:-0.2px;">Accept invitation</a>
            </td>
          </tr></table>

          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#555;">
            If you have any questions, feel free to reply to this email and we'll be happy to help.
          </p>

          <p style="margin:0 0 4px;font-size:14px;color:#555;">Welcome aboard,</p>
          <p style="margin:0;font-size:14px;font-weight:600;color:#333;">The KeepCabin Team</p>
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #eee;margin:0 0 24px;"></td></tr>

        <!-- Fallback URL -->
        <tr><td style="padding:0 40px 36px;">
          <p style="margin:0 0 8px;font-size:12px;color:#999;">If you're having trouble with the button above, copy and paste the URL below into your web browser:</p>
          <p style="margin:0;font-size:12px;color:#999;word-break:break-all;">${inviteUrl}</p>
        </td></tr>

      </table>

      <!-- Footer -->
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin-top:20px;">
        <tr><td align="center" style="padding:0 40px;">
          <p style="margin:0 0 4px;font-size:12px;color:#aaa;">© ${new Date().getFullYear()} KeepCabin. All rights reserved.</p>
          <p style="margin:0;font-size:12px;color:#bbb;">This invite expires in 7 days.</p>
        </td></tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`,
    },
  }).catch((e: any) => {
    const msg = e?.data?.message ?? e?.message ?? 'unknown'
    console.error('[invite] Brevo error:', JSON.stringify(e?.data ?? e))
    throw createError({ statusCode: 502, message: `Email failed: ${msg}` })
  })

  return { ok: true, messageId: res.messageId }
})
