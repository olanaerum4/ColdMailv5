-- ============================================================
-- OUTREACH PLATFORM — SUPABASE SCHEMA
-- Run in Supabase SQL editor or via: node scripts/migrate.js
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- MAILBOXES
-- ============================================================
create table if not exists mailboxes (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  email         text not null,
  display_name  text,
  provider      text not null check (provider in ('gmail','outlook','smtp')),

  -- OAuth tokens (for gmail/outlook)
  access_token  text,
  refresh_token text,
  token_expiry  timestamptz,

  -- SMTP/IMAP credentials (encrypted at rest via pgcrypto)
  smtp_host     text,
  smtp_port     int default 587,
  smtp_user     text,
  smtp_pass_enc text,   -- AES encrypted
  imap_host     text,
  imap_port     int default 993,
  encryption    text default 'tls',

  -- Limits & stats
  daily_limit   int default 30,
  sent_today    int default 0,
  sent_total    int default 0,
  last_sent_at  timestamptz,

  -- Status: connected | warming | error | paused
  status        text default 'connected',
  error_message text,

  -- Warmup
  warmup_enabled    boolean default false,
  warmup_day        int default 0,
  warmup_target_day int default 28,
  warmup_daily_sent int default 0,
  spam_rate         numeric(5,2) default 0,

  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists mailboxes_user_id_idx on mailboxes(user_id);
create unique index if not exists mailboxes_email_user_idx on mailboxes(user_id, email);

-- ============================================================
-- SEQUENCES (email templates with steps)
-- ============================================================
create table if not exists sequences (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  description text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists sequence_steps (
  id              uuid primary key default uuid_generate_v4(),
  sequence_id     uuid references sequences(id) on delete cascade not null,
  step_number     int not null,
  subject         text not null,
  body            text not null,
  wait_days       int default 0,   -- days to wait after previous step
  only_if_no_reply boolean default true,
  created_at      timestamptz default now()
);

create index if not exists seq_steps_seq_idx on sequence_steps(sequence_id, step_number);

-- ============================================================
-- LEADS
-- ============================================================
create table if not exists leads (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  email       text not null,
  first_name  text,
  last_name   text,
  company     text,
  title       text,
  city        text,
  custom_vars jsonb default '{}',
  tags        text[] default '{}',
  unsubscribed boolean default false,
  unsubscribed_at timestamptz,
  created_at  timestamptz default now()
);

create index if not exists leads_user_id_idx on leads(user_id);
create index if not exists leads_email_idx on leads(email);

-- ============================================================
-- CAMPAIGNS
-- ============================================================
create table if not exists campaigns (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  name          text not null,
  sequence_id   uuid references sequences(id),
  mailbox_id    uuid references mailboxes(id),

  -- Status: draft | active | paused | completed | archived
  status        text default 'draft',

  daily_limit   int default 50,
  start_date    date,
  end_date      date,

  -- Sending window (Oslo time)
  send_start_hour int default 8,
  send_end_hour   int default 17,
  send_weekdays_only boolean default true,

  -- Rotate mailboxes
  rotate_mailboxes boolean default false,
  mailbox_ids      uuid[] default '{}',

  -- Stats (denormalized for perf)
  total_leads   int default 0,
  sent_count    int default 0,
  open_count    int default 0,
  click_count   int default 0,
  reply_count   int default 0,
  bounce_count  int default 0,
  unsubscribe_count int default 0,

  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists campaigns_user_id_idx on campaigns(user_id);
create index if not exists campaigns_status_idx on campaigns(status);

-- ============================================================
-- CAMPAIGN LEADS (many-to-many with sequence state)
-- ============================================================
create table if not exists campaign_leads (
  id              uuid primary key default uuid_generate_v4(),
  campaign_id     uuid references campaigns(id) on delete cascade not null,
  lead_id         uuid references leads(id) on delete cascade not null,
  mailbox_id      uuid references mailboxes(id),

  -- Status: pending | in_sequence | replied | bounced | unsubscribed | completed
  status          text default 'pending',
  current_step    int default 0,
  next_send_at    timestamptz,
  last_sent_at    timestamptz,
  replied_at      timestamptz,
  bounced_at      timestamptz,

  created_at      timestamptz default now(),
  unique(campaign_id, lead_id)
);

create index if not exists campaign_leads_campaign_idx on campaign_leads(campaign_id);
create index if not exists campaign_leads_next_send_idx on campaign_leads(next_send_at) where status = 'pending' or status = 'in_sequence';

-- ============================================================
-- SENT EMAILS (full audit log)
-- ============================================================
create table if not exists sent_emails (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  campaign_id     uuid references campaigns(id) on delete set null,
  campaign_lead_id uuid references campaign_leads(id) on delete set null,
  mailbox_id      uuid references mailboxes(id) on delete set null,
  lead_id         uuid references leads(id) on delete set null,

  to_email        text not null,
  subject         text not null,
  body_html       text,
  body_text       text,
  message_id      text unique,   -- SMTP message-id for tracking
  thread_id       text,          -- Gmail thread id

  -- Tracking
  tracking_pixel_id text unique default uuid_generate_v4()::text,
  opened_at       timestamptz,
  open_count      int default 0,
  clicked_at      timestamptz,
  click_count     int default 0,
  replied_at      timestamptz,
  bounced_at      timestamptz,
  bounce_type     text,         -- hard | soft

  sent_at         timestamptz default now(),
  step_number     int
);

create index if not exists sent_emails_user_idx on sent_emails(user_id);
create index if not exists sent_emails_campaign_idx on sent_emails(campaign_id);
create index if not exists sent_emails_tracking_idx on sent_emails(tracking_pixel_id);
create index if not exists sent_emails_message_id_idx on sent_emails(message_id);

-- ============================================================
-- INBOX (inbound replies)
-- ============================================================
create table if not exists inbox_messages (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  mailbox_id      uuid references mailboxes(id),
  campaign_id     uuid references campaigns(id),
  lead_id         uuid references leads(id),
  sent_email_id   uuid references sent_emails(id),

  from_email      text not null,
  from_name       text,
  subject         text,
  body_text       text,
  body_html       text,
  received_at     timestamptz default now(),
  read_at         timestamptz,

  -- Classification: reply | bounce | out_of_office | interested | not_interested | meeting_booked
  classification  text default 'reply',

  message_id      text,
  thread_id       text,
  in_reply_to     text
);

create index if not exists inbox_user_idx on inbox_messages(user_id);
create index if not exists inbox_read_idx on inbox_messages(user_id, read_at) where read_at is null;

-- ============================================================
-- WARMUP POOL (emails exchanged for warmup)
-- ============================================================
create table if not exists warmup_emails (
  id              uuid primary key default uuid_generate_v4(),
  from_mailbox_id uuid references mailboxes(id) on delete cascade,
  to_mailbox_id   uuid references mailboxes(id) on delete cascade,
  subject         text,
  body            text,
  sent_at         timestamptz default now(),
  replied_at      timestamptz,
  moved_to_inbox  boolean default false
);

-- ============================================================
-- UNSUBSCRIBES (global suppression list)
-- ============================================================
create table if not exists unsubscribes (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  email      text not null,
  created_at timestamptz default now(),
  unique(user_id, email)
);

-- ============================================================
-- DAILY STATS (for analytics, populated by cron)
-- ============================================================
create table if not exists daily_stats (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  campaign_id uuid references campaigns(id) on delete cascade,
  date        date not null,
  sent        int default 0,
  opened      int default 0,
  clicked     int default 0,
  replied     int default 0,
  bounced     int default 0,
  unique(user_id, campaign_id, date)
);

-- ============================================================
-- RLS POLICIES
-- ============================================================
alter table mailboxes enable row level security;
alter table sequences enable row level security;
alter table sequence_steps enable row level security;
alter table leads enable row level security;
alter table campaigns enable row level security;
alter table campaign_leads enable row level security;
alter table sent_emails enable row level security;
alter table inbox_messages enable row level security;
alter table unsubscribes enable row level security;
alter table daily_stats enable row level security;

-- Mailboxes
create policy "Users manage own mailboxes" on mailboxes
  for all using (auth.uid() = user_id);

-- Sequences
create policy "Users manage own sequences" on sequences
  for all using (auth.uid() = user_id);
create policy "Users manage own sequence steps" on sequence_steps
  for all using (
    exists (select 1 from sequences s where s.id = sequence_id and s.user_id = auth.uid())
  );

-- Leads
create policy "Users manage own leads" on leads
  for all using (auth.uid() = user_id);

-- Campaigns
create policy "Users manage own campaigns" on campaigns
  for all using (auth.uid() = user_id);

-- Campaign leads
create policy "Users manage own campaign leads" on campaign_leads
  for all using (
    exists (select 1 from campaigns c where c.id = campaign_id and c.user_id = auth.uid())
  );

-- Sent emails
create policy "Users view own sent emails" on sent_emails
  for all using (auth.uid() = user_id);

-- Inbox
create policy "Users manage own inbox" on inbox_messages
  for all using (auth.uid() = user_id);

-- Unsubscribes
create policy "Users manage own unsubscribes" on unsubscribes
  for all using (auth.uid() = user_id);

-- Daily stats
create policy "Users view own stats" on daily_stats
  for all using (auth.uid() = user_id);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger mailboxes_updated_at before update on mailboxes
  for each row execute function update_updated_at();
create trigger campaigns_updated_at before update on campaigns
  for each row execute function update_updated_at();
create trigger sequences_updated_at before update on sequences
  for each row execute function update_updated_at();

-- Reset daily sent counts at midnight (called from cron)
create or replace function reset_daily_sent()
returns void as $$
begin
  update mailboxes set sent_today = 0;
end;
$$ language plpgsql security definer;

-- ============================================================
-- MISSING RPC FUNCTIONS (referenced in API routes)
-- ============================================================

create or replace function increment_campaign_opens(cid uuid)
returns void as $$
  update campaigns set open_count = open_count + 1 where id = cid;
$$ language sql security definer;

create or replace function increment_campaign_replies(cid uuid)
returns void as $$
  update campaigns set reply_count = reply_count + 1 where id = cid;
$$ language sql security definer;

create or replace function get_campaign_lead_count(cid uuid)
returns int as $$
  select count(*)::int from campaign_leads where campaign_id = cid;
$$ language sql security definer;
