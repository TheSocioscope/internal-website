import { useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { ProcessDoc } from '../../lib/api'

interface ProcessEditorProps {
  doc: ProcessDoc
  onUpdate: (data: Partial<ProcessDoc>) => void
  onDelete: () => void
}

export default function ProcessEditor({ doc, onUpdate, onDelete }: ProcessEditorProps) {
  const [title, setTitle] = useState(doc.title)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing…' }),
      Link.configure({ openOnClick: false }),
    ],
    content: doc.body,
    onBlur: ({ editor }) => {
      handleSave(editor.getHTML())
    },
  })

  async function handleSave(body: string) {
    setSaving(true)
    await onUpdate({ body })
    setSaving(false)
  }

  async function handleTitleBlur() {
    if (title !== doc.title) {
      await onUpdate({ title })
    }
  }

  return (
    <div style={{
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      background: 'white',
      overflow: 'hidden',
    }}>
      {/* Section header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '1rem 1.25rem',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-paper)',
      }}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          style={{
            flex: 1,
            fontFamily: 'var(--font-display)',
            fontSize: '1.1rem',
            fontWeight: 400,
            background: 'none',
            border: 'none',
            outline: 'none',
            color: 'var(--color-ink)',
          }}
        />
        <span style={{ fontSize: 11, color: 'var(--color-warm-gray)' }}>
          {saving ? 'Saving…' : doc.updatedAt ? `Updated ${new Date(doc.updatedAt).toLocaleDateString()}` : ''}
        </span>
        {confirmDelete ? (
          <span style={{ fontSize: 12 }}>
            <button onClick={onDelete} style={{ color: 'var(--color-danger)', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-body)' }}>Confirm delete</button>
            {' '}
            <button onClick={() => setConfirmDelete(false)} style={{ color: 'var(--color-warm-gray)', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-body)' }}>Cancel</button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{ fontSize: 12, color: 'var(--color-warm-gray)', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
          >
            Delete
          </button>
        )}
      </div>

      {/* Editor toolbar */}
      {editor && (
        <div style={{ display: 'flex', gap: 4, padding: '6px 12px', borderBottom: '1px solid var(--color-border)' }}>
          {[
            { label: 'B', action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
            { label: 'I', action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
            { label: 'H2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
            { label: '•', action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
            { label: '1.', action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
            { label: '—', action: () => editor.chain().focus().setHorizontalRule().run(), active: false },
          ].map(btn => (
            <button
              key={btn.label}
              onMouseDown={e => { e.preventDefault(); btn.action() }}
              style={{
                padding: '2px 7px',
                fontSize: 12,
                fontFamily: btn.label === 'B' || btn.label === 'I' ? 'var(--font-display)' : 'var(--font-body)',
                fontWeight: btn.label === 'B' ? 700 : 400,
                fontStyle: btn.label === 'I' ? 'italic' : 'normal',
                border: '1px solid',
                borderColor: btn.active ? 'var(--color-accent-muted)' : 'var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                background: btn.active ? 'var(--color-accent-light)' : 'white',
                color: btn.active ? 'var(--color-accent)' : 'var(--color-ink)',
                cursor: 'pointer',
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}

      {/* Editor content */}
      <div style={{ padding: '1rem 1.25rem' }}>
        <style>{`
          .ProseMirror { outline: none; min-height: 120px; font-size: 14px; line-height: 1.7; color: var(--color-ink); }
          .ProseMirror h2 { font-family: var(--font-display); font-weight: 400; font-size: 1.1rem; margin: 1rem 0 0.5rem; }
          .ProseMirror p { margin: 0.5rem 0; }
          .ProseMirror ul, .ProseMirror ol { padding-left: 1.5rem; }
          .ProseMirror li { margin: 0.2rem 0; }
          .ProseMirror hr { border: none; border-top: 1px solid var(--color-border); margin: 1rem 0; }
          .ProseMirror p.is-editor-empty:first-child::before { color: var(--color-warm-gray); content: attr(data-placeholder); float: left; height: 0; pointer-events: none; }
        `}</style>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
