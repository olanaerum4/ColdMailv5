import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendEmail, fillTemplate } from '@/lib/mailer'
import { addDays, isWeekend } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { v4 as uuidv4 } from 'uuid'

const OSLO_TZ = 'Europe/Oslo'

function authOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-cron-secret')
  return authHeader === `Bearer ${secret}` || cronHeader === secret
}

export async function POST(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await processQueue())
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await processQueue())
}

async function processQueue() {
  const now = new Date()
  const osloNow = toZonedTime(now, OSLO_TZ)

  const { data: campaigns } = await supabaseAdmin
    .from('campaigns')
    .select('*, mailbox:mailboxes(*), sequence:sequences(*, steps:sequence_steps(*))')
    .eq('status', 'active')

  if (!campaigns?.length) return { processed: 0, sent: 0, errors: 0 }

  let totalSent = 0
  let totalErrors = 0

  for (const campaign of campaigns) {
    if (!isWithinSendingWindow(osloNow, campaign)) continue

    const mailboxIds: string[] = campaign.rotate_mailboxes && campaign.mailbox_ids?.length
      ? campaign.mailbox_ids
      : [campaign.mailbox_id].filter(Boolean)

    if (!mailboxIds.length) continue

    // Fetch mailboxes and filter by daily limit in JS (avoids broken .filter() call)
    const { data: allMailboxes } = await supabaseAdmin
      .from('mailboxes')
      .select('*')
      .in('id', mailboxIds)
      .eq('status', 'connected')

    const availableMailboxes = (allMailboxes ?? []).filter(mb => mb.sent_today < mb.daily_limit)
    if (!availableMailboxes.length) continue

    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const { count: sentTodayCount } = await supabaseAdmin
      .from('sent_emails')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .gte('sent_at', todayStart.toISOString())

    if ((sentTodayCount ?? 0) >= campaign.daily_limit) continue

    const remainingToday = campaign.daily_limit - (sentTodayCount ?? 0)

    const { data: dueleads } = await supabaseAdmin
      .from('campaign_leads')
      .select('*, lead:leads(*)')
      .eq('campaign_id', campaign.id)
      .in('status', ['pending', 'in_sequence'])
      .lte('next_send_at', now.toISOString())
      .limit(Math.min(remainingToday, 50))
      .order('next_send_at')

    if (!dueleads?.length) continue

    const steps: any[] = (campaign.sequence?.steps ?? []).sort((a: any, b: any) => a.step_number - b.step_number)

    for (const cl of dueleads) {
      if (totalSent >= 200) break

      const step = steps[cl.current_step]
      if (!step) {
        await supabaseAdmin.from('campaign_leads').update({ status: 'completed' }).eq('id', cl.id)
        continue
      }

      const mailbox = availableMailboxes[totalSent % availableMailboxes.length]
      const lead = cl.lead
      const vars: Record<string, string> = {
        fornavn: lead.first_name ?? '',
        etternavn: lead.last_name ?? '',
        bedrift: lead.company ?? '',
        stilling: lead.title ?? '',
        by: lead.city ?? '',
        ...(lead.custom_vars ?? {}),
      }

      const subject = fillTemplate(step.subject, vars)
      const body = fillTemplate(step.body, vars)
      const trackingId = uuidv4()

      // Human-like jitter: 5–60 seconds
      await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 55000))

      const result = await sendEmail({ mailbox, to: lead.email, subject, bodyText: body, trackingPixelId: trackingId })

      if (result.ok) {
        totalSent++

        await supabaseAdmin.from('sent_emails').insert({
          user_id: campaign.user_id,
          campaign_id: campaign.id,
          campaign_lead_id: cl.id,
          mailbox_id: mailbox.id,
          lead_id: lead.id,
          to_email: lead.email,
          subject,
          body_text: body,
          message_id: result.messageId,
          tracking_pixel_id: trackingId,
          step_number: cl.current_step,
          sent_at: new Date().toISOString(),
        })

        const nextStep = steps[cl.current_step + 1]
        const nextSendAt = nextStep ? addDays(new Date(), nextStep.wait_days || 1).toISOString() : null

        await supabaseAdmin.from('campaign_leads').update({
          status: nextStep ? 'in_sequence' : 'completed',
          current_step: cl.current_step + 1,
          last_sent_at: new Date().toISOString(),
          next_send_at: nextSendAt,
        }).eq('id', cl.id)

        await supabaseAdmin.from('mailboxes').update({
          sent_today: mailbox.sent_today + 1,
          sent_total: mailbox.sent_total + 1,
          last_sent_at: new Date().toISOString(),
        }).eq('id', mailbox.id)

        await supabaseAdmin.from('campaigns').update({
          sent_count: campaign.sent_count + 1,
        }).eq('id', campaign.id)

      } else {
        totalErrors++
        console.error(`[cron] Send failed for ${lead.email}: ${result.error}`)
        if (result.error?.includes('bounce') || result.error?.includes('550')) {
          await supabaseAdmin.from('campaign_leads').update({
            status: 'bounced',
            bounced_at: new Date().toISOString(),
          }).eq('id', cl.id)
        }
      }
    }
  }

  return { processed: campaigns.length, sent: totalSent, errors: totalErrors }
}

function isWithinSendingWindow(osloNow: Date, campaign: any): boolean {
  if (campaign.send_weekdays_only && isWeekend(osloNow)) return false
  const hour = osloNow.getHours()
  return hour >= (campaign.send_start_hour ?? 8) && hour < (campaign.send_end_hour ?? 17)
}
