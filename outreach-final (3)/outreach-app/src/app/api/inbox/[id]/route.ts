import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionUser } from '@/lib/auth'

// PATCH /api/inbox/[id] — mark read, update classification
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = ['read_at', 'classification']
  const update: any = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  const { data, error } = await supabaseAdmin
    .from('inbox_messages')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/inbox/[id]/reply — send a reply to an inbox message
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { body: replyBody } = await req.json()
  if (!replyBody?.trim()) return NextResponse.json({ error: 'body required' }, { status: 400 })

  // Fetch the inbox message to find the mailbox + original message id
  const { data: msg } = await supabaseAdmin
    .from('inbox_messages')
    .select('*, mailbox:mailboxes(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  if (!msg.mailbox) return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 })

  const { sendEmail } = await import('@/lib/mailer')

  const result = await sendEmail({
    mailbox: msg.mailbox,
    to: msg.from_email,
    subject: msg.subject?.startsWith('Re:') ? msg.subject : `Re: ${msg.subject ?? ''}`,
    bodyText: replyBody,
    inReplyTo: msg.message_id ?? undefined,
    references: msg.message_id ?? undefined,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })

  // Mark original as read
  await supabaseAdmin.from('inbox_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ ok: true, messageId: result.messageId })
}
