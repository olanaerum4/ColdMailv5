'use client'
import { useEffect, useState } from 'react'
import { Topbar, TableWrap, Table, Th, Td, Badge, SectionHead, Loading, Btn, useNotify, Empty } from '@/components/ui'
import { warmupApi } from '@/lib/api'
import { useApp } from '@/lib/context'

export default function WarmupPage() {
  const { mailboxes, refreshMailboxes } = useApp()
  const [warmupData, setWarmupData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { notify, Toast } = useNotify()

  useEffect(() => {
    warmupApi.list().then(d => { setWarmupData(d); setLoading(false) })
  }, [])

  async function enableWarmup(id: string) {
    await warmupApi.enable(id)
    await refreshMailboxes()
    const data = await warmupApi.list()
    setWarmupData(data)
    notify('Varmeoppbygging aktivert!', 'success')
  }

  const warming = warmupData.filter(m => m.warmup_enabled)
  const notWarming = mailboxes.filter(m => !m.warmup_enabled)

  if (loading) return <><Topbar title="Varmeoppbygging" /><Loading /></>

  return (
    <>
      <Topbar title="Varmeoppbygging" />
      <div style={{ padding: '32px 36px' }}>

        <div style={{ background: '#0e0e0c', color: '#fff', borderRadius: 12, padding: 28, marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(200,70,10,0.15)' }} />
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, marginBottom: 8 }}>E-post-omdømme er alt</div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', maxWidth: 440, lineHeight: 1.6, marginBottom: 20 }}>
            Varmeoppbygging simulerer ekte e-postaktivitet for å bygge tillit hos Google, Microsoft og andre filtre. Nye mailbokser bør varmes opp i 2–4 uker før cold outreach.
          </p>
          <div style={{ display: 'flex', gap: 32 }}>
            {[
              { label: 'Mailbokser i varme', value: warming.length },
              { label: 'Gj.snitt dag', value: warming.length ? Math.round(warming.reduce((a, m) => a + (m.warmup_day ?? 0), 0) / warming.length) : 0 },
              { label: 'Spam-rate snitt', value: warming.length ? (warming.reduce((a, m) => a + (m.spam_rate ?? 0), 0) / warming.length).toFixed(1) + '%' : '—' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
                <div style={{ fontSize: 22, fontFamily: 'Georgia, serif', marginTop: 4 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {warming.length > 0 && (
          <>
            <SectionHead title="Aktiv varmeoppbygging" />
            <TableWrap>
              <Table>
                <thead><tr><Th>Mailboks</Th><Th>Status</Th><Th>Progresjon</Th><Th>Sendt i dag</Th><Th>Spam%</Th></tr></thead>
                <tbody>
                  {warming.map(mb => (
                    <tr key={mb.id}>
                      <Td mono>{mb.email}</Td>
                      <Td><Badge color={mb.warmup_day >= mb.warmup_target_day ? 'green' : 'orange'}>{mb.warmup_day >= mb.warmup_target_day ? 'Ferdig' : 'Varming'}</Badge></Td>
                      <Td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ background: '#e4dfd5', borderRadius: 20, height: 5, width: 100, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: '#c8460a', borderRadius: 20, width: `${Math.min(100, Math.round((mb.warmup_day / mb.warmup_target_day) * 100))}%` }} />
                          </div>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#7a7a72' }}>Dag {mb.warmup_day}/{mb.warmup_target_day}</span>
                        </div>
                      </Td>
                      <Td mono>{mb.warmup_daily_sent}</Td>
                      <Td mono>{mb.spam_rate ?? 0}%</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </>
        )}

        {notWarming.length > 0 && (
          <>
            <SectionHead title="Mailbokser uten varmeoppbygging" />
            <TableWrap>
              <Table>
                <thead><tr><Th>Mailboks</Th><Th>Leverandør</Th><Th>Status</Th><Th>{""}</Th></tr></thead>
                <tbody>
                  {notWarming.map(mb => (
                    <tr key={mb.id}>
                      <Td mono>{mb.email}</Td>
                      <Td>{mb.provider}</Td>
                      <Td><Badge color={mb.status === 'connected' ? 'green' : 'gray'}>{mb.status}</Badge></Td>
                      <Td><Btn size="sm" variant="ghost" onClick={() => enableWarmup(mb.id)}>Aktiver varming</Btn></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </>
        )}

        {mailboxes.length === 0 && (
          <Empty icon="◑" title="Ingen mailbokser" body="Koble til mailbokser for å starte varmeoppbygging." />
        )}
      </div>
      {Toast}
    </>
  )
}
