'use client'
import { useState } from 'react'
import { Topbar, Btn, SectionHead, Field, Input, useNotify } from '@/components/ui'
import { useApp } from '@/lib/context'
import { supabase } from '@/lib/supabase'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!checked)} style={{
      width: 40, height: 22, borderRadius: 11, background: checked ? '#c8460a' : '#e4dfd5',
      position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', width: 16, height: 16, borderRadius: '50%', background: '#fff',
        top: 3, left: checked ? 21 : 3, transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  )
}

function ToggleRow({ title, desc, checked, onChange }: { title: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid rgba(14,14,12,0.08)' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#7a7a72', marginTop: 2 }}>{desc}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(14,14,12,0.12)', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, marginBottom: desc ? 4 : 16 }}>{title}</div>
      {desc && <div style={{ fontSize: 12, color: '#7a7a72', marginBottom: 20 }}>{desc}</div>}
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const { user } = useApp()
  const { notify, Toast } = useNotify()

  const [sending, setSending] = useState({
    humanTiming: true,
    weekdaysOnly: true,
    stopOnReply: true,
    rotateMailboxes: true,
  })

  const [integrations, setIntegrations] = useState({
    slack: false,
    hubspot: false,
    webhook: false,
  })

  const [webhookUrl, setWebhookUrl] = useState('')
  const [profile, setProfile] = useState({ email: user?.email ?? '', name: '' })
  const [newPassword, setNewPassword] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  async function saveProfile() {
    setSavingProfile(true)
    try {
      if (profile.email !== user?.email) {
        const { error } = await supabase.auth.updateUser({ email: profile.email })
        if (error) throw error
      }
      notify('Profil lagret!', 'success')
    } catch (e: any) {
      notify(e.message, 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  async function changePassword() {
    if (newPassword.length < 8) { notify('Passord må være minst 8 tegn', 'error'); return }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setNewPassword('')
      notify('Passord endret!', 'success')
    } catch (e: any) {
      notify(e.message, 'error')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <>
      <Topbar title="Innstillinger" />
      <div style={{ padding: '32px 36px', maxWidth: 720 }}>

        <Card title="Sending-atferd" desc="Kontroller når og hvordan e-poster sendes for å maksimere leveringsevne.">
          <ToggleRow title="Menneskelig timing" desc="Varierer sending-tidspunkt for å simulere menneskelig atferd"
            checked={sending.humanTiming} onChange={v => setSending(s => ({ ...s, humanTiming: v }))} />
          <ToggleRow title="Kun arbeidsdager" desc="Send kun mandag–fredag 08:00–17:00 (Oslo-tid)"
            checked={sending.weekdaysOnly} onChange={v => setSending(s => ({ ...s, weekdaysOnly: v }))} />
          <ToggleRow title="Stopp ved svar" desc="Stopper sekvens automatisk når kontakt svarer"
            checked={sending.stopOnReply} onChange={v => setSending(s => ({ ...s, stopOnReply: v }))} />
          <div style={{ borderBottom: 'none' }}>
            <ToggleRow title="Rotér mailbokser" desc="Fordeler sending jevnt på tvers av alle aktive mailbokser"
              checked={sending.rotateMailboxes} onChange={v => setSending(s => ({ ...s, rotateMailboxes: v }))} />
          </div>
          <div style={{ marginTop: 16 }}>
            <Btn variant="primary" onClick={() => notify('Innstillinger lagret!', 'success')}>Lagre</Btn>
          </div>
        </Card>

        <Card title="Integrasjoner" desc="Koble til CRM og andre verktøy.">
          <ToggleRow title="Slack-varsler" desc="Varsle i Slack-kanal ved nye svar"
            checked={integrations.slack} onChange={v => setIntegrations(s => ({ ...s, slack: v }))} />
          <ToggleRow title="HubSpot CRM" desc="Sync kontakter og aktivitet automatisk"
            checked={integrations.hubspot} onChange={v => setIntegrations(s => ({ ...s, hubspot: v }))} />
          <ToggleRow title="Webhook ved svar" desc="POST til din endpoint ved ny respons"
            checked={integrations.webhook} onChange={v => setIntegrations(s => ({ ...s, webhook: v }))} />
          {integrations.webhook && (
            <div style={{ marginTop: 12 }}>
              <Field label="Webhook URL">
                <Input type="url" placeholder="https://din-server.no/webhook" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} />
              </Field>
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <Btn variant="primary" onClick={() => notify('Integrasjoner lagret!', 'success')}>Lagre</Btn>
          </div>
        </Card>

        <Card title="Profil">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <Field label="Navn">
              <Input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="Ola Nordmann" />
            </Field>
            <Field label="E-post">
              <Input type="email" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
            </Field>
          </div>
          <Btn variant="primary" onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? 'Lagrer...' : 'Lagre profil'}
          </Btn>
        </Card>

        <Card title="Endre passord">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'flex-end' }}>
            <Field label="Nytt passord">
              <Input type="password" placeholder="Minst 8 tegn" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </Field>
            <Btn variant="primary" onClick={changePassword} disabled={savingPassword} style={{ marginBottom: 0 }}>
              {savingPassword ? '...' : 'Endre'}
            </Btn>
          </div>
        </Card>

        <Card title="Danger zone">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Slett konto</div>
              <div style={{ fontSize: 12, color: '#7a7a72', marginTop: 2 }}>Permanent sletting av all data. Kan ikke angres.</div>
            </div>
            <Btn variant="danger" size="sm" onClick={() => notify('Kontakt support for å slette konto', 'error')}>Slett konto</Btn>
          </div>
        </Card>

      </div>
      {Toast}
    </>
  )
}
