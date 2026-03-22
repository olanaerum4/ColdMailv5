'use client'
import { useEffect, useState } from 'react'
import { Topbar, Btn, Modal, Field, Input, Textarea, SectionHead, Loading, useNotify, Empty } from '@/components/ui'
import { sequencesApi } from '@/lib/api'
import { useApp } from '@/lib/context'

const VARS = ['fornavn', 'etternavn', 'bedrift', 'stilling', 'by']

const defaultStep = () => ({ subject: '', body: '', wait_days: 0, only_if_no_reply: true })

export default function SequencesPage() {
  const { sequences, refreshSequences } = useApp()
  const [selected, setSelected] = useState<any>(null)
  const [steps, setSteps] = useState<any[]>([])
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const { notify, Toast } = useNotify()

  useEffect(() => { refreshSequences() }, [])

  useEffect(() => {
    if (sequences.length && !selected) {
      selectSeq(sequences[0])
    }
  }, [sequences])

  function selectSeq(seq: any) {
    setSelected(seq)
    setSteps(seq.steps?.length ? seq.steps.map((s: any) => ({ ...s })) : [defaultStep()])
    setActiveStep(0)
  }

  function insertVar(stepIdx: number, field: 'subject' | 'body', v: string) {
    setSteps(prev => prev.map((s, i) => i === stepIdx ? { ...s, [field]: (s[field] ?? '') + `{{${v}}}` } : s))
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    try {
      await sequencesApi.update(selected.id, { name: selected.name, steps })
      await refreshSequences()
      notify('Sekvens lagret!', 'success')
    } catch (e: any) {
      notify(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreate() {
    if (!newName) return
    setSaving(true)
    try {
      const seq = await sequencesApi.create({ name: newName, steps: [defaultStep()] })
      await refreshSequences()
      setNewOpen(false)
      setNewName('')
      selectSeq(seq)
      notify('Sekvens opprettet!', 'success')
    } catch (e: any) {
      notify(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Slett sekvensen?')) return
    await sequencesApi.remove(id)
    await refreshSequences()
    setSelected(null)
    notify('Slettet', '')
  }

  const step = steps[activeStep]

  return (
    <>
      <Topbar title="Sekvenser">
        {selected && <Btn variant="ghost" size="sm" onClick={() => handleDelete(selected.id)}>Slett</Btn>}
        {selected && <Btn variant="primary" size="sm" onClick={handleSave} disabled={saving}>{saving ? '...' : 'Lagre'}</Btn>}
        <Btn variant="primary" size="sm" onClick={() => setNewOpen(true)}>+ Ny sekvens</Btn>
      </Topbar>

      <div style={{ padding: '32px 36px', display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24 }}>
        {/* Sequence list */}
        <div>
          <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#7a7a72', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Sekvenser</div>
          {sequences.length === 0 && <div style={{ fontSize: 13, color: '#7a7a72' }}>Ingen sekvenser ennå.</div>}
          {sequences.map(seq => (
            <div key={seq.id} onClick={() => selectSeq(seq)} style={{
              padding: '10px 14px', borderRadius: 8, cursor: 'pointer', marginBottom: 4,
              background: selected?.id === seq.id ? '#fff' : 'transparent',
              border: selected?.id === seq.id ? '1px solid rgba(14,14,12,0.12)' : '1px solid transparent',
              fontSize: 13, fontWeight: selected?.id === seq.id ? 600 : 400,
            }}>
              {seq.name}
              <div style={{ fontSize: 11, color: '#7a7a72', fontFamily: 'monospace', marginTop: 2 }}>{seq.steps?.length ?? 0} steg</div>
            </div>
          ))}
        </div>

        {/* Step editor */}
        {selected ? (
          <div>
            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                value={selected.name}
                onChange={e => setSelected((s: any) => ({ ...s, name: e.target.value }))}
                style={{ fontFamily: 'Georgia, serif', fontSize: 20, border: 'none', outline: 'none', background: 'transparent', flex: 1 }}
              />
            </div>

            {/* Step tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {steps.map((s, i) => (
                <button key={i} onClick={() => setActiveStep(i)} style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  background: activeStep === i ? '#0e0e0c' : '#fff',
                  color: activeStep === i ? '#fff' : '#3a3a36',
                  border: '1px solid rgba(14,14,12,0.22)',
                }}>
                  Steg {i + 1}{i > 0 ? ` · Dag +${s.wait_days}` : ' · Dag 0'}
                </button>
              ))}
              <button onClick={() => { setSteps(prev => [...prev, { ...defaultStep(), wait_days: 3 }]); setActiveStep(steps.length) }} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                background: 'transparent', color: '#c8460a', border: '1px dashed #c8460a',
              }}>
                + Legg til steg
              </button>
            </div>

            {step && (
              <div style={{ background: '#fff', border: '1px solid rgba(14,14,12,0.12)', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                {activeStep > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <Field label="Vent (dager etter forrige steg)">
                      <input type="number" min="1" max="30" value={step.wait_days} onChange={e => setSteps(prev => prev.map((s, i) => i === activeStep ? { ...s, wait_days: parseInt(e.target.value) } : s))}
                        style={{ width: '100%', padding: '9px 13px', fontSize: 14, border: '1px solid rgba(14,14,12,0.22)', borderRadius: 6, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as React.CSSProperties['boxSizing'] }} />
                    </Field>
                    <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                        <input type="checkbox" checked={step.only_if_no_reply} onChange={e => setSteps(prev => prev.map((s, i) => i === activeStep ? { ...s, only_if_no_reply: e.target.checked } : s))} />
                        Kun hvis ingen respons
                      </label>
                    </div>
                  </div>
                )}

                <div style={{ background: '#f5f3ee', borderRadius: 8, padding: 10, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: '#7a7a72', marginBottom: 8 }}>Klikk for å sette inn variabel:</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {VARS.map(v => (
                      <button key={v} onClick={() => insertVar(activeStep, 'body', v)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#fff', border: '1px solid rgba(14,14,12,0.18)', cursor: 'pointer', fontFamily: 'monospace', color: '#0e0e0c' }}>
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                </div>

                <Field label="Emne">
                  <input value={step.subject} onChange={e => setSteps(prev => prev.map((s, i) => i === activeStep ? { ...s, subject: e.target.value } : s))}
                    placeholder="Hei {{fornavn}}, ett spørsmål om {{bedrift}}"
                    style={{ width: '100%', padding: '9px 13px', fontSize: 14, border: '1px solid rgba(14,14,12,0.22)', borderRadius: 6, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as React.CSSProperties['boxSizing'] }} />
                </Field>

                <Field label="Melding">
                  <textarea value={step.body} onChange={e => setSteps(prev => prev.map((s, i) => i === activeStep ? { ...s, body: e.target.value } : s))}
                    rows={10} placeholder={`Hei {{fornavn}},\n\nJeg så at {{bedrift}} jobber med...`}
                    style={{ width: '100%', padding: '9px 13px', fontSize: 14, border: '1px solid rgba(14,14,12,0.22)', borderRadius: 6, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as React.CSSProperties['boxSizing'], resize: 'vertical', minHeight: 200 }} />
                </Field>

                {steps.length > 1 && (
                  <Btn variant="danger" size="sm" onClick={() => { setSteps(prev => prev.filter((_, i) => i !== activeStep)); setActiveStep(Math.max(0, activeStep - 1)) }}>
                    Slett steg
                  </Btn>
                )}
              </div>
            )}
          </div>
        ) : (
          <Empty icon="⇢" title="Ingen sekvens valgt" body="Velg eller opprett en sekvens for å redigere steg." action={<Btn variant="primary" onClick={() => setNewOpen(true)}>+ Ny sekvens</Btn>} />
        )}
      </div>

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Ny sekvens"
        footer={<><Btn variant="ghost" onClick={() => setNewOpen(false)}>Avbryt</Btn><Btn variant="primary" onClick={handleCreate} disabled={saving}>Opprett</Btn></>}
      >
        <Field label="Navn"><Input placeholder="F.eks. LokalProfil — SMB Norge" value={newName} onChange={e => setNewName(e.target.value)} /></Field>
      </Modal>

      {Toast}
    </>
  )
}
