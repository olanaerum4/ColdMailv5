import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/auth/microsoft/callback
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const userId = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  if (error || !code || !userId) {
    return NextResponse.redirect(`${appUrl}/mailboxes?error=oauth_failed`)
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        code,
        redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
        grant_type: 'authorization_code',
      }).toString(),
    })

    const tokens = await tokenRes.json()
    if (tokens.error) throw new Error(tokens.error_description)

    // Get user profile
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = await profileRes.json()
    const email = profile.mail ?? profile.userPrincipalName

    if (!email) return NextResponse.redirect(`${appUrl}/mailboxes?error=no_email`)

    const expiryDate = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    await supabaseAdmin.from('mailboxes').upsert({
      user_id: userId,
      email,
      display_name: profile.displayName ?? email,
      provider: 'outlook',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: expiryDate,
      status: 'connected',
      daily_limit: 30,
    }, { onConflict: 'user_id,email' })

    return NextResponse.redirect(`${appUrl}/mailboxes?success=outlook_connected&email=${encodeURIComponent(email)}`)
  } catch (err: any) {
    console.error('[microsoft oauth callback]', err.message)
    return NextResponse.redirect(`${appUrl}/mailboxes?error=token_exchange_failed`)
  }
}
