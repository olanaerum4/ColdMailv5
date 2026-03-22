import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionUser } from '@/lib/auth'
import { testMailboxConnection } from '@/lib/mailer'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { error } = await supabaseAdmin.from('mailboxes').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: mailbox } = await supabaseAdmin.from('mailboxes').select('*').eq('id', id).eq('user_id', user.id).single()
  if (!mailbox) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const result = await testMailboxConnection(mailbox)
  await supabaseAdmin.from('mailboxes').update({ status: result.ok ? 'connected' : 'error', error_message: result.ok ? null : result.error }).eq('id', id)
  return NextResponse.json(result)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const allowed = ['daily_limit', 'display_name', 'warmup_enabled', 'status']
  const update: any = {}
  for (const key of allowed) { if (key in body) update[key] = body[key] }
  const { data, error } = await supabaseAdmin.from('mailboxes').update(update).eq('id', id).eq('user_id', user.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
