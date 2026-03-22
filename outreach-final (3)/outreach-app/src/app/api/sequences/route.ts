import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionUser } from '@/lib/auth'

// GET /api/sequences
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('sequences')
    .select('*, steps:sequence_steps(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sort steps by step_number
  const result = (data ?? []).map((seq: any) => ({
    ...seq,
    steps: (seq.steps ?? []).sort((a: any, b: any) => a.step_number - b.step_number),
  }))

  return NextResponse.json(result)
}

// POST /api/sequences
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, description, steps } = body

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { data: seq, error: seqErr } = await supabaseAdmin
    .from('sequences')
    .insert({ user_id: user.id, name, description })
    .select()
    .single()

  if (seqErr) return NextResponse.json({ error: seqErr.message }, { status: 500 })

  if (steps?.length) {
    const { error: stepsErr } = await supabaseAdmin
      .from('sequence_steps')
      .insert(
        steps.map((s: any, i: number) => ({
          sequence_id: seq.id,
          step_number: i,
          subject: s.subject,
          body: s.body,
          wait_days: s.wait_days ?? (i === 0 ? 0 : 3),
          only_if_no_reply: s.only_if_no_reply ?? true,
        }))
      )
    if (stepsErr) return NextResponse.json({ error: stepsErr.message }, { status: 500 })
  }

  return NextResponse.json({ ...seq, steps: steps ?? [] }, { status: 201 })
}
