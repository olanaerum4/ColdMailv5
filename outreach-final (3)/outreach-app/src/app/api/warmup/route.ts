import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionUser } from '@/lib/auth'
import { sendEmail } from '@/lib/mailer'

const WARMUP_SUBJECTS = [
  'Quick follow-up', 'Checking in', 'Re: Our conversation',
  'A quick question', 'Just wanted to share', 'Important update',
]

const WARMUP_BODIES = [
  `Hi,\n\nJust wanted to follow up on our previous conversation. Let me know if you have any questions.\n\nBest regards`,
  `Hello,\n\nI hope this email finds you well. I wanted to check in and see if there's anything I can help with.\n\nThanks`,
  `Hi there,\n\nI wanted to reach out and share a quick update. Everything is going well on our end.\n\nBest`,
  `Hello,\n\nJust a quick note to say thank you for your time. Looking forward to our next conversation.\n\nKind regards`,
]

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-cron-secret')
  const secret = process.env.CRON_SECRET
  if (authHeader !== `Bearer ${secret}` && cronHeader !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: mailboxes } = await supabaseAdmin
    .from('mailboxes').select('*').eq('warmup_enabled', true).neq('status', 'error')

  if (!mailboxes?.length) return NextResponse.json({ warmed: 0 })

  let totalSent = 0

  for (const mailbox of mailboxes) {
    const day = mailbox.warmup_day ?? 0
    const targetPerDay = calculateWarmupVolume(day)
    if (mailbox.warmup_daily_sent >= targetPerDay) continue

    const { data: partners } = await supabaseAdmin
      .from('mailboxes').select('*').neq('id', mailbox.id).eq('status', 'connected').limit(5)

    if (!partners?.length) continue

    const partner = partners[Math.floor(Math.random() * partners.length)]
    const subject = WARMUP_SUBJECTS[Math.floor(Math.random() * WARMUP_SUBJECTS.length)]
    const body = WARMUP_BODIES[Math.floor(Math.random() * WARMUP_BODIES.length)]

    const result = await sendEmail({ mailbox, to: partner.email, subject, bodyText: body })

    if (result.ok) {
      totalSent++
      await supabaseAdmin.from('warmup_emails').insert({
        from_mailbox_id: mailbox.id, to_mailbox_id: partner.id, subject, body,
      })
      await supabaseAdmin.from('mailboxes').update({
        warmup_daily_sent: (mailbox.warmup_daily_sent ?? 0) + 1,
        sent_today: (mailbox.sent_today ?? 0) + 1,
      }).eq('id', mailbox.id)
    }
  }

  return NextResponse.json({ warmed: totalSent })
}

export async function PATCH(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-cron-secret')
  const secret = process.env.CRON_SECRET
  if (authHeader !== `Bearer ${secret}` && cronHeader !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: mailboxes } = await supabaseAdmin
    .from('mailboxes').select('id, warmup_day, warmup_target_day').eq('warmup_enabled', true)

  for (const mb of mailboxes ?? []) {
    const newDay = (mb.warmup_day ?? 0) + 1
    const completed = newDay >= (mb.warmup_target_day ?? 28)
    await supabaseAdmin.from('mailboxes').update({
      warmup_day: newDay,
      warmup_daily_sent: 0,
      status: completed ? 'connected' : 'warming',
      warmup_enabled: !completed,
    }).eq('id', mb.id)
  }

  return NextResponse.json({ advanced: mailboxes?.length ?? 0 })
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('mailboxes')
    .select('id, email, warmup_enabled, warmup_day, warmup_target_day, warmup_daily_sent, spam_rate, status')
    .eq('user_id', user.id)
    .order('created_at')

  return NextResponse.json(data ?? [])
}

function calculateWarmupVolume(day: number): number {
  if (day <= 3) return 5
  if (day <= 7) return 10
  if (day <= 14) return 20
  if (day <= 21) return 35
  return 50
}
