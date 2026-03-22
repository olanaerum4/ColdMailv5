export interface Mailbox {
  id: string
  user_id: string
  email: string
  display_name?: string
  provider: 'gmail' | 'outlook' | 'smtp'
  access_token?: string
  refresh_token?: string
  token_expiry?: string
  smtp_host?: string
  smtp_port?: number
  smtp_user?: string
  smtp_pass_enc?: string
  imap_host?: string
  imap_port?: number
  encryption?: string
  daily_limit: number
  sent_today: number
  sent_total: number
  last_sent_at?: string
  status: 'connected' | 'warming' | 'error' | 'paused'
  error_message?: string
  warmup_enabled: boolean
  warmup_day: number
  warmup_target_day: number
  warmup_daily_sent: number
  spam_rate: number
  created_at: string
  updated_at: string
}

export interface Sequence {
  id: string
  user_id: string
  name: string
  description?: string
  steps?: SequenceStep[]
  created_at: string
  updated_at: string
}

export interface SequenceStep {
  id: string
  sequence_id: string
  step_number: number
  subject: string
  body: string
  wait_days: number
  only_if_no_reply: boolean
}

export interface Lead {
  id: string
  user_id: string
  email: string
  first_name?: string
  last_name?: string
  company?: string
  title?: string
  city?: string
  custom_vars?: Record<string, string>
  tags?: string[]
  unsubscribed: boolean
  unsubscribed_at?: string
  created_at: string
}

export interface Campaign {
  id: string
  user_id: string
  name: string
  sequence_id?: string
  mailbox_id?: string
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived'
  daily_limit: number
  start_date?: string
  end_date?: string
  send_start_hour: number
  send_end_hour: number
  send_weekdays_only: boolean
  rotate_mailboxes: boolean
  mailbox_ids?: string[]
  total_leads: number
  sent_count: number
  open_count: number
  click_count: number
  reply_count: number
  bounce_count: number
  unsubscribe_count: number
  created_at: string
  updated_at: string
}

export interface CampaignLead {
  id: string
  campaign_id: string
  lead_id: string
  mailbox_id?: string
  status: 'pending' | 'in_sequence' | 'replied' | 'bounced' | 'unsubscribed' | 'completed'
  current_step: number
  next_send_at?: string
  last_sent_at?: string
  replied_at?: string
  bounced_at?: string
  lead?: Lead
}

export interface SentEmail {
  id: string
  user_id: string
  campaign_id?: string
  mailbox_id?: string
  lead_id?: string
  to_email: string
  subject: string
  body_text?: string
  message_id?: string
  tracking_pixel_id: string
  opened_at?: string
  open_count: number
  replied_at?: string
  bounced_at?: string
  sent_at: string
  step_number?: number
}

export interface InboxMessage {
  id: string
  user_id: string
  mailbox_id?: string
  campaign_id?: string
  lead_id?: string
  from_email: string
  from_name?: string
  subject?: string
  body_text?: string
  body_html?: string
  received_at: string
  read_at?: string
  classification: 'reply' | 'bounce' | 'out_of_office' | 'interested' | 'not_interested' | 'meeting_booked'
  message_id?: string
  in_reply_to?: string
}

// Minimal Supabase database type placeholder
export type Database = any
