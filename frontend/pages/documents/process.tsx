import Head from 'next/head'
import { useState, useEffect } from 'react'
import Layout from '../../components/layout/Layout'
import { processDocs, ProcessDoc } from '../../lib/api'

// Tiptap is loaded client-side only
import dynamic from 'next/dynamic'
const ProcessEditor = dynamic(() => import('../../components/process/ProcessEditor'), { ssr: false })

export default function ProcessPage() {
  const [docs, setDocs] = useState<ProcessDoc[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    processDocs.list().then(r => {
      setDocs(r.items.sort((a, b) => a.order - b.order))
      setLoading(false)
    })
  }, [])

  async function addSection() {
    const doc = await processDocs.create({
      title: 'New section',
      body: '<p>Start writing here…</p>',
      order: docs.length,
    })
    setDocs(prev => [...prev, doc])
  }

  async function updateDoc(id: string, data: Partial<ProcessDoc>) {
    const updated = await processDocs.update(id, data)
    setDocs(prev => prev.map(d => d.id === id ? updated : d))
  }

  async function deleteDoc(id: string) {
    await processDocs.delete(id)
    setDocs(prev => prev.filter(d => d.id !== id))
  }

  return (
    <>
      <Head><title>Process — Socioscope</title></Head>
      <Layout title="Process documentation">
        <p style={{ fontSize: 14, color: 'var(--color-warm-gray)', marginBottom: '2rem' }}>
          Transferable knowledge base. Click any section to edit inline.
        </p>

        {loading && <p style={{ color: 'var(--color-warm-gray)', fontSize: 14 }}>Loading…</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {docs.map((doc) => (
            <ProcessEditor
              key={doc.id}
              doc={doc}
              onUpdate={(data) => updateDoc(doc.id, data)}
              onDelete={() => deleteDoc(doc.id)}
            />
          ))}
        </div>

        <button
          onClick={addSection}
          style={{
            marginTop: '2rem',
            padding: '8px 18px',
            border: '1.5px dashed var(--color-border-strong)',
            borderRadius: 'var(--radius-md)',
            background: 'none',
            color: 'var(--color-warm-gray)',
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          + Add section
        </button>
      </Layout>
    </>
  )
}
