'use client'
import { useEffect, useState } from 'react'
import { Topbar, KpiCard, Grid, TableWrap, Table, Th, Td, Badge, SectionHead, Btn, Loading } from '@/components/ui'
import { analyticsApi, campaignsApi } from '@/lib/api'
import Link from 'next/link'

function statusBadge(status: string) {
  const map: any = { active: ['green', 'Aktiv'], paused: ['orange', 'Pause'], draft: ['gray', 'Utkast'], completed: ['blue', 'Fullført'] }
  const [color, label] = map[status] ?? ['gray', status]
  return <Badge color={color}>{label}</Badge>
}

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<any>(null)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([analyticsApi.get(7), campaignsApi.list()]).then(([a, c]) => {
      setAnalytics(a)
      setCampaigns(c.slice(0, 5))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <><Topbar title="Dashboard" /><Loading /></>

  return (
    <>
      <Topbar title="Dashboard">
        <Link href="/campaigns"><Btn variant="ghost" size="sm">Se kampanjer</Btn></Link>
        <Link href="/campaigns/new"><Btn variant="primary" size="sm">+ Ny kampanje</Btn></Link>
      </Topbar>

      <div style={{ padding: '32px 36px' }}>
        <Grid cols={4} gap={16}>
          <KpiCard label="Sendt i dag" value={(analytics?.daily?.at(-1)?.sent ?? 0).toLocaleString('no')} />
          <KpiCard label="Åpningsrate" value={`${analytics?.openRate ?? 0}%`} trend="up" />
          <KpiCard label="Svarrate" value={`${analytics?.replyRate ?? 0}%`} />
          <KpiCard label="Aktive kampanjer" value={campaigns.filter(c => c.status === 'active').length} />
        </Grid>

        <div style={{ marginTop: 32 }}>
          <SectionHead title="Aktive kampanjer">
            <Link href="/campaigns"><Btn variant="ghost" size="sm">Se alle →</Btn></Link>
          </SectionHead>
          <TableWrap>
            <Table>
              <thead><tr>
                <Th>Kampanje</Th><Th>Status</Th><Th>Sendt</Th><Th>Åpnet</Th><Th>Svar</Th>
              </tr></thead>
              <tbody>
                {campaigns.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#7a7a72', fontSize: 13 }}>
                    Ingen kampanjer ennå — <Link href="/campaigns/new" style={{ color: '#c8460a' }}>opprett en</Link>
                  </td></tr>
                )}
                {campaigns.map(c => {
                  const openRate = c.sent_count ? Math.round(c.open_count / c.sent_count * 100) : 0
                  const replyRate = c.sent_count ? Math.round(c.reply_count / c.sent_count * 1000) / 10 : 0
                  return (
                    <tr key={c.id}>
                      <Td><Link href={`/campaigns/${c.id}`} style={{ color: '#0e0e0c', fontWeight: 600, textDecoration: 'none' }}>{c.name}</Link></Td>
                      <Td>{statusBadge(c.status)}</Td>
                      <Td mono>{c.sent_count?.toLocaleString('no') ?? 0}</Td>
                      <Td>{openRate}%</Td>
                      <Td>{replyRate}%</Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </TableWrap>
        </div>

        {analytics?.daily?.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <SectionHead title="Siste 7 dager" />
            <div style={{ background: '#fff', border: '1px solid rgba(14,14,12,0.12)', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', height: 120 }}>
                {analytics.daily.map((d: any) => {
                  const max = Math.max(...analytics.daily.map((x: any) => x.sent), 1)
                  const h = Math.max(4, Math.round((d.sent / max) * 110))
                  const isToday = d.date === new Date().toISOString().split('T')[0]
                  return (
                    <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#0e0e0c', fontWeight: isToday ? 700 : 400 }}>{d.sent}</div>
                      <div style={{ width: '100%', height: h, background: isToday ? '#c8460a' : '#e4dfd5', borderRadius: '4px 4px 0 0' }} />
                      <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#7a7a72' }}>
                        {new Date(d.date).toLocaleDateString('no', { weekday: 'short' })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
