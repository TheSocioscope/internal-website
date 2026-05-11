import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from '../lib/auth'
import '../styles/globals.css'

const PUBLIC_ROUTES = ['/login']

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user && !PUBLIC_ROUTES.includes(router.pathname)) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontFamily: 'var(--font-body)',
        color: 'var(--color-warm-gray)', fontSize: '14px',
      }}>
        Loading…
      </div>
    )
  }

  if (!user && !PUBLIC_ROUTES.includes(router.pathname)) return null

  return <>{children}</>
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <AuthGuard>
        <Component {...pageProps} />
      </AuthGuard>
    </AuthProvider>
  )
}
