import { useState, FormEvent } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { auth } from '../lib/api'
import { useAuth } from '../lib/auth'
import styles from '../styles/Login.module.css'

type Step = 'email' | 'otp' | 'loading'

export default function LoginPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [pendingToken, setPendingToken] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const { refresh } = useAuth()

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setStep('loading')
    try {
      const { pendingToken: token } = await auth.requestOtp(email)
      setPendingToken(token)
      setStep('otp')
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Failed to send code. Please try again.')
      setStep('email')
    }
  }

  async function handleOtpSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setStep('loading')
    try {
      await auth.verifyOtp(pendingToken, otp)
      await refresh()
      router.push('/')
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Invalid or expired code. Please try again.')
      setStep('otp')
    }
  }

  return (
    <>
      <Head><title>Sign in — Socioscope</title></Head>
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.logo}>
            <span className={styles.logoMark}>S</span>
            <span className={styles.logoText}>Socioscope</span>
          </div>

          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className={styles.form}>
              <p className={styles.hint}>Enter your team email to receive a sign-in code.</p>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus
                className={styles.input}
              />
              {error && <p className={styles.error}>{error}</p>}
              <button type="submit" className={styles.btn}>Send code</button>
            </form>
          )}

          {step === 'loading' && (
            <p className={styles.hint} style={{ textAlign: 'center' }}>Sending…</p>
          )}

          {step === 'otp' && (
            <form onSubmit={handleOtpSubmit} className={styles.form}>
              <p className={styles.hint}>
                We sent a 6-digit code to <strong>{email}</strong>.
              </p>
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                pattern="[0-9]{6}"
                required
                autoFocus
                className={styles.input}
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.3em', textAlign: 'center' }}
              />
              {error && <p className={styles.error}>{error}</p>}
              <button type="submit" className={styles.btn}>Sign in</button>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => { setStep('email'); setOtp(''); setError('') }}
              >
                Use a different email
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  )
}
