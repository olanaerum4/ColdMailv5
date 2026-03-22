import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionUser } from '@/lib/auth'

// PUT /api/sequences/[id] — full replace (name + all steps)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, description, steps } = body

  // Verify ownership
  const { data: existing } = await supabaseAdmin
    .from('sequences')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Update sequence meta
  await supabaseAdmin
    .from('sequences')
    .update({ name, description })
    .eq('id', id)

  // Replace all steps
  if (steps) {
    await supabaseAdmin.from('sequence_steps').delete().eq('sequence_id', id)

    if (steps.length) {
      await supabaseAdmin.from('sequence_steps').insert(
        steps.map((s: any, i: number) => ({
          sequence_id: id,
          step_number: i,
          subject: s.subject,
          body: s.body,
          wait_days: s.wait_days ?? (i === 0 ? 0 : 3),
          only_if_no_reply: s.only_if_no_reply ?? true,
        }))
      )
    }
  }

  const { data } = await supabaseAdmin
    .from('sequences')
    .select('*, steps:sequence_steps(*)')
    .eq('id', id)
    .single()

  return NextResponse.json(data)
}

// DELETE /api/sequences/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabaseAdmin
    .from('sequences')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
