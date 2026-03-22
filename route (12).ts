import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { testMailboxConnection, encryptPassword } from '@/lib/mailer'
import { getSessionUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('mailboxes')
    .select('id, email, display_name, provider, daily_limit, sent_today, sent_total, status, error_message, warmup_enabled, warmup_day, spam_rate, created_at')
    .eq('user_id', user.id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { email, display_name, provider, smtp_host, smtp_port, smtp_user, smtp_pass, imap_host, imap_port, encryption, daily_limit } = body

  if (!email || !provider) return NextResponse.json({ error: 'email and provider required' }, { status: 400 })

  const insertData: any = { user_id: user.id, email, display_name, provider, daily_limit: daily_limit ?? 30, status: 'connected' }

  if (provider === 'smtp') {
    if (!smtp_pass) return NextResponse.json({ error: 'Password required for SMTP' }, { status: 400 })
    insertData.smtp_host = smtp_host
    insertData.smtp_port = smtp_port ?? 587
    insertData.smtp_user = smtp_user ?? email
    insertData.smtp_pass_enc = encryptPassword(smtp_pass)
    insertData.imap_host = imap_host
    insertData.imap_port = imap_port ?? 993
    insertData.encryption = encryption ?? 'tls'
  }

  const { data: mailbox, error: insertErr } = await supabaseAdmin.from('mailboxes').insert(insertData).select().single()
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  if (provider === 'smtp') {
    const test = await testMailboxConnection(mailbox)
    if (!test.ok) {
      await supabaseAdmin.from('mailboxes').update({ status: 'error', error_message: test.error }).eq('id', mailbox.id)
      return NextResponse.json({ ...mailbox, status: 'error', error_message: test.error })
    }
  }

  return NextResponse.json(mailbox, { status: 201 })
}
