import Head from 'next/head'
import { useState, useEffect, FormEvent } from 'react'
import Layout from '../components/layout/Layout'
import { resources as resourcesApi, Resource } from '../lib/api'

export default function ResourcesPage() {
  const [items, setItems] = useState<Resource[]>([])
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ title: '', url: '', author: '', description: '', tags: '' })

  useEffect(() => {
    resourcesApi.list().then(r => setItems(r.items))
  }, [])

  const allTags = Array.from(new Set(items.flatMap(r => r.tags))).sort()
  const filtered = activeTag ? items.filter(r => r.tags.includes(activeTag)) : items

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
    const item = await resourcesApi.create({ ...form, tags })
    setItems(prev => [item, ...prev])
    setForm({ title: '', url: '', author: '', description: '', tags: '' })
    setAdding(false)
  }

  async function handleDelete(id: string) {
    await resourcesApi.delete(id)
    setItems(prev => prev.filter(r => r.id !== id))
  }

  return (
    <>
      <Head><title>Resources — Socioscope</title></Head>
      <Layout title="Resources">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTag(null)}
              style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, border: '1px solid var(--color-border)', background: activeTag === null ? 'var(--color-accent-light)' : 'white', color: activeTag === null ? 'var(--color-accent)' : 'var(--color-ink)', cursor: 'pointer' }}
            >
              All
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag === activeTag ? null : tag)}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, border: '1px solid var(--color-border)', background: activeTag === tag ? 'var(--color-accent-light)' : 'white', color: activeTag === tag ? 'var(--color-accent)' : 'var(--color-ink)', cursor: 'pointer' }}
              >
                {tag}
              </button>
            ))}
          </div>
          <button onClick={() => setAdding(v => !v)} style={{ fontSize: 13, padding: '5px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'white', cursor: 'pointer', flexShrink: 0 }}>
            {adding ? 'Cancel' : '+ Add resource'}
          </button>
        </div>

        {adding && (
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--color-paper)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem' }}>
            <input placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required style={{ padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none' }} autoFocus />
            <input placeholder="URL" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} required type="url" style={{ padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none' }} />
            <input placeholder="Author / source" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} style={{ padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none' }} />
            <textarea placeholder="Short description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', resize: 'vertical' }} />
            <input placeholder="Tags (comma-separated)" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} style={{ padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none' }} />
            <button type="submit" style={{ alignSelf: 'flex-start', padding: '7px 16px', background: 'var(--color-accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, cursor: 'pointer' }}>Add resource</button>
          </form>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {filtered.map(item => (
            <div key={item.id} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', background: 'white', position: 'relative' }}>
              <a href={item.url} target="_blank" rel="noreferrer" style={{ fontWeight: 500, fontSize: 14, color: 'var(--color-ink)', display: 'block', marginBottom: 4 }}>{item.title} ↗</a>
              {item.author && <p style={{ fontSize: 12, color: 'var(--color-warm-gray)', marginBottom: 6 }}>{item.author}</p>}
              {item.description && <p style={{ fontSize: 13, color: 'var(--color-ink)', lineHeight: 1.5, marginBottom: 8 }}>{item.description}</p>}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {item.tags.map(tag => (
                  <span key={tag} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>{tag}</span>
                ))}
              </div>
              <button onClick={() => handleDelete(item.id)} style={{ position: 'absolute', top: 8, right: 8, fontSize: 11, padding: '2px 7px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'white', cursor: 'pointer', color: 'var(--color-warm-gray)', opacity: 0 }} className="delete-btn">Delete</button>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <p style={{ fontSize: 14, color: 'var(--color-warm-gray)' }}>No resources yet.</p>
        )}

        <style>{`.delete-btn { opacity: 0; transition: opacity 0.15s; } *:hover > .delete-btn { opacity: 1; }`}</style>
      </Layout>
    </>
  )
}
