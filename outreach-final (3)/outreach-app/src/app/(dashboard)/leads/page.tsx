'use client'
import { useEffect, useState } from 'react'
import { Topbar, Btn, TableWrap, Table, Th, Td, SectionHead, Loading, useNotify, Empty } from '@/components/ui'
import { leadsApi } from '@/lib/api'

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [csvText, setCsvText] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const { notify, Toast } = useNotify()

  useEffect(() => { load() }, [search])

  async function load() {
    setLoading(true)
    const res = await leadsApi.list(1, search)
    setLeads(res.data)
    setCount(res.count)
    setLoading(false)
  }

  async function handleCSVImport() {
    if (!csvText.trim()) return
    setImporting(true)
    try {
      const result = await leadsApi.importCSV(csvText)
      setImportResult(result)
      notify(`${result.imported} leads importert!`, 'success')
      await load()
    } catch (e: any) {
      notify(e.message, 'error')
    } finally {
      setImporting(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setCsvText(text)
    setShowImport(true)
  }

  return (
    <>
      <Topbar title={`Leads (${count.toLocaleString('no')})`}>
        <Btn variant="ghost" size="sm" onClick={() => setShowImport(s => !s)}>📥 Importer CSV</Btn>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px', fontSize: 12, fontWeight: 500, cursor: 'pointer', borderRadius: 6, border: '1px solid rgba(14,14,12,0.22)', background: 'transparent', color: '#3a3a36' }}>
          📁 Last opp fil
          <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileUpload} />
        </label>
      </Topbar>

      <div style={{ padding: '32px 36px' }}>
        {showImport && (
          <div style={{ background: '#fff', border: '1px solid rgba(14,14,12,0.12)', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <SectionHead title="Importer fra CSV">
              <Btn variant="ghost" size="sm" onClick={() => { setShowImport(false); setImportResult(null) }}>Lukk</Btn>
            </SectionHead>
            <p style={{ fontSize: 12, color: '#7a7a72', marginBottom: 12, fontFamily: 'monospace' }}>
              Format: email, first_name, last_name, company, title, city (+ valgfrie kolonner blir tilgjengelige som variabler)
            </p>
            <textarea
              value={csvText} onChange={e => setCsvText(e.target.value)}
              placeholder={"email,first_name,last_name,company\nper@hansens.no,Per,Hansen,Hansens Rørlegging\nkari@blomster.no,Kari,Nilsen,Blomster & Co"}
              rows={6}
              style={{ width: '100%', padding: '10px 13px', fontSize: 13, fontFamily: 'monospace', border: '1px solid rgba(14,14,12,0.22)', borderRadius: 8, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
            />
            {importResult && (
              <div style={{ background: '#e8f5ed', color: '#1a6b3a', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginTop: 12 }}>
                ✓ {importResult.imported} importert · {importResult.duplicates} duplikater · {importResult.suppressed} avmeldt · {importResult.invalid} ugyldige
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Btn variant="primary" onClick={handleCSVImport} disabled={importing || !csvText.trim()}>
                {importing ? 'Importerer...' : 'Importer leads'}
              </Btn>
              <Btn variant="ghost" onClick={() => setCsvText('')}>Tøm</Btn>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Søk på navn, e-post, bedrift..."
            style={{ width: '100%', maxWidth: 400, padding: '8px 14px', border: '1px solid rgba(14,14,12,0.22)', borderRadius: 6, fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#fff' }}
          />
        </div>

        {loading ? <Loading /> : leads.length === 0 ? (
          <Empty icon="◉" title="Ingen leads" body="Importer leads via CSV for å begynne å sende kampanjer." action={<Btn variant="primary" onClick={() => setShowImport(true)}>Importer CSV</Btn>} />
        ) : (
          <TableWrap>
            <Table>
              <thead><tr>
                <Th>E-post</Th><Th>Navn</Th><Th>Bedrift</Th><Th>Stilling</Th><Th>By</Th><Th>Status</Th>
              </tr></thead>
              <tbody>
                {leads.map(l => (
                  <tr key={l.id}>
                    <Td mono>{l.email}</Td>
                    <Td>{[l.first_name, l.last_name].filter(Boolean).join(' ') || '—'}</Td>
                    <Td>{l.company || '—'}</Td>
                    <Td>{l.title || '—'}</Td>
                    <Td>{l.city || '—'}</Td>
                    <Td>{l.unsubscribed ? <span style={{ fontSize: 11, color: '#b94030', fontFamily: 'monospace' }}>avmeldt</span> : <span style={{ fontSize: 11, color: '#1a6b3a', fontFamily: 'monospace' }}>aktiv</span>}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </div>
      {Toast}
    </>
  )
}
