import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionUser } from '@/lib/auth'
import { addDays } from 'date-fns'

// POST /api/campaigns/[id]/leads
// Body: { leads: [{ email, first_name, last_name, company, title, city, ...custom }] }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify campaign belongs to user
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, mailbox_id, sequence_id, daily_limit, start_date')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const body = await req.json()
  const rawLeads: any[] = body.leads ?? []

  if (!rawLeads.length) return NextResponse.json({ error: 'No leads provided' }, { status: 400 })

  // Get suppression list
  const { data: unsubs } = await supabaseAdmin
    .from('unsubscribes')
    .select('email')
    .eq('user_id', user.id)
  const suppressed = new Set((unsubs ?? []).map((u: any) => u.email.toLowerCase()))

  const validLeads = rawLeads.filter(l => l.email && !suppressed.has(l.email.toLowerCase()))

  // Upsert leads table
  const { data: insertedLeads, error: leadsErr } = await supabaseAdmin
    .from('leads')
    .upsert(
      validLeads.map(l => ({
        user_id: user.id,
        email: l.email.toLowerCase().trim(),
        first_name: l.first_name ?? l.firstName ?? null,
        last_name: l.last_name ?? l.lastName ?? null,
        company: l.company ?? null,
        title: l.title ?? null,
        city: l.city ?? null,
        custom_vars: l.custom_vars ?? {},
      })),
      { onConflict: 'user_id,email', ignoreDuplicates: false }
    )
    .select('id, email')

  if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 })

  // Get sequence to calculate first send time
  const { data: steps } = await supabaseAdmin
    .from('sequence_steps')
    .select('wait_days')
    .eq('sequence_id', campaign.sequence_id)
    .order('step_number')
    .limit(1)

  const firstWaitDays = steps?.[0]?.wait_days ?? 0
  const startDate = campaign.start_date ? new Date(campaign.start_date) : new Date()
  const nextSendAt = addDays(startDate, firstWaitDays)

  // Add to campaign_leads (skip dupes)
  const { data: existingCL } = await supabaseAdmin
    .from('campaign_leads')
    .select('lead_id')
    .eq('campaign_id', id)

  const existingIds = new Set((existingCL ?? []).map((cl: any) => cl.lead_id))
  const newLeads = (insertedLeads ?? []).filter((l: any) => !existingIds.has(l.id))

  if (newLeads.length) {
    const { error: clErr } = await supabaseAdmin
      .from('campaign_leads')
      .insert(
        newLeads.map((l: any) => ({
          campaign_id: id,
          lead_id: l.id,
          mailbox_id: campaign.mailbox_id,
          status: 'pending',
          current_step: 0,
          next_send_at: nextSendAt.toISOString(),
        }))
      )

    if (clErr) return NextResponse.json({ error: clErr.message }, { status: 500 })

    // Update campaign lead count
    await supabaseAdmin
      .from('campaigns')
      .update({ total_leads: supabaseAdmin.rpc('get_campaign_lead_count', { cid: id }) })
      .eq('id', id)
  }

  return NextResponse.json({
    added: newLeads.length,
    skipped: rawLeads.length - validLeads.length,
    duplicates: validLeads.length - newLeads.length,
    total: rawLeads.length,
  })
}

// GET /api/campaigns/[id]/leads — list leads with status
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') ?? '1')
  const limit = parseInt(url.searchParams.get('limit') ?? '50')
  const offset = (page - 1) * limit

  const { data, error, count } = await supabaseAdmin
    .from('campaign_leads')
    .select(`
      id, status, current_step, next_send_at, last_sent_at, replied_at,
      lead:leads(email, first_name, last_name, company)
    `, { count: 'exact' })
    .eq('campaign_id', id)
    .range(offset, offset + limit - 1)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count, page, limit })
}
