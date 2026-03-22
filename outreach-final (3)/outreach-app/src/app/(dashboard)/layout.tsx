'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useApp, AppProvider } from '@/lib/context'

function Nav() {
  const { signOut, inboxCount, campaigns, mailboxes } = useApp()
  const pathname = usePathname()

  const active = (path: string) => pathname === path || pathname.startsWith(path + '/')

  const navItem = (href: string, icon: string, label: string, badge?: number) => (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 24px', fontSize: 13, fontWeight: 500, textDecoration: 'none',
      color: active(href) ? '#fff' : 'rgba(255,255,255,0.55)',
      background: active(href) ? 'rgba(255,255,255,0.06)' : 'transparent',
      borderLeft: `2px solid ${active(href) ? '#e8621e' : 'transparent'}`,
      transition: 'all 0.15s',
    }}>
      <span style={{ fontSize: 15, width: 18, textAlign: 'center' }}>{icon}</span>
      {label}
      {badge ? (
        <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: 'monospace', background: '#c8460a', color: '#fff', padding: '1px 6px', borderRadius: 20 }}>
          {badge}
        </span>
      ) : null}
    </Link>
  )

  return (
    <nav style={{ width: 220, background: '#0e0e0c', display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, flexShrink: 0 }}>
      <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#fff', letterSpacing: -0.5 }}>
          outreach<span style={{ color: '#e8621e' }}>.</span>
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 3 }}>
          cold email platform
        </div>
      </div>

      <div style={{ flex: 1, paddingTop: 16, overflowY: 'auto' }}>
        <div style={sectionLabel}>Oversikt</div>
        {navItem('/dashboard', '◈', 'Dashboard')}
        {navItem('/inbox', '✉', 'Innboks', inboxCount || undefined)}

        <div style={sectionLabel}>Sending</div>
        {navItem('/campaigns', '⚡', 'Kampanjer')}
        {navItem('/sequences', '⇢', 'Sekvenser')}
        {navItem('/leads', '◉', 'Leads')}

        <div style={sectionLabel}>Infrastruktur</div>
        {navItem('/mailboxes', '◎', 'Mailbokser', mailboxes.filter(m => m.status === 'error').length || undefined)}
        {navItem('/warmup', '◑', 'Varmeoppbygging')}

        <div style={sectionLabel}>Analyse</div>
        {navItem('/analytics', '◰', 'Analytics')}

        <div style={sectionLabel}>Konto</div>
        {navItem('/settings', '⊙', 'Innstillinger')}
      </div>

      <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={signOut} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
          Logg ut →
        </button>
      </div>
    </nav>
  )
}

const sectionLabel: React.CSSProperties = {
  fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.1em',
  textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)',
  padding: '12px 24px 6px',
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f3ee', fontFamily: 'monospace', fontSize: 13, color: '#7a7a72' }}>
        Laster...
      </div>
    )
  }
  if (!user) return null
  return <>{children}</>
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AuthGuard>
        <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Syne', sans-serif", background: '#f5f3ee' }}>
          <Nav />
          <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {children}
          </main>
        </div>
      </AuthGuard>
    </AppProvider>
  )
}
