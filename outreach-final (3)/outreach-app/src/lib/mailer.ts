import nodemailer from 'nodemailer'
import { google } from 'googleapis'
import type { Mailbox } from '@/types'

// ─────────────────────────────────────────────
// ENCRYPTION for stored SMTP passwords
// ─────────────────────────────────────────────
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ENC_KEY = process.env.ENCRYPTION_KEY! // must be 32 chars
const ALGO = 'aes-256-cbc'

export function encryptPassword(plain: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGO, Buffer.from(ENC_KEY), iv)
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

export function decryptPassword(enc: string): string {
  const [ivHex, encHex] = enc.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const encBuf = Buffer.from(encHex, 'hex')
  const decipher = createDecipheriv(ALGO, Buffer.from(ENC_KEY), iv)
  return Buffer.concat([decipher.update(encBuf), decipher.final()]).toString()
}

// ─────────────────────────────────────────────
// GMAIL OAuth2 transporter
// ─────────────────────────────────────────────
async function getGmailTransporter(mailbox: Mailbox) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )

  oauth2Client.setCredentials({
    access_token: mailbox.access_token!,
    refresh_token: mailbox.refresh_token!,
    expiry_date: mailbox.token_expiry ? new Date(mailbox.token_expiry).getTime() : undefined,
  })

  // Auto-refresh if expired
  const { token } = await oauth2Client.getAccessToken()

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: mailbox.email,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: mailbox.refresh_token!,
      accessToken: token!,
    },
  })
}

// ─────────────────────────────────────────────
// Outlook OAuth2 transporter
// ─────────────────────────────────────────────
async function getOutlookTransporter(mailbox: Mailbox) {
  // Refresh access token via Microsoft OAuth
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
    refresh_token: mailbox.refresh_token!,
    grant_type: 'refresh_token',
    scope: 'https://outlook.office.com/SMTP.Send offline_access',
  })

  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  const { access_token } = await res.json()

  return nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    auth: {
      type: 'OAuth2',
      user: mailbox.email,
      accessToken: access_token,
    },
  })
}

// ─────────────────────────────────────────────
// Generic SMTP transporter
// ─────────────────────────────────────────────
function getSmtpTransporter(mailbox: Mailbox) {
  const password = mailbox.smtp_pass_enc ? decryptPassword(mailbox.smtp_pass_enc) : ''

  return nodemailer.createTransport({
    host: mailbox.smtp_host!,
    port: mailbox.smtp_port ?? 587,
    secure: mailbox.encryption === 'tls' && mailbox.smtp_port === 465,
    requireTLS: mailbox.encryption === 'starttls',
    auth: {
      user: mailbox.smtp_user ?? mailbox.email,
      pass: password,
    },
  })
}

// ─────────────────────────────────────────────
// Get transporter for any mailbox type
// ─────────────────────────────────────────────
export async function getTransporter(mailbox: Mailbox) {
  switch (mailbox.provider) {
    case 'gmail':
      return getGmailTransporter(mailbox)
    case 'outlook':
      return getOutlookTransporter(mailbox)
    default:
      return getSmtpTransporter(mailbox)
  }
}

// ─────────────────────────────────────────────
// Test mailbox connection
// ─────────────────────────────────────────────
export async function testMailboxConnection(mailbox: Mailbox): Promise<{ ok: boolean; error?: string }> {
  try {
    const transporter = await getTransporter(mailbox)
    await transporter.verify()
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

// ─────────────────────────────────────────────
// Fill template variables
// ─────────────────────────────────────────────
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

// ─────────────────────────────────────────────
// Add tracking pixel to HTML body
// ─────────────────────────────────────────────
export function addTrackingPixel(html: string, trackingId: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const pixel = `<img src="${appUrl}/api/track/open/${trackingId}" width="1" height="1" style="display:none" />`
  return html + pixel
}

// ─────────────────────────────────────────────
// Convert plain text body to simple HTML
// ─────────────────────────────────────────────
export function textToHtml(text: string): string {
  return text
    .split('\n')
    .map(line => `<p style="margin:0 0 8px;font-family:sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a">${line || '&nbsp;'}</p>`)
    .join('')
}

// ─────────────────────────────────────────────
// Core send function
// ─────────────────────────────────────────────
export interface SendEmailOptions {
  mailbox: Mailbox
  to: string
  subject: string
  bodyText: string
  trackingPixelId?: string
  inReplyTo?: string
  references?: string
}

export interface SendEmailResult {
  ok: boolean
  messageId?: string
  error?: string
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const transporter = await getTransporter(opts.mailbox)

    let htmlBody = textToHtml(opts.bodyText)
    if (opts.trackingPixelId) {
      htmlBody = addTrackingPixel(htmlBody, opts.trackingPixelId)
    }

    const fromName = opts.mailbox.display_name || opts.mailbox.email

    const info = await transporter.sendMail({
      from: `"${fromName}" <${opts.mailbox.email}>`,
      to: opts.to,
      subject: opts.subject,
      text: opts.bodyText,
      html: htmlBody,
      ...(opts.inReplyTo && { inReplyTo: opts.inReplyTo, references: opts.references ?? opts.inReplyTo }),
    })

    return { ok: true, messageId: info.messageId }
  } catch (err: any) {
    console.error(`[sendEmail] Failed to ${opts.to}:`, err.message)
    return { ok: false, error: err.message }
  }
}
