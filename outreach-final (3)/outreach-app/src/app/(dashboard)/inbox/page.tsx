'use client'
import { useEffect, useState } from 'react'
import { Topbar, Badge, Btn, Loading, useNotify, Empty } from '@/components/ui'
import { inboxApi } from '@/lib/api'
import { useApp } from '@/lib/context'

const TABS = [
  { key: '', label: 'Alle' },
  { key: 'interested', label: 'Interessert' },
  { key: 'not_interested', label: 'Ikke interessert' },
  { key: 'out_of_office', label: 'Fraværende' },
  { key: 'meeting_booked', label: 'Møte booket' },
]

function classificationBadge(c: string) {
  const map: any = {
    interested: ['green', 'Interessert'],
    not_interested: ['gray', 'Ikke interessert'],
    out_of_office: ['orange', 'Fraværende'],
    meeting_booked: ['blue', 'Møte'],
    bounce: ['red', 'Bounce'],
    reply: ['gray', 'Svar'],
  }
  const [color, label] = map[c] ?? ['gray', c]
  return <Badge color={color}>{label}</Badge>
}

export default function InboxPage() {
  const { refreshInboxCount } = useApp()
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [reply, setReply] = useState('')
  const { notify, Toast } = useNotify()

  useEffect(() => { load() }, [tab])

  async function load() {
    setLoading(true)
    try {
      const data = await inboxApi.list(tab || undefined)
      setMessages(data)
      if (data.length && !selected) setSelected(data[0])
    } finally {
      setLoading(false)
    }
  }

  async function markRead(msg: any) {
    if (msg.read_at) return
    await fetch(`/api/inbox/${msg.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read_at: new Date().toISOString() }) })
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read_at: new Date().toISOString() } : m))
    refreshInboxCount()
  }

  function selectMsg(msg: any) {
    setSelected(msg)
    markRead(msg)
  }

  async function sendReply() {
    if (!reply.trim()) return
    try {
      await fetch(`/api/inbox/${selected.id}/reply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: reply }) })
      setReply('')
      notify('Svar sendt!', 'success')
    } catch (e: any) {
      notify(e.message, 'error')
    }
  }

  const unread = messages.filter(m => !m.read_at).length

  return (
    <>
      <Topbar title="Innboks">
        {unread > 0 && <span style={{ fontSize: 12, color: '#7a7a72', fontFamily: 'monospace' }}>{unread} ulest</span>}
        <Btn variant="ghost" size="sm" onClick={() => setMessages(prev => prev.map(m => ({ ...m, read_at: m.read_at ?? new Date().toISOString() })))}>
          Merk alle lest
        </Btn>
      </Topbar>

      <div style={{ padding: '0 36px' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(14,14,12,0.12)', marginBottom: 0 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setSelected(null) }} style={{
              padding: '10px 18px', fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
              color: tab === t.key ? '#0e0e0c' : '#7a7a72',
              background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.key ? '#c8460a' : 'transparent'}`,
              cursor: 'pointer', marginBottom: -1,
            }}>
              {t.label}
              {t.key === '' && unread > 0 && (
                <span style={{ marginLeft: 6, fontSize: 10, background: '#c8460a', color: '#fff', padding: '1px 6px', borderRadius: 20, fontFamily: 'monospace' }}>{unread}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Loading /> : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 0, height: 'calc(100vh - 130px)', padding: '0 36px 32px' }}>
          {/* List */}
          <div style={{ background: '#fff', border: '1px solid rgba(14,14,12,0.12)', borderRadius: '12px 0 0 12px', overflowY: 'auto', marginTop: 16 }}>
            {messages.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: '#7a7a72', fontSize: 13 }}>Ingen meldinger</div>
            )}
            {messages.map(msg => (
              <div key={msg.id} onClick={() => selectMsg(msg)} style={{
                padding: '14px 18px', borderBottom: '1px solid rgba(14,14,12,0.08)',
                cursor: 'pointer', background: selected?.id === msg.id ? '#fff3ee' : '#fff',
                borderLeft: selected?.id === msg.id ? '3px solid #c8460a' : '3px solid transparent',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: msg.read_at ? 400 : 700 }}>{msg.from_name || msg.from_email}</div>
                  {classificationBadge(msg.classification)}
                </div>
                <div style={{ fontSize: 12, color: '#3a3a36', marginTop: 2 }}>{msg.subject}</div>
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#7a7a72', marginTop: 3 }}>
                  {new Date(msg.received_at).toLocaleString('no', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>

          {/* View */}
          <div style={{ background: '#fff', border: '1px solid rgba(14,14,12,0.12)', borderLeft: 'none', borderRadius: '0 12px 12px 0', padding: 28, overflowY: 'auto', marginTop: 16 }}>
            {!selected ? (
              <div style={{ color: '#7a7a72', fontSize: 13, textAlign: 'center', paddingTop: 60 }}>Velg en melding</div>
            ) : (
              <>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#7a7a72' }}>{selected.from_email}</span>
                </div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, marginBottom: 16 }}>{selected.subject}</div>
                <div style={{ fontSize: 14, lineHeight: 1.8, color: '#3a3a36', whiteSpace: 'pre-wrap', marginBottom: 24 }}>
                  {selected.body_text}
                </div>
                <div style={{ borderTop: '1px solid rgba(14,14,12,0.12)', paddingTop: 20 }}>
                  <textarea
                    value={reply} onChange={e => setReply(e.target.value)}
                    placeholder="Skriv svar..."
                    rows={4}
                    style={{ width: '100%', padding: '12px', fontSize: 14, border: '1px solid rgba(14,14,12,0.22)', borderRadius: 8, outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <Btn variant="primary" size="sm" onClick={sendReply}>Send svar</Btn>
                    <Btn variant="ghost" size="sm" onClick={() => {
                      fetch(`/api/inbox/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classification: 'meeting_booked' }) })
                      setMessages(prev => prev.map(m => m.id === selected.id ? { ...m, classification: 'meeting_booked' } : m))
                      setSelected((s: any) => ({ ...s, classification: 'meeting_booked' }))
                    }}>Merk som møte booket</Btn>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {Toast}
    </>
  )
}
