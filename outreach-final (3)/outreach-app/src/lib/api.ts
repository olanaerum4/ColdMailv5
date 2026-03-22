// Typed API client — all frontend → backend calls go through here

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `API error ${res.status}`)
  }
  return res.json()
}

// ── Mailboxes ──────────────────────────────────────────────
export const mailboxesApi = {
  list: () => apiFetch<any[]>('/api/mailboxes'),

  add: (data: {
    email: string
    provider: 'gmail' | 'outlook' | 'smtp'
    display_name?: string
    smtp_host?: string
    smtp_port?: number
    smtp_user?: string
    smtp_pass?: string
    imap_host?: string
    imap_port?: number
    encryption?: string
    daily_limit?: number
  }) => apiFetch<any>('/api/mailboxes', { method: 'POST', body: JSON.stringify(data) }),

  remove: (id: string) => apiFetch<{ ok: boolean }>(`/api/mailboxes/${id}`, { method: 'DELETE' }),

  test: (id: string) => apiFetch<{ ok: boolean; error?: string }>(`/api/mailboxes/${id}`, { method: 'POST' }),

  startGmailOAuth: (userId: string) => {
    window.location.href = `/api/auth/google?user_id=${userId}`
  },

  startOutlookOAuth: (userId: string) => {
    window.location.href = `/api/auth/microsoft?user_id=${userId}`
  },
}

// ── Campaigns ─────────────────────────────────────────────
export const campaignsApi = {
  list: () => apiFetch<any[]>('/api/campaigns'),

  create: (data: {
    name: string
    sequence_id?: string
    mailbox_id?: string
    daily_limit?: number
    start_date?: string
    send_weekdays_only?: boolean
    rotate_mailboxes?: boolean
    mailbox_ids?: string[]
  }) => apiFetch<any>('/api/campaigns', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<{ name: string; status: string; daily_limit: number; mailbox_id: string; sequence_id: string }>) =>
    apiFetch<any>(`/api/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  remove: (id: string) => apiFetch<{ ok: boolean }>(`/api/campaigns/${id}`, { method: 'DELETE' }),

  addLeads: (campaignId: string, leads: any[]) =>
    apiFetch<{ added: number; skipped: number; duplicates: number; total: number }>(
      `/api/campaigns/${campaignId}/leads`,
      { method: 'POST', body: JSON.stringify({ leads }) }
    ),

  getLeads: (campaignId: string, page = 1) =>
    apiFetch<{ data: any[]; count: number }>(`/api/campaigns/${campaignId}/leads?page=${page}`),
}

// ── Sequences ─────────────────────────────────────────────
export const sequencesApi = {
  list: () => apiFetch<any[]>('/api/sequences'),

  create: (data: { name: string; description?: string; steps: any[] }) =>
    apiFetch<any>('/api/sequences', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: { name: string; description?: string; steps: any[] }) =>
    apiFetch<any>(`/api/sequences/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  remove: (id: string) => apiFetch<{ ok: boolean }>(`/api/sequences/${id}`, { method: 'DELETE' }),
}

// ── Leads ─────────────────────────────────────────────────
export const leadsApi = {
  list: (page = 1, search = '') =>
    apiFetch<{ data: any[]; count: number }>(`/api/leads?page=${page}&search=${encodeURIComponent(search)}`),

  importJSON: (leads: any[]) =>
    apiFetch<{ imported: number; invalid: number; suppressed: number; total: number }>(
      '/api/leads', { method: 'POST', body: JSON.stringify({ leads }) }
    ),

  importCSV: (csvText: string) =>
    apiFetch<{ imported: number; invalid: number; suppressed: number; total: number }>(
      '/api/leads', { method: 'POST', body: csvText, headers: { 'Content-Type': 'text/csv' } as any }
    ),

  unsubscribe: (emails: string[]) =>
    apiFetch<{ ok: boolean }>('/api/leads', { method: 'DELETE', body: JSON.stringify({ emails, action: 'unsubscribe' }) }),

  remove: (ids: string[]) =>
    apiFetch<{ ok: boolean }>('/api/leads', { method: 'DELETE', body: JSON.stringify({ ids, action: 'delete' }) }),
}

// ── Inbox ─────────────────────────────────────────────────
export const inboxApi = {
  list: (classification?: string, unread?: boolean) => {
    const params = new URLSearchParams()
    if (classification) params.set('classification', classification)
    if (unread) params.set('unread', 'true')
    return apiFetch<any[]>(`/api/inbox?${params}`)
  },

  markRead: (id: string) =>
    apiFetch<any>(`/api/inbox/${id}`, { method: 'PATCH', body: JSON.stringify({ read_at: new Date().toISOString() }) }),

  reply: (id: string, body: string) =>
    apiFetch<any>(`/api/inbox/${id}/reply`, { method: 'POST', body: JSON.stringify({ body }) }),
}

// ── Analytics ─────────────────────────────────────────────
export const analyticsApi = {
  get: (days = 7, campaignId?: string) => {
    const params = new URLSearchParams({ days: String(days) })
    if (campaignId) params.set('campaign_id', campaignId)
    return apiFetch<any>(`/api/analytics?${params}`)
  },
}

// ── Warmup ────────────────────────────────────────────────
export const warmupApi = {
  list: () => apiFetch<any[]>('/api/warmup'),

  enable: (mailboxId: string) =>
    apiFetch<any>(`/api/mailboxes/${mailboxId}`, {
      method: 'PATCH',
      body: JSON.stringify({ warmup_enabled: true, status: 'warming' }),
    }),
}
