import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionUser } from '@/lib/auth'

// GET /api/campaigns
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .select(`*, sequence:sequences(name), mailbox:mailboxes(email, provider)`)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/campaigns
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, sequence_id, mailbox_id, daily_limit, start_date, send_weekdays_only, rotate_mailboxes, mailbox_ids } = body

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .insert({
      user_id: user.id,
      name,
      sequence_id,
      mailbox_id,
      daily_limit: daily_limit ?? 50,
      start_date,
      send_weekdays_only: send_weekdays_only ?? true,
      rotate_mailboxes: rotate_mailboxes ?? false,
      mailbox_ids: mailbox_ids ?? [],
      status: 'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
