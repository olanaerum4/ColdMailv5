'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    setDone(true)
    setLoading(false)
  }

  if (done) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logo}>outreach<span style={{ color: '#e8621e' }}>.</span></div>
          <div style={{ ...styles.error, background: '#e8f5ed', color: '#1a6b3a', marginBottom: 0 }}>
            ✓ Sjekk e-posten din for bekreftelseslenke, så er du i gang!
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>outreach<span style={{ color: '#e8621e' }}>.</span></div>
        <p style={styles.sub}>Opprett ny konto</p>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleRegister}>
          <div style={styles.field}>
            <label style={styles.label}>E-post</label>
            <input style={styles.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="deg@domene.no" required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Passord</label>
            <input style={styles.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minst 8 tegn" minLength={8} required />
          </div>
          <button style={{ ...styles.btn, opacity: loading ? 0.6 : 1 }} type="submit" disabled={loading}>
            {loading ? 'Oppretter konto...' : 'Registrer deg'}
          </button>
        </form>
        <p style={styles.footer}>Har du konto? <Link href="/login" style={{ color: '#c8460a' }}>Logg inn</Link></p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f3ee', fontFamily: "'Syne', sans-serif" },
  card: { background: '#fff', border: '1px solid rgba(14,14,12,0.12)', borderRadius: 12, padding: '40px 36px', width: 380, boxShadow: '0 4px 24px rgba(0,0,0,0.07)' },
  logo: { fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 400, marginBottom: 6, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: '#7a7a72', marginBottom: 28, marginTop: 4 },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#3a3a36' },
  input: { width: '100%', padding: '9px 13px', fontSize: 14, border: '1px solid rgba(14,14,12,0.22)', borderRadius: 6, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  btn: { width: '100%', padding: '10px', background: '#c8460a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8, fontFamily: 'inherit' },
  error: { background: '#fef0ee', color: '#b94030', padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 16 },
  footer: { fontSize: 13, color: '#7a7a72', textAlign: 'center', marginTop: 20, marginBottom: 0 },
}
