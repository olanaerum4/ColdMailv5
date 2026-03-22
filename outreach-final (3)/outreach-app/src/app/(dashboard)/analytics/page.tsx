'use client'
import { useEffect, useState } from 'react'
import { Topbar, KpiCard, Grid, TableWrap, Table, Th, Td, SectionHead, Loading, Select } from '@/components/ui'
import { analyticsApi } from '@/lib/api'

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null)
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    analyticsApi.get(days).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [days])

  if (loading) return <><Topbar title="Analytics" /><Loading /></>

  const maxSent = Math.max(...(data?.daily ?? []).map((d: any) => d.sent), 1)

  return (
    <>
      <Topbar title="Analytics">
        <Select value={days} onChange={(e: any) => setDays(parseInt(e.target.value))} style={{ width: 160, fontSize: 12, padding: '6px 12px' }}>
          <option value={7}>Siste 7 dager</option>
          <option value={14}>Siste 14 dager</option>
          <option value={30}>Siste 30 dager</option>
        </Select>
      </Topbar>

      <div style={{ padding: '32px 36px' }}>
        <Grid cols={4} gap={16}>
          <KpiCard label="Sendt totalt" value={(data?.totals?.sent ?? 0).toLocaleString('no')} />
          <KpiCard label="Åpningsrate" value={`${data?.openRate ?? 0}%`} trend="up" />
          <KpiCard label="Svarrate" value={`${data?.replyRate ?? 0}%`} />
          <KpiCard label="Bounce-rate" value={`${data?.bounceRate ?? 0}%`} trend={data?.bounceRate > 5 ? 'down' : 'neutral'} />
        </Grid>

        <div style={{ marginTop: 28 }}>
          <SectionHead title="Sendt per dag" />
          <div style={{ background: '#fff', border: '1px solid rgba(14,14,12,0.12)', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 24 }}>
            {data?.daily?.length ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 150 }}>
                {data.daily.map((d: any) => {
                  const h = Math.max(4, Math.round((d.sent / maxSent) * 130))
                  const isToday = d.date === new Date().toISOString().split('T')[0]
                  return (
                    <div key={d.date} title={`${d.sent} sendt, ${d.opened} åpnet, ${d.replied} svar`}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#0e0e0c', fontWeight: isToday ? 700 : 400 }}>{d.sent || ''}</div>
                      <div style={{ width: '100%', height: h, background: isToday ? '#c8460a' : '#e4dfd5', borderRadius: '4px 4px 0 0' }} />
                      <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#7a7a72', textAlign: 'center' }}>
                        {new Date(d.date).toLocaleDateString('no', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#7a7a72', fontSize: 13, padding: '40px 0' }}>Ingen data ennå</div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <SectionHead title="Topp kampanjer" />
            <TableWrap>
              <Table>
                <thead><tr><Th>Kampanje</Th><Th>Sendt</Th><Th>Svar%</Th></tr></thead>
                <tbody>
                  {data?.campaigns?.length === 0 && (
                    <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: '#7a7a72', fontSize: 13 }}>Ingen data</td></tr>
                  )}
                  {data?.campaigns?.map((c: any) => (
                    <tr key={c.id}>
                      <Td>{c.name}</Td>
                      <Td mono>{c.sent_count?.toLocaleString('no') ?? 0}</Td>
                      <Td mono>{c.sent_count ? Math.round(c.reply_count / c.sent_count * 1000) / 10 : 0}%</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </div>

          <div>
            <SectionHead title="Sending per mailboks" />
            <TableWrap>
              <Table>
                <thead><tr><Th>Mailboks</Th><Th>Sendt totalt</Th><Th>I dag</Th></tr></thead>
                <tbody>
                  {data?.mailboxes?.length === 0 && (
                    <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: '#7a7a72', fontSize: 13 }}>Ingen data</td></tr>
                  )}
                  {data?.mailboxes?.map((m: any) => (
                    <tr key={m.email}>
                      <Td mono>{m.email}</Td>
                      <Td mono>{m.sent_total?.toLocaleString('no') ?? 0}</Td>
                      <Td mono>{m.sent_today}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </div>
        </div>
      </div>
    </>
  )
}
