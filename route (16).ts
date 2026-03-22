import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/track/open/[trackingId]
// Returns a 1x1 transparent GIF and logs the open
export async function GET(req: NextRequest, { params }: { params: Promise<{ trackingId: string }> }) {
  const { trackingId } = await params

  // Fire and forget — don't block pixel response
  updateOpenTracking(trackingId, req).catch(console.error)

  // Return 1x1 transparent GIF
  const pixel = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
  )

  return new NextResponse(pixel, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}

async function updateOpenTracking(trackingId: string, req: NextRequest) {
  const { data: email } = await supabaseAdmin
    .from('sent_emails')
    .select('id, open_count, campaign_id, lead_id, campaign_lead_id')
    .eq('tracking_pixel_id', trackingId)
    .single()

  if (!email) return

  const now = new Date().toISOString()

  await supabaseAdmin.from('sent_emails').update({
    opened_at: email.open_count === 0 ? now : undefined,
    open_count: (email.open_count ?? 0) + 1,
  }).eq('tracking_pixel_id', trackingId)

  // Update campaign open count (only on first open)
  if (email.open_count === 0 && email.campaign_id) {
    await supabaseAdmin.rpc('increment_campaign_opens', { cid: email.campaign_id })
  }
}
