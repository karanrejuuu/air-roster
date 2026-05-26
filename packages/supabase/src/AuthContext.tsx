import { type Session, type User } from '@supabase/supabase-js'
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './client'
import { demoCredentials, demoProfileForRole, type DemoRoleKey } from './demoData'
import { type Profile, type UserRole } from './types'

export type AuthContextValue = {
  loading: boolean
  profile: Profile | null
  role: UserRole | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  user: User | null
}

const AuthContext = createContext<AuthContextValue | null>(null)
const demoStorageKey = 'airroster-demo-role'

function roleFromUrl(): DemoRoleKey | null {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('demo')
  if (value === 'admin' || value === 'dispatcher' || value === 'pilot' || value === 'cabin_crew') return value
  return null
}

function loadDemoProfile(): Profile | null {
  if (typeof window === 'undefined') return null
  const urlRole = roleFromUrl()
  const storedRole = window.localStorage?.getItem(demoStorageKey)
  const role = urlRole ?? (storedRole === 'admin' || storedRole === 'dispatcher' || storedRole === 'pilot' || storedRole === 'cabin_crew' ? storedRole : null)
  if (!role) return null
  window.localStorage?.setItem(demoStorageKey, role)
  return demoProfileForRole(role)
}

async function loadProfile(session: Session | null): Promise<Profile | null> {
  if (!session?.user) return null
  const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
  if (error) throw error
  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialDemoProfile = loadDemoProfile()
  const [loading, setLoading] = useState(initialDemoProfile ? false : true)
  const [profile, setProfile] = useState<Profile | null>(initialDemoProfile)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      const demoProfile = loadDemoProfile()
      if (demoProfile) {
        setUser(null)
        setProfile(demoProfile)
        setLoading(false)
        return
      }
      setUser(data.session?.user ?? null)
      setProfile(await loadProfile(data.session))
      setLoading(false)
    }).catch(() => {
      if (!mounted) return
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const demoProfile = loadDemoProfile()
      if (demoProfile) {
        setLoading(false)
        setUser(null)
        setProfile(demoProfile)
        return
      }
      setLoading(true)
      setUser(session?.user ?? null)
      loadProfile(session).then((nextProfile) => {
        setProfile(nextProfile)
        setLoading(false)
      }).catch(() => {
        setProfile(null)
        setLoading(false)
      })
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    loading,
    profile,
    role: profile?.role ?? null,
    signIn: async (email, password) => {
      const demo = demoCredentials[email.toLowerCase()]
      if (demo && demo.password === password) {
        if (typeof window !== 'undefined') window.localStorage?.setItem(demoStorageKey, demo.role)
        setUser(null)
        setProfile(demoProfileForRole(demo.role))
        return
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    signOut: async () => {
      if (typeof window !== 'undefined') window.localStorage?.removeItem(demoStorageKey)
      setProfile(null)
      setUser(null)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
    user
  }), [loading, profile, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function routeForRole(role: UserRole) {
  if (typeof window !== 'undefined' && ['127.0.0.1', 'localhost'].includes(window.location.hostname)) {
    if (role === 'admin') return 'http://127.0.0.1:5174/flights?demo=admin'
    if (role === 'dispatcher') return 'http://127.0.0.1:5174/flights?demo=dispatcher'
    if (role === 'pilot') return 'http://127.0.0.1:5175/?demo=pilot'
    return 'http://127.0.0.1:5175/?demo=cabin_crew'
  }
  if (role === 'admin' || role === 'dispatcher') return '/ops'
  return '/crew'
}
