import React from 'react'

// ── Topbar ─────────────────────────────────────
export function Topbar({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div style={{ padding: '16px 36px', borderBottom: '1px solid rgba(14,14,12,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f5f3ee', position: 'sticky', top: 0, zIndex: 10 }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, letterSpacing: -0.3 }}>{title}</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{children}</div>
    </div>
  )
}

// ── Buttons ────────────────────────────────────
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}
export function Btn({ variant = 'ghost', size = 'md', children, style, ...props }: BtnProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer', borderRadius: 6,
    transition: 'all 0.15s', border: '1px solid transparent',
    padding: size === 'sm' ? '5px 11px' : '8px 16px',
    fontSize: size === 'sm' ? 12 : 13,
  }
  const variants = {
    primary: { background: '#c8460a', color: '#fff', borderColor: '#c8460a' },
    ghost: { background: 'transparent', color: '#3a3a36', borderColor: 'rgba(14,14,12,0.22)' },
    danger: { background: '#fef0ee', color: '#b94030', borderColor: '#f0c4be' },
  }
  return (
    <button style={{ ...base, ...variants[variant], opacity: props.disabled ? 0.4 : 1, ...style }} {...props}>
      {children}
    </button>
  )
}

// ── Badge ──────────────────────────────────────
type BadgeColor = 'green' | 'orange' | 'gray' | 'red' | 'blue'
const badgeColors: Record<BadgeColor, React.CSSProperties> = {
  green: { background: '#e8f5ed', color: '#1a6b3a' },
  orange: { background: '#fff3ea', color: '#b85e14' },
  gray: { background: '#ede9e1', color: '#7a7a72' },
  red: { background: '#fef0ee', color: '#b94030' },
  blue: { background: '#e8f0fe', color: '#1a4fa8' },
}
export function Badge({ color, children }: { color: BadgeColor; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-block', fontSize: 11, fontFamily: 'monospace', padding: '2px 9px', borderRadius: 20, ...badgeColors[color] }}>
      {children}
    </span>
  )
}

// ── Table ──────────────────────────────────────
export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(14,14,12,0.12)', borderRadius: 12, overflow: 'hidden', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      {children}
    </div>
  )
}
export function Table({ children }: { children: React.ReactNode }) {
  return <table style={{ width: '100%', borderCollapse: 'collapse' }}>{children}</table>
}
export function Th({ children }: { children?: React.ReactNode }) {
  return <th style={{ textAlign: 'left', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7a7a72', padding: '0 16px 10px', borderBottom: '1px solid rgba(14,14,12,0.12)' }}>{children}</th>
}
export function Td({ children, mono }: { children?: React.ReactNode; mono?: boolean }) {
  return <td style={{ padding: '13px 16px', fontSize: 13, borderBottom: '1px solid rgba(14,14,12,0.08)', fontFamily: mono ? 'monospace' : 'inherit' }}>{children}</td>
}

// ── Modal ──────────────────────────────────────
export function Modal({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode
}) {
  if (!open) return null
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(14,14,12,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#f5f3ee', borderRadius: 12, width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', animation: 'slideUp 0.2s ease' }}>
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(14,14,12,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 20 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#7a7a72' }}>×</button>
        </div>
        <div style={{ padding: '24px 28px' }}>{children}</div>
        {footer && <div style={{ padding: '16px 28px', borderTop: '1px solid rgba(14,14,12,0.12)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>{footer}</div>}
      </div>
    </div>
  )
}

// ── Form helpers ───────────────────────────────
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#3a3a36', marginBottom: hint ? 3 : 6 }}>{label}</label>
      {hint && <div style={{ fontSize: 11, color: '#7a7a72', fontFamily: 'monospace', marginBottom: 6 }}>{hint}</div>}
      {children}
    </div>
  )
}
export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 13px', fontSize: 14, border: '1px solid rgba(14,14,12,0.22)',
  borderRadius: 6, background: '#fff', color: '#0e0e0c', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input style={inputStyle} {...props} />
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select style={{ ...inputStyle, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%237a7a72' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', appearance: 'none' }} {...props} />
  )
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea style={{ ...inputStyle, resize: 'vertical' as React.CSSProperties['resize'], minHeight: 100 }} {...props} />
}

// ── KPI Card ───────────────────────────────────
export function KpiCard({ label, value, sub, trend }: { label: string; value: string | number; sub?: string; trend?: 'up' | 'down' | 'neutral' }) {
  const trendColor = trend === 'up' ? '#1a6b3a' : trend === 'down' ? '#c8460a' : '#7a7a72'
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(14,14,12,0.12)', borderRadius: 12, padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#7a7a72', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 32, fontFamily: 'Georgia, serif', margin: '6px 0 4px', letterSpacing: -1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: trendColor }}>{sub}</div>}
    </div>
  )
}

// ── Notification toast ─────────────────────────
export function useNotify() {
  const [msg, setMsg] = React.useState<{ text: string; type: 'success' | 'error' | '' } | null>(null)

  const notify = (text: string, type: 'success' | 'error' | '' = '') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3500)
  }

  const Toast = msg ? (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 200,
      background: msg.type === 'success' ? '#1a6b3a' : msg.type === 'error' ? '#b94030' : '#0e0e0c',
      color: '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 13,
      boxShadow: '0 8px 24px rgba(0,0,0,0.18)', animation: 'slideUp 0.2s ease',
    }}>
      {msg.text}
    </div>
  ) : null

  return { notify, Toast }
}

// ── Section heading ────────────────────────────
export function SectionHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 18 }}>{title}</div>
      <div style={{ display: 'flex', gap: 8 }}>{children}</div>
    </div>
  )
}

// ── Empty state ────────────────────────────────
export function Empty({ icon, title, body, action }: { icon: string; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#7a7a72' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#0e0e0c', marginBottom: 8 }}>{title}</div>
      <p style={{ fontSize: 13, maxWidth: 280, margin: '0 auto 20px', lineHeight: 1.6 }}>{body}</p>
      {action}
    </div>
  )
}

// ── Loading spinner ────────────────────────────
export function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: '#7a7a72', fontSize: 13, fontFamily: 'monospace' }}>
      Laster...
    </div>
  )
}

// ── Grid helpers ───────────────────────────────
export function Grid({ cols, gap = 16, children }: { cols: number; gap?: number; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}>
      {children}
    </div>
  )
}
