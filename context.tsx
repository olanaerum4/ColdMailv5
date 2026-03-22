import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionUser } from '@/lib/auth'

// GET /api/leads
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') ?? '1')
  const limit = parseInt(url.searchParams.get('limit') ?? '100')
  const search = url.searchParams.get('search') ?? ''
  const offset = (page - 1) * limit

  let query = supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,company.ilike.%${search}%`)
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count, page, limit })
}

// POST /api/leads — bulk upsert from JSON or CSV
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contentType = req.headers.get('content-type') ?? ''
  let leads: any[] = []

  if (contentType.includes('text/csv')) {
    // Parse CSV
    const text = await req.text()
    leads = parseCSV(text)
  } else {
    const body = await req.json()
    leads = body.leads ?? [body]
  }

  if (!leads.length) return NextResponse.json({ error: 'No leads provided' }, { status: 400 })

  // Validate emails
  const valid = leads.filter(l => l.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l.email))
  const invalid = leads.length - valid.length

  if (!valid.length) return NextResponse.json({ error: 'No valid email addresses found' }, { status: 400 })

  // Check suppression list
  const { data: unsubs } = await supabaseAdmin
    .from('unsubscribes')
    .select('email')
    .eq('user_id', user.id)

  const suppressed = new Set((unsubs ?? []).map((u: any) => u.email.toLowerCase()))
  const filtered = valid.filter(l => !suppressed.has(l.email.toLowerCase()))
  const suppressedCount = valid.length - filtered.length

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('leads')
    .upsert(
      filtered.map(l => ({
        user_id: user.id,
        email: l.email.toLowerCase().trim(),
        first_name: l.first_name ?? l.firstName ?? l['First Name'] ?? null,
        last_name: l.last_name ?? l.lastName ?? l['Last Name'] ?? null,
        company: l.company ?? l.Company ?? l.organization ?? null,
        title: l.title ?? l.Title ?? l.position ?? null,
        city: l.city ?? l.City ?? null,
        tags: l.tags ? (Array.isArray(l.tags) ? l.tags : l.tags.split(',').map((t: string) => t.trim())) : [],
        custom_vars: extractCustomVars(l),
      })),
      { onConflict: 'user_id,email' }
    )
    .select('id')

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  return NextResponse.json({
    imported: inserted?.length ?? 0,
    invalid,
    suppressed: suppressedCount,
    total: leads.length,
  }, { status: 201 })
}

// DELETE /api/leads — bulk delete or unsubscribe
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { ids, emails, action } = body // action: 'delete' | 'unsubscribe'

  if (action === 'unsubscribe' && emails?.length) {
    await supabaseAdmin.from('unsubscribes').upsert(
      emails.map((e: string) => ({ user_id: user.id, email: e.toLowerCase() })),
      { onConflict: 'user_id,email' }
    )
    await supabaseAdmin.from('leads').update({ unsubscribed: true, unsubscribed_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .in('email', emails.map((e: string) => e.toLowerCase()))
    return NextResponse.json({ ok: true, unsubscribed: emails.length })
  }

  if (ids?.length) {
    await supabaseAdmin.from('leads').delete().eq('user_id', user.id).in('id', ids)
  }

  return NextResponse.json({ ok: true })
}

// ─── CSV Parser ───────────────────────────────
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const vals = splitCSVLine(lines[i])
    if (!vals.length) continue
    const row: Record<string, string> = {}
    headers.forEach((h, j) => {
      row[h] = (vals[j] ?? '').trim().replace(/^"|"$/g, '')
    })
    rows.push(row)
  }

  return rows
}

function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

const KNOWN_FIELDS = new Set(['email', 'first_name', 'last_name', 'firstName', 'lastName', 'company', 'title', 'city', 'tags', 'First Name', 'Last Name', 'Company', 'Title', 'City'])

function extractCustomVars(lead: Record<string, string>): Record<string, string> {
  const custom: Record<string, string> = {}
  for (const [k, v] of Object.entries(lead)) {
    if (!KNOWN_FIELDS.has(k) && k !== 'email' && v) {
      custom[k] = v
    }
  }
  return custom
}
