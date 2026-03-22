# Outreach — Cold Email Platform

A self-hosted cold email platform built on Next.js 14 + Supabase. Supports Gmail (OAuth), Outlook (OAuth), and any custom SMTP/IMAP provider.

---

## Stack

- **Frontend**: Next.js 14 (App Router), TypeScript
- **Backend**: Next.js API Routes (serverless)
- **Database**: Supabase (PostgreSQL + RLS)
- **Email sending**: Nodemailer (SMTP + OAuth2)
- **Email receiving**: Gmail API + IMAP (mailparser)
- **Scheduling**: Vercel Cron Jobs
- **Deployment**: Vercel

---

## Features

- ✅ Connect unlimited mailboxes (Gmail OAuth, Outlook OAuth, custom SMTP)
- ✅ Multi-step email sequences with conditional follow-ups
- ✅ Bulk lead import via JSON or CSV upload
- ✅ Per-mailbox daily sending limits + rotation
- ✅ Oslo timezone-aware sending windows (weekdays only, 08–17)
- ✅ Human-like random delay between sends (jitter)
- ✅ Open tracking via invisible pixel
- ✅ Automatic reply detection (IMAP polling / Gmail API)
- ✅ Unified inbox with auto-classification (interested, not interested, OOO, bounce)
- ✅ Email warmup engine (ramp-up schedule, partner exchange)
- ✅ Global unsubscribe suppression list
- ✅ Analytics: daily stats, open rate, reply rate, per-campaign breakdown
- ✅ Full Row Level Security — all data isolated per user

---

## Setup

### 1. Clone & install

```bash
git clone <your-repo>
cd outreach-app
npm install
cp .env.local.example .env.local
```

### 2. Supabase

1. Create a new Supabase project at https://supabase.com
2. Go to **SQL Editor** and run `supabase/schema.sql`
3. Copy your project URL, anon key, and service role key into `.env.local`

### 3. Google OAuth (Gmail)

1. Go to https://console.cloud.google.com
2. Create a new project → Enable **Gmail API**
3. Create OAuth 2.0 credentials (Web application)
4. Add authorized redirect URI: `https://yourdomain.com/api/auth/google/callback`
5. Add to `.env.local`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback
   ```

### 4. Microsoft OAuth (Outlook)

1. Go to https://portal.azure.com → Azure Active Directory → App registrations
2. New registration → add redirect URI: `https://yourdomain.com/api/auth/microsoft/callback`
3. Add API permissions: `SMTP.Send`, `IMAP.AccessAsUser.All`, `offline_access`, `openid`, `email`
4. Create a client secret
5. Add to `.env.local`:
   ```
   MICROSOFT_CLIENT_ID=...
   MICROSOFT_CLIENT_SECRET=...
   MICROSOFT_REDIRECT_URI=https://yourdomain.com/api/auth/microsoft/callback
   ```

### 5. Encryption key

Generate a random 32-character string for encrypting stored SMTP passwords:

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

Add as `ENCRYPTION_KEY` in `.env.local`.

### 6. Cron secret

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Add as `CRON_SECRET` in `.env.local`.

### 7. Deploy to Vercel

```bash
npm install -g vercel
vercel --prod
```

Add all `.env.local` values as Vercel environment variables.

The `vercel.json` cron jobs will run automatically:
- `/api/send/process` — every 5 minutes (processes send queue)
- `/api/inbox` — every 10 minutes (polls for replies)
- `/api/warmup` — every hour (warmup sends)
- `/api/warmup` (PATCH) — daily at midnight (advance warmup day)

---

## API Reference

### Mailboxes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/mailboxes` | List all mailboxes |
| POST | `/api/mailboxes` | Add SMTP mailbox |
| DELETE | `/api/mailboxes/:id` | Remove mailbox |
| POST | `/api/mailboxes/:id` | Test connection |
| GET | `/api/auth/google?user_id=` | Start Gmail OAuth |
| GET | `/api/auth/microsoft?user_id=` | Start Outlook OAuth |

### Campaigns
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/campaigns` | List campaigns |
| POST | `/api/campaigns` | Create campaign |
| PATCH | `/api/campaigns/:id` | Update (status, settings) |
| DELETE | `/api/campaigns/:id` | Delete campaign |
| POST | `/api/campaigns/:id/leads` | Add leads to campaign |
| GET | `/api/campaigns/:id/leads` | List campaign leads |

### Sequences
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sequences` | List sequences |
| POST | `/api/sequences` | Create sequence + steps |
| PUT | `/api/sequences/:id` | Replace sequence + steps |
| DELETE | `/api/sequences/:id` | Delete sequence |

### Leads
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/leads` | List leads (paginated) |
| POST | `/api/leads` | Bulk import JSON or CSV |
| DELETE | `/api/leads` | Delete or unsubscribe |

### Inbox
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/inbox` | Get inbox messages |
| POST | `/api/inbox` | Poll mailboxes (cron) |

### Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analytics?days=7` | Get stats |

---

## CSV Import Format

```csv
email,first_name,last_name,company,title,city
per@hansens.no,Per,Hansen,Hansens Rørlegging,Daglig leder,Oslo
kari@blomster.no,Kari,Nilsen,Blomster & Co,Eier,Bergen
```

Custom columns are automatically available as `{{variabelNavn}}` in templates.

---

## Template Variables

Use `{{variabel}}` syntax in subject and body:

| Variable | Description |
|----------|-------------|
| `{{fornavn}}` | First name |
| `{{etternavn}}` | Last name |
| `{{bedrift}}` | Company |
| `{{stilling}}` | Job title |
| `{{by}}` | City |
| `{{customField}}` | Any CSV column |

---

## Sending Limits (recommended)

| Mailbox age | Daily limit |
|-------------|-------------|
| Day 1–7 | 20 |
| Day 8–21 | 35 |
| Day 22+ | 50 |
| Warmed (28+ days) | 80–100 |

---

## Local Development

```bash
npm run dev
```

To test cron jobs locally:
```bash
curl -X POST http://localhost:3000/api/send/process \
  -H "x-cron-secret: your-cron-secret"
```
