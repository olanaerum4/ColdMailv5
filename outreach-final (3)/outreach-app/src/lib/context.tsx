'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AppContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
  // Shared data
  mailboxes: any[]
  campaigns: any[]
  sequences: any[]
  inboxCount: number
  refreshMailboxes: () => Promise<void>
  refreshCampaigns: () => Promise<void>
  refreshSequences: () => Promise<void>
  refreshInboxCount: () => Promise<void>
}

const AppContext = createContext<AppContextType>({} as AppContextType)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [mailboxes, setMailboxes] = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [sequences, setSequences] = useState<any[]>([])
  const [inboxCount, setInboxCount] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const refreshMailboxes = useCallback(async () => {
    const res = await fetch('/api/mailboxes')
    if (res.ok) setMailboxes(await res.json())
  }, [])

  const refreshCampaigns = useCallback(async () => {
    const res = await fetch('/api/campaigns')
    if (res.ok) setCampaigns(await res.json())
  }, [])

  const refreshSequences = useCallback(async () => {
    const res = await fetch('/api/sequences')
    if (res.ok) setSequences(await res.json())
  }, [])

  const refreshInboxCount = useCallback(async () => {
    const res = await fetch('/api/inbox?unread=true')
    if (res.ok) {
      const data = await res.json()
      setInboxCount(Array.isArray(data) ? data.length : 0)
    }
  }, [])

  useEffect(() => {
    if (user) {
      refreshMailboxes()
      refreshCampaigns()
      refreshSequences()
      refreshInboxCount()
    }
  }, [user])

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <AppContext.Provider value={{
      user, loading, signOut,
      mailboxes, campaigns, sequences, inboxCount,
      refreshMailboxes, refreshCampaigns, refreshSequences, refreshInboxCount,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
