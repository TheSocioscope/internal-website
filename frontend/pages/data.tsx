import Head from 'next/head'
import { useState, useEffect, FormEvent } from 'react'
import Layout from '../components/layout/Layout'
import FileBrowser from '../components/files/FileBrowser'
import { links as linksApi, Link } from '../lib/api'

export default function DataPage() {
  const [corpusLinks, setCorpusLinks] = useState<Link[]>([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ title: '', url: '', description: '' })

  useEffect(() => {
    linksApi.list('data').then(r => setCorpusLinks(r.items))
  }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const item = await linksApi.create({ ...form, category: 'data', starred: false, order: corpusLinks.length })
    setCorpusLinks(prev => [...prev, item])
    setForm({ title: '', url: '', description: '' })
    setAdding(false)
  }

  async function handleDelete(id: string) {
    await linksApi.delete(id)
    setCorpusLinks(prev => prev.filter(l => l.id !== id))
  }

  return (
    <>
      <Head><title>Data — Socioscope</title></Head>
      <Layout title="Data">
        <section style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 400 }}>Corpus links</h2>
            <button onClick={() => setAdding(v => !v)} style={{ fontSize: 13, padding: '5px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'white', cursor: 'pointer' }}>
              {adding ? 'Cancel' : '+ Add link'}
            </button>
          </div>

          {adding && (
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--color-paper)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem' }}>
              <input placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required style={{ padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none' }} autoFocus />
              <input placeholder="URL" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} required type="url" style={{ padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none' }} />
              <input placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none' }} />
              <button type="submit" style={{ alignSelf: 'flex-start', padding: '7px 16px', background: 'var(--color-accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, cursor: 'pointer' }}>Add</button>
            </form>
          )}

          {corpusLinks.map(link => (
            <div key={link.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ flex: 1 }}>
                <a href={link.url} target="_blank" rel="noreferrer" style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-accent)' }}>{link.title} ↗</a>
                {link.description && <p style={{ fontSize: 12, color: 'var(--color-warm-gray)', margin: '2px 0 0' }}>{link.description}</p>}
              </div>
              <button onClick={() => handleDelete(link.id)} style={{ fontSize: 11, padding: '3px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'white', cursor: 'pointer', color: 'var(--color-warm-gray)' }}>Delete</button>
            </div>
          ))}

          {corpusLinks.length === 0 && !adding && (
            <p style={{ fontSize: 14, color: 'var(--color-warm-gray)' }}>No corpus links yet.</p>
          )}
        </section>

        <section>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 400, marginBottom: '1rem' }}>Data files</h2>
          <FileBrowser prefix="data/" />
        </section>
      </Layout>
    </>
  )
}
