import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionUser } from '@/lib/auth'
import { pollMailboxForReplies } from '@/lib/imap'

// POST /api/inbox/poll — poll all mailboxes for new replies
// Called by cron every 10 minutes
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  const cron = req.headers.get('x-cron-secret')
  if (auth !== `Bearer ${cronSecret}` && cron !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get all connected mailboxes
  const { data: mailboxes } = await supabaseAdmin
    .from('mailboxes')
    .select('*')
    .eq('status', 'connected')

  if (!mailboxes?.length) return NextResponse.json({ polled: 0, new_messages: 0 })

  let totalNew = 0

  for (const mailbox of mailboxes) {
    try {
      const messages = await pollMailboxForReplies(mailbox)

      for (const msg of messages) {
        // Check if it's a reply to one of our sent emails
        let sentEmail = null
        if (msg.inReplyTo) {
          const { data } = await supabaseAdmin
            .from('sent_emails')
            .select('id, campaign_id, lead_id, campaign_lead_id, user_id')
            .eq('message_id', msg.inReplyTo)
            .single()
          sentEmail = data
        }

        // Skip if we already have this message
        const { count } = await supabaseAdmin
          .from('inbox_messages')
          .select('id', { count: 'exact', head: true })
          .eq('message_id', msg.messageId)

        if ((count ?? 0) > 0) continue

        // Classify the reply
        const classification = classifyReply(msg.subject ?? '', msg.textBody)

        const inboxMsg: any = {
          user_id: mailbox.user_id,
          mailbox_id: mailbox.id,
          from_email: msg.from,
          from_name: msg.fromName,
          subject: msg.subject,
          body_text: msg.textBody,
          body_html: msg.htmlBody,
          received_at: msg.receivedAt.toISOString(),
          classification,
          message_id: msg.messageId,
          in_reply_to: msg.inReplyTo,
        }

        if (sentEmail) {
          inboxMsg.campaign_id = sentEmail.campaign_id
          inboxMsg.lead_id = sentEmail.lead_id
          inboxMsg.sent_email_id = sentEmail.id

          // Mark campaign_lead as replied
          if (sentEmail.campaign_lead_id) {
            await supabaseAdmin.from('campaign_leads').update({
              status: 'replied',
              replied_at: msg.receivedAt.toISOString(),
            }).eq('id', sentEmail.campaign_lead_id)
          }

          // Update campaign reply count
          if (sentEmail.campaign_id) {
            await supabaseAdmin.rpc('increment_campaign_replies', { cid: sentEmail.campaign_id })
          }

          // Mark original sent email as replied
          await supabaseAdmin.from('sent_emails').update({
            replied_at: msg.receivedAt.toISOString(),
          }).eq('id', sentEmail.id)
        }

        await supabaseAdmin.from('inbox_messages').insert(inboxMsg)
        totalNew++
      }
    } catch (err: any) {
      console.error(`[inbox poll] Failed for ${mailbox.email}:`, err.message)
      await supabaseAdmin.from('mailboxes').update({
        status: 'error',
        error_message: `IMAP poll failed: ${err.message}`,
      }).eq('id', mailbox.id)
    }
  }

  return NextResponse.json({ polled: mailboxes.length, new_messages: totalNew })
}

// GET /api/inbox — get inbox messages
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const classification = url.searchParams.get('classification')
  const unread = url.searchParams.get('unread')

  let query = supabaseAdmin
    .from('inbox_messages')
    .select('*, mailbox:mailboxes(email)')
    .eq('user_id', user.id)
    .order('received_at', { ascending: false })
    .limit(100)

  if (classification) query = query.eq('classification', classification)
  if (unread === 'true') query = query.is('read_at', null)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

function classifyReply(subject: string, body: string): string {
  const text = (subject + ' ' + body).toLowerCase()

  if (/out.of.office|abwesend|fravær|ikke på kontor/i.test(text)) return 'out_of_office'
  if (/unsubscribe|avmeld|stopp|fjern meg/i.test(text)) return 'unsubscribed'
  if (/bounce|delivery.failure|failed|undeliverable/i.test(text)) return 'bounce'
  if (/interessert|ja takk|gjerne|kul|spennende|mer info|send mer|call|prat|demo|møte|meeting/i.test(text)) return 'interested'
  if (/ikke interessert|no thanks|nei takk|ikke aktuelt|fjern/i.test(text)) return 'not_interested'
  if (/booket|avtalt|kalender|calendar|invite/i.test(text)) return 'meeting_booked'

  return 'reply'
}
