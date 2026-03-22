'use client'
import { useEffect, useState } from 'react'
import { Topbar, Btn, TableWrap, Table, Th, Td, Badge, Modal, Field, Input, Select, SectionHead, Loading, useNotify, Empty } from '@/components/ui'
import { campaignsApi } from '@/lib/api'
import { useApp } from '@/lib/context'
import Link from 'next/link'

function statusBadge(status: string) {
  const map: any = { active: ['green', 'Aktiv'], paused: ['orange', 'Pause'], draft: ['gray', 'Utkast'], completed: ['blue', 'Fullført'] }
  const [color, label] = map[status] ?? ['gray', status]
  return <Badge color={color}>{label}</Badge>
}

export default function CampaignsPage() {
  const { campaigns, mailboxes, sequences, refreshCampaigns } = useApp()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ name: '', sequence_id: '', mailbox_id: '', daily_limit: '50', start_date: '' })
  const [saving, setSaving] = useState(false)
  const { notify, Toast } = useNotify()

  useEffect(() => { refreshCampaigns() }, [])

  async function handleCreate() {
    if (!form.name) { notify('Navn er påkrevd', 'error'); return }
    setSaving(true)
    try {
      await campaignsApi.create({
        name: form.name,
        sequence_id: form.sequence_id || undefined,
        mailbox_id: form.mailbox_id || undefined,
        daily_limit: parseInt(form.daily_limit),
        start_date: form.start_date || undefined,
      })
      await refreshCampaigns()
      setOpen(false)
      setForm({ name: '', sequence_id: '', mailbox_id: '', daily_limit: '50', start_date: '' })
      notify('Kampanje opprettet!', 'success')
    } catch (e: any) {
      notify(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(id: string, current: string) {
    const next = current === 'active' ? 'paused' : 'active'
    await campaignsApi.update(id, { status: next })
    await refreshCampaigns()
    notify(next === 'active' ? 'Kampanje aktivert' : 'Kampanje pauset', 'success')
  }

  const filtered = campaigns.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <Topbar title="Kampanjer">
        <Btn variant="primary" size="sm" onClick={() => setOpen(true)}>+ Ny kampanje</Btn>
      </Topbar>

      <div style={{ padding: '32px 36px' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Søk kampanjer..."
            style={{ flex: 1, padding: '8px 14px', border: '1px solid rgba(14,14,12,0.22)', borderRadius: 6, fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#fff' }}
          />
        </div>

        {filtered.length === 0 && !search ? (
          <Empty icon="⚡" title="Ingen kampanjer" body="Opprett din første kampanje og begynn å sende." action={<Btn variant="primary" onClick={() => setOpen(true)}>+ Ny kampanje</Btn>} />
        ) : (
          <TableWrap>
            <Table>
              <thead><tr>
                <Th>Navn</Th><Th>Status</Th><Th>Leads</Th><Th>Sendt</Th><Th>Åpnet</Th><Th>Svar</Th><Th>Mailboks</Th><Th>{""}</Th>
              </tr></thead>
              <tbody>
                {filtered.map(c => {
                  const openRate = c.sent_count ? Math.round(c.open_count / c.sent_count * 100) : 0
                  const replyRate = c.sent_count ? Math.round(c.reply_count / c.sent_count * 1000) / 10 : 0
                  return (
                    <tr key={c.id}>
                      <Td><Link href={`/campaigns/${c.id}`} style={{ color: '#0e0e0c', fontWeight: 600, textDecoration: 'none' }}>{c.name}</Link></Td>
                      <Td>{statusBadge(c.status)}</Td>
                      <Td mono>{c.total_leads?.toLocaleString('no') ?? 0}</Td>
                      <Td mono>{c.sent_count?.toLocaleString('no') ?? 0}</Td>
                      <Td>{openRate}%</Td>
                      <Td>{replyRate}%</Td>
                      <Td mono>{c.mailbox?.email ?? '—'}</Td>
                      <Td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Btn size="sm" variant="ghost" onClick={() => toggleStatus(c.id, c.status)}>
                            {c.status === 'active' ? 'Pause' : 'Start'}
                          </Btn>
                          <Link href={`/campaigns/${c.id}`}><Btn size="sm" variant="ghost">Åpne</Btn></Link>
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Ny kampanje"
        footer={<>
          <Btn variant="ghost" onClick={() => setOpen(false)}>Avbryt</Btn>
          <Btn variant="primary" onClick={handleCreate} disabled={saving}>{saving ? 'Oppretter...' : 'Opprett kampanje'}</Btn>
        </>}
      >
        <Field label="Kampanjenavn"><Input placeholder="F.eks. Rørleggere Oslo Q2" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
        <Field label="Mailboks">
          <Select value={form.mailbox_id} onChange={e => setForm(f => ({ ...f, mailbox_id: e.target.value }))}>
            <option value="">Velg mailboks...</option>
            {mailboxes.filter(m => m.status === 'connected').map(m => <option key={m.id} value={m.id}>{m.email}</option>)}
          </Select>
        </Field>
        <Field label="Sekvens">
          <Select value={form.sequence_id} onChange={e => setForm(f => ({ ...f, sequence_id: e.target.value }))}>
            <option value="">Velg sekvens...</option>
            {sequences.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Start-dato"><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></Field>
          <Field label="Daglig tak"><Input type="number" min="5" max="500" value={form.daily_limit} onChange={e => setForm(f => ({ ...f, daily_limit: e.target.value }))} /></Field>
        </div>
      </Modal>

      {Toast}
    </>
  )
}
