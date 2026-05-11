import Head from 'next/head'
import { useState, useEffect, FormEvent } from 'react'
import Layout from '../../components/layout/Layout'
import { tools as toolsApi, Tool } from '../../lib/api'
import styles from '../../styles/Tools.module.css'

export default function ToolsPage() {
  const [items, setItems] = useState<Tool[]>([])
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Tool | null>(null)
  const [form, setForm] = useState({ name: '', url: '', description: '', category: '' })

  useEffect(() => { toolsApi.list().then(r => setItems(r.items)) }, [])

  const categories = Array.from(new Set(items.map(t => t.category))).sort()
  const grouped = categories.reduce((acc, cat) => {
    acc[cat] = items.filter(t => t.category === cat)
    return acc
  }, {} as Record<string, Tool[]>)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (editing) {
      const updated = await toolsApi.update(editing.id, form)
      setItems(prev => prev.map(t => t.id === editing.id ? updated : t))
      setEditing(null)
    } else {
      const created = await toolsApi.create(form)
      setItems(prev => [...prev, created])
      setAdding(false)
    }
    setForm({ name: '', url: '', description: '', category: '' })
  }

  async function handleDelete(id: string) {
    await toolsApi.delete(id)
    setItems(prev => prev.filter(t => t.id !== id))
  }

  function startEdit(tool: Tool) {
    setEditing(tool)
    setForm({ name: tool.name, url: tool.url, description: tool.description, category: tool.category })
    setAdding(false)
  }

  return (
    <>
      <Head><title>Tools — Socioscope</title></Head>
      <Layout title="Tools">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
          <button onClick={() => { setAdding(v => !v); setEditing(null) }} className={styles.addBtn}>
            {adding ? 'Cancel' : '+ Add tool'}
          </button>
        </div>

        {(adding || editing) && (
          <form onSubmit={handleSubmit} className={styles.form}>
            <input
              placeholder="Tool name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required className={styles.input} autoFocus
            />
            <input
              placeholder="URL"
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              required className={styles.input} type="url"
            />
            <input
              placeholder="Category (e.g. Data Collection, Analysis)"
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              required className={styles.input}
            />
            <textarea
              placeholder="Short description"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className={styles.textarea} rows={2}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className={styles.submitBtn}>
                {editing ? 'Save changes' : 'Add tool'}
              </button>
              {editing && (
                <button type="button" onClick={() => setEditing(null)} className={styles.cancelBtn}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}

        {Object.entries(grouped).map(([category, categoryTools]) => (
          <div key={category} className={styles.category}>
            <h2 className={styles.categoryTitle}>{category}</h2>
            <div className={styles.toolGrid}>
              {categoryTools.map(tool => (
                <div key={tool.id} className={styles.toolCard}>
                  <div className={styles.toolHead}>
                    <a href={tool.url} target="_blank" rel="noreferrer" className={styles.toolName}>
                      {tool.name} ↗
                    </a>
                    <div className={styles.toolActions}>
                      <button onClick={() => startEdit(tool)} className={styles.actionBtn}>Edit</button>
                      <button onClick={() => handleDelete(tool.id)} className={`${styles.actionBtn} ${styles.danger}`}>Delete</button>
                    </div>
                  </div>
                  {tool.description && <p className={styles.toolDesc}>{tool.description}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}

        {items.length === 0 && !adding && (
          <p style={{ color: 'var(--color-warm-gray)', fontSize: 14 }}>No tools yet. Add one above.</p>
        )}
      </Layout>
    </>
  )
}
