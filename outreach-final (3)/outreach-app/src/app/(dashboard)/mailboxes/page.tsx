'use client'
import { useEffect, useState } from 'react'
import { Topbar, Btn, Modal, Field, Input, Select, Badge, SectionHead, Loading, useNotify, Empty } from '@/components/ui'
import { mailboxesApi } from '@/lib/api'
import { useApp } from '@/lib/context'

const PROVIDERS = [
  { id: 'gmail', label: 'Gmail', icon: '✉', desc: 'OAuth 2.0', oauth: true },
  { id: 'outlook', label: 'Outlook', icon: '📧', desc: 'OAuth 2.0', oauth: true },
  { id: 'smtp', label: 'Zoho / Fastmail / Annet', icon: '⚙', desc: 'SMTP + IMAP', oauth: false },
]

export default function MailboxesPage() {
  const { user, mailboxes, refreshMailboxes } = useApp()
  const [open, setOpen] = useState(false)
  const [provider, setProvider] = useState('gmail')
  const [form, setForm] = useState({ email: '', display_name: '', smtp_host: '', smtp_port: '587', smtp_user: '', smtp_pass: '', imap_host: '', imap_port: '993', encryption: 'tls', daily_limit: '30' })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const { notify, Toast } = useNotify()

  useEffect(() => { refreshMailboxes() }, [])

  const selectedProvider = PROVIDERS.find(p => p.id === provider)!

  async function handleAdd() {
    setSaving(true)
    try {
      if (selectedProvider.oauth) {
        mailboxesApi.startGmailOAuth(user!.id) // redirects
        return
      }
      await mailboxesApi.add({
        email: form.email,
        provider: 'smtp',
        display_name: form.display_name || undefined,
        smtp_host: form.smtp_host,
        smtp_port: parseInt(form.smtp_port),
        smtp_user: form.smtp_user || form.email,
        smtp_pass: form.smtp_pass,
        imap_host: form.imap_host,
        imap_port: parseInt(form.imap_port),
        encryption: form.encryption,
        daily_limit: parseInt(form.daily_limit),
      })
      await refreshMailboxes()
      setOpen(false)
      notify('Mailboks lagt til!', 'success')
    } catch (e: any) {
      notify(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest(id: string) {
    setTesting(id)
    const res = await mailboxesApi.test(id)
    if (res.ok) notify('Tilkobling OK ✓', 'success')
    else notify(`Feil: ${res.error}`, 'error')
    await refreshMailboxes()
    setTesting(null)
  }

  async function handleRemove(id: string, email: string) {
    if (!confirm(`Fjern ${email}?`)) return
    await mailboxesApi.remove(id)
    await refreshMailboxes()
    notify('Mailboks fjernet', '')
  }

  const statusBadge = (status: string) => {
    const map: any = { connected: ['green', 'Tilkoblet'], warming: ['orange', 'Varming'], error: ['red', 'Feil'], paused: ['gray', 'Pauset'] }
    const [color, label] = map[status] ?? ['gray', status]
    return <Badge color={color}>{label}</Badge>
  }

  return (
    <>
      <Topbar title="Mailbokser">
        <Btn variant="primary" size="sm" onClick={() => setOpen(true)}>+ Koble til mailboks</Btn>
      </Topbar>

      <div style={{ padding: '32px 36px' }}>
        {mailboxes.length === 0 ? (
          <Empty icon="◎" title="Ingen mailbokser" body="Koble til Gmail, Outlook eller en custom SMTP-kasse for å begynne å sende." action={<Btn variant="primary" onClick={() => setOpen(true)}>+ Koble til mailboks</Btn>} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
            {mailboxes.map(mb => (
              <div key={mb.id} style={{ background: '#fff', border: '1px solid rgba(14,14,12,0.12)', borderRadius: 12, padding: 20, position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ position: 'absolute', top: 16, right: 16 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: mb.status === 'connected' ? '#2ecc71' : mb.status === 'error' ? '#e74c3c' : '#f39c12', boxShadow: `0 0 0 3px ${mb.status === 'connected' ? '#e8f5ed' : mb.status === 'error' ? '#fef0ee' : '#fef9e7'}` }} />
                </div>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{mb.provider === 'gmail' ? '✉' : mb.provider === 'outlook' ? '📧' : '⚙'}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, paddingRight: 20 }}>{mb.email}</div>
                <div style={{ fontSize: 12, color: '#7a7a72', fontFamily: 'monospace', marginBottom: 14 }}>
                  {mb.sent_today}/{mb.daily_limit} sendt i dag · {mb.sent_total?.toLocaleString('no') ?? 0} totalt
                </div>
                {mb.error_message && <div style={{ fontSize: 11, color: '#b94030', marginBottom: 10, background: '#fef0ee', padding: '6px 10px', borderRadius: 6 }}>{mb.error_message}</div>}
                <div style={{ borderTop: '1px solid rgba(14,14,12,0.08)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {statusBadge(mb.status)}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn size="sm" variant="ghost" onClick={() => handleTest(mb.id)} disabled={testing === mb.id}>
                      {testing === mb.id ? '...' : 'Test'}
                    </Btn>
                    <Btn size="sm" variant="danger" onClick={() => handleRemove(mb.id, mb.email)}>Fjern</Btn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Koble til mailboks"
        footer={<>
          <Btn variant="ghost" onClick={() => setOpen(false)}>Avbryt</Btn>
          <Btn variant="primary" onClick={handleAdd} disabled={saving}>
            {saving ? 'Kobler...' : selectedProvider.oauth ? `Fortsett med ${selectedProvider.label} →` : 'Test & koble til'}
          </Btn>
        </>}
      >
        <p style={{ fontSize: 13, color: '#7a7a72', marginBottom: 18 }}>Velg leverandør og fyll inn detaljer.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
          {PROVIDERS.map(p => (
            <button key={p.id} onClick={() => setProvider(p.id)} style={{
              border: `1.5px solid ${provider === p.id ? '#c8460a' : 'rgba(14,14,12,0.12)'}`,
              background: provider === p.id ? '#fff3ee' : '#fff',
              borderRadius: 12, padding: '16px 12px', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit',
            }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>{p.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{p.label}</div>
              <div style={{ fontSize: 10, color: '#7a7a72', marginTop: 2, fontFamily: 'monospace' }}>{p.desc}</div>
            </button>
          ))}
        </div>

        <Field label="E-postadresse">
          <Input type="email" placeholder="deg@dittdomene.no" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </Field>

        {selectedProvider.oauth ? (
          <div style={{ background: '#ede9e1', borderRadius: 8, padding: 14, fontSize: 13, color: '#3a3a36', lineHeight: 1.6 }}>
            🔐 {selectedProvider.label} bruker OAuth 2.0 — du logges inn trygt uten at vi lagrer passordet ditt.
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="SMTP-server"><Input placeholder="smtp.domene.no" value={form.smtp_host} onChange={e => setForm(f => ({ ...f, smtp_host: e.target.value }))} /></Field>
              <Field label="SMTP-port"><Input type="number" value={form.smtp_port} onChange={e => setForm(f => ({ ...f, smtp_port: e.target.value }))} /></Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="IMAP-server"><Input placeholder="imap.domene.no" value={form.imap_host} onChange={e => setForm(f => ({ ...f, imap_host: e.target.value }))} /></Field>
              <Field label="IMAP-port"><Input type="number" value={form.imap_port} onChange={e => setForm(f => ({ ...f, imap_port: e.target.value }))} /></Field>
            </div>
            <Field label="Passord / App-passord"><Input type="password" value={form.smtp_pass} onChange={e => setForm(f => ({ ...f, smtp_pass: e.target.value }))} /></Field>
            <Field label="Kryptering">
              <Select value={form.encryption} onChange={e => setForm(f => ({ ...f, encryption: e.target.value }))}>
                <option value="tls">TLS (anbefalt)</option>
                <option value="starttls">STARTTLS</option>
              </Select>
            </Field>
          </>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 4 }}>
          <Field label="Visningsnavn (valgfritt)"><Input placeholder="Ola — LokalProfil" value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} /></Field>
          <Field label="E-poster per dag"><Input type="number" min="5" max="500" value={form.daily_limit} onChange={e => setForm(f => ({ ...f, daily_limit: e.target.value }))} /></Field>
        </div>
      </Modal>

      {Toast}
    </>
  )
}
