import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/auth/google/callback
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const userId = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  if (error || !code || !userId) {
    return NextResponse.redirect(`${appUrl}/mailboxes?error=oauth_failed`)
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )

  try {
    const { tokens } = await client.getToken(code)
    client.setCredentials(tokens)

    // Get Gmail address
    const oauth2 = google.oauth2({ version: 'v2', auth: client })
    const { data: profile } = await oauth2.userinfo.get()

    if (!profile.email) {
      return NextResponse.redirect(`${appUrl}/mailboxes?error=no_email`)
    }

    // Upsert mailbox
    const { error: dbErr } = await supabaseAdmin
      .from('mailboxes')
      .upsert({
        user_id: userId,
        email: profile.email,
        display_name: profile.name ?? profile.email,
        provider: 'gmail',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        status: 'connected',
        daily_limit: 30,
      }, { onConflict: 'user_id,email' })

    if (dbErr) {
      console.error('[google oauth callback]', dbErr)
      return NextResponse.redirect(`${appUrl}/mailboxes?error=db_error`)
    }

    return NextResponse.redirect(`${appUrl}/mailboxes?success=gmail_connected&email=${encodeURIComponent(profile.email)}`)
  } catch (err: any) {
    console.error('[google oauth callback]', err.message)
    return NextResponse.redirect(`${appUrl}/mailboxes?error=token_exchange_failed`)
  }
}
