import Head from 'next/head'
import { useState, useEffect, FormEvent } from 'react'
import Layout from '../../components/layout/Layout'
import { credentials as credApi, Credential } from '../../lib/api'
import styles from '../../styles/Credentials.module.css'

export default function CredentialsPage() {
  const [items, setItems] = useState<Credential[]>([])
  const [adding, setAdding] = useState(false)
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [form, setForm] = useState({ service: '', username: '', password: '', url: '', notes: '' })

  useEffect(() => { credApi.list().then(r => setItems(r.items)) }, [])

  async function handleReveal(id: string) {
    const { value } = await credApi.reveal(id)
    setRevealed(r => ({ ...r, [id]: value }))
    setTimeout(() => setRevealed(r => { const n = { ...r }; delete n[id]; return n }), 30000)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const created = await credApi.create(form)
    setItems(prev => [...prev, created])
    setForm({ service: '', username: '', password: '', url: '', notes: '' })
    setAdding(false)
  }

  async function handleDelete(id: string) {
    await credApi.delete(id)
    setItems(prev => prev.filter(c => c.id !== id))
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text)
  }

  return (
    <>
      <Head><title>Credentials — Socioscope</title></Head>
      <Layout title="Credentials">
        <p className={styles.notice}>
          Passwords are blurred by default. Click "Reveal" to view for 30 seconds. All reveal events are logged.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
          <button onClick={() => setAdding(v => !v)} className={styles.addBtn}>
            {adding ? 'Cancel' : '+ Add credential'}
          </button>
        </div>

        {adding && (
          <form onSubmit={handleSubmit} className={styles.form}>
            <input placeholder="Service name" value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))} required className={styles.input} autoFocus />
            <input placeholder="URL" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className={styles.input} type="url" />
            <input placeholder="Username / email" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className={styles.input} />
            <input placeholder="Password or token" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className={styles.input} type="password" />
            <textarea placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={styles.textarea} rows={2} />
            <button type="submit" className={styles.submitBtn}>Save credential</button>
          </form>
        )}

        <div className={styles.list}>
          {items.map(item => {
            const isRevealed = !!revealed[item.id]
            return (
              <div key={item.id} className={styles.credCard}>
                <div className={styles.credHead}>
                  <div>
                    <span className={styles.credService}>{item.service}</span>
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noreferrer" className={styles.credUrl}>
                        {item.url} ↗
                      </a>
                    )}
                  </div>
                  <button onClick={() => handleDelete(item.id)} className={styles.deleteBtn}>Delete</button>
                </div>

                {item.username && (
                  <div className={styles.credRow}>
                    <span className={styles.credLabel}>Username</span>
                    <span className={styles.credValue}>{item.username}</span>
                    <button onClick={() => copyToClipboard(item.username)} className={styles.copyBtn}>Copy</button>
                  </div>
                )}

                <div className={styles.credRow}>
                  <span className={styles.credLabel}>Password</span>
                  <span className={`${styles.credValue} ${styles.mono} ${!isRevealed ? styles.blurred : ''}`}>
                    {isRevealed ? revealed[item.id] : '••••••••••••'}
                  </span>
                  {isRevealed
                    ? <button onClick={() => copyToClipboard(revealed[item.id])} className={styles.copyBtn}>Copy</button>
                    : <button onClick={() => handleReveal(item.id)} className={styles.revealBtn}>Reveal</button>
                  }
                </div>

                {item.notes && <p className={styles.credNotes}>{item.notes}</p>}
              </div>
            )
          })}
        </div>

        {items.length === 0 && !adding && (
          <p style={{ color: 'var(--color-warm-gray)', fontSize: 14 }}>No credentials stored yet.</p>
        )}
      </Layout>
    </>
  )
}
