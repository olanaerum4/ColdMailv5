import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionUser } from '@/lib/auth'
import { subDays, format } from 'date-fns'

// GET /api/analytics?days=7&campaign_id=xxx
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const days = parseInt(url.searchParams.get('days') ?? '7')
  const campaignId = url.searchParams.get('campaign_id')

  const since = subDays(new Date(), days)

  // Sent emails in range
  let query = supabaseAdmin
    .from('sent_emails')
    .select('id, sent_at, opened_at, open_count, clicked_at, replied_at, bounced_at, campaign_id')
    .eq('user_id', user.id)
    .gte('sent_at', since.toISOString())

  if (campaignId) query = query.eq('campaign_id', campaignId)

  const { data: emailsRaw, error } = await query
  const emails = (emailsRaw ?? []) as any[]
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Build daily breakdown
  const dailyMap: Record<string, { date: string; sent: number; opened: number; replied: number; bounced: number }> = {}

  for (let i = 0; i < days; i++) {
    const d = format(subDays(new Date(), days - 1 - i), 'yyyy-MM-dd')
    dailyMap[d] = { date: d, sent: 0, opened: 0, replied: 0, bounced: 0 }
  }

  for (const email of emails) {
    const d = format(new Date(email.sent_at), 'yyyy-MM-dd')
    if (dailyMap[d]) {
      dailyMap[d].sent++
      if (email.opened_at) dailyMap[d].opened++
      if (email.replied_at) dailyMap[d].replied++
      if (email.bounced_at) dailyMap[d].bounced++
    }
  }

  const daily = Object.values(dailyMap)
  const totals = {
    sent: emails.length,
    opened: emails.filter((e: any) => e.opened_at).length,
    replied: emails.filter((e: any) => e.replied_at).length,
    bounced: emails.filter((e: any) => e.bounced_at).length,
  }

  // Campaign performance
  const { data: campaigns } = await supabaseAdmin
    .from('campaigns')
    .select('id, name, sent_count, open_count, reply_count, bounce_count')
    .eq('user_id', user.id)
    .order('sent_count', { ascending: false })
    .limit(10)

  // Mailbox breakdown
  const { data: mailboxStats } = await supabaseAdmin
    .from('mailboxes')
    .select('email, sent_today, sent_total')
    .eq('user_id', user.id)
    .order('sent_total', { ascending: false })

  return NextResponse.json({
    daily,
    totals,
    openRate: totals.sent ? Math.round((totals.opened / totals.sent) * 1000) / 10 : 0,
    replyRate: totals.sent ? Math.round((totals.replied / totals.sent) * 1000) / 10 : 0,
    bounceRate: totals.sent ? Math.round((totals.bounced / totals.sent) * 1000) / 10 : 0,
    campaigns: campaigns ?? [],
    mailboxes: mailboxStats ?? [],
  })
}
