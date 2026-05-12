import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/router'

interface AuthUser {
  email: string
  exp: number
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  refresh: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkSession()
  }, [])

  async function checkSession() {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/me`, {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })
    setUser(null)
    router.push('/login')
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, refresh: checkSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
