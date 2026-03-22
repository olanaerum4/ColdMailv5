import Imap from 'imap'
import { simpleParser } from 'mailparser'
import { google } from 'googleapis'
import type { Mailbox } from '@/types'

// ─────────────────────────────────────────────
// Poll IMAP inbox for new replies
// ─────────────────────────────────────────────

interface ParsedMessage {
  messageId: string
  inReplyTo?: string
  from: string
  fromName?: string
  subject: string
  textBody: string
  htmlBody?: string
  receivedAt: Date
}

export async function pollMailboxForReplies(mailbox: Mailbox): Promise<ParsedMessage[]> {
  if (mailbox.provider === 'gmail') {
    return pollGmailReplies(mailbox)
  }
  return pollImapReplies(mailbox)
}

// ─────────────────────────────────────────────
// Gmail API polling (better than raw IMAP)
// ─────────────────────────────────────────────
async function pollGmailReplies(mailbox: Mailbox): Promise<ParsedMessage[]> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
  oauth2Client.setCredentials({
    access_token: mailbox.access_token!,
    refresh_token: mailbox.refresh_token!,
  })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  // Fetch unread messages from last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const query = `is:unread after:${Math.floor(since.getTime() / 1000)}`

  const listRes = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 50 })
  const messages = listRes.data.messages ?? []

  const results: ParsedMessage[] = []

  for (const msg of messages) {
    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id!, format: 'full' })
    const headers = full.data.payload?.headers ?? []

    const get = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''

    const body = extractGmailBody(full.data.payload)

    results.push({
      messageId: get('Message-ID'),
      inReplyTo: get('In-Reply-To') || undefined,
      from: extractEmail(get('From')),
      fromName: extractName(get('From')),
      subject: get('Subject'),
      textBody: body.text,
      htmlBody: body.html,
      receivedAt: new Date(parseInt(full.data.internalDate ?? '0')),
    })
  }

  return results
}

function extractGmailBody(payload: any): { text: string; html: string } {
  if (!payload) return { text: '', html: '' }

  if (payload.mimeType === 'text/plain') {
    return { text: Buffer.from(payload.body?.data ?? '', 'base64').toString(), html: '' }
  }
  if (payload.mimeType === 'text/html') {
    return { text: '', html: Buffer.from(payload.body?.data ?? '', 'base64').toString() }
  }

  let text = ''
  let html = ''
  for (const part of payload.parts ?? []) {
    const sub = extractGmailBody(part)
    if (!text && sub.text) text = sub.text
    if (!html && sub.html) html = sub.html
  }
  return { text, html }
}

// ─────────────────────────────────────────────
// Generic IMAP polling
// ─────────────────────────────────────────────
function pollImapReplies(mailbox: Mailbox): Promise<ParsedMessage[]> {
  return new Promise((resolve, reject) => {
    const { decryptPassword } = require('./mailer')
    const password = mailbox.smtp_pass_enc ? decryptPassword(mailbox.smtp_pass_enc) : ''

    const imap = new Imap({
      user: mailbox.smtp_user ?? mailbox.email,
      password,
      host: mailbox.imap_host ?? 'imap.gmail.com',
      port: mailbox.imap_port ?? 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    })

    const results: ParsedMessage[] = []

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) { imap.end(); reject(err); return }

        const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
        imap.search(['UNSEEN', ['SINCE', since]], (err, uids) => {
          if (err || !uids.length) { imap.end(); resolve([]); return }

          const fetch = imap.fetch(uids, { bodies: '', struct: true })

          fetch.on('message', (msg) => {
            let buffer = ''
            msg.on('body', stream => {
              stream.on('data', chunk => { buffer += chunk.toString('utf8') })
            })
            msg.once('end', async () => {
              try {
                const parsed = await simpleParser(buffer)
                results.push({
                  messageId: parsed.messageId ?? '',
                  inReplyTo: parsed.inReplyTo,
                  from: parsed.from?.value[0]?.address ?? '',
                  fromName: parsed.from?.value[0]?.name,
                  subject: parsed.subject ?? '',
                  textBody: parsed.text ?? '',
                  htmlBody: parsed.html || undefined,
                  receivedAt: parsed.date ?? new Date(),
                })
              } catch {}
            })
          })

          fetch.once('end', () => { imap.end() })
        })
      })
    })

    imap.once('end', () => resolve(results))
    imap.once('error', reject)
    imap.connect()
  })
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function extractEmail(from: string): string {
  const match = from.match(/<(.+?)>/)
  return match ? match[1] : from.trim()
}

function extractName(from: string): string {
  const match = from.match(/^(.+?)\s*</)
  return match ? match[1].replace(/^["']|["']$/g, '').trim() : ''
}
