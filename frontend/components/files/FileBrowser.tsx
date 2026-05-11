import { useState, useEffect, useCallback } from 'react'
import { files, FileItem } from '../../lib/api'
import { format, parseISO } from 'date-fns'
import styles from './FileBrowser.module.css'

interface FileBrowserProps {
  prefix: string
  groupByMonth?: boolean
}

export default function FileBrowser({ prefix, groupByMonth = false }: FileBrowserProps) {
  const [items, setItems] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ message: string; undoKey?: string } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [prefix])

  async function load() {
    setLoading(true)
    try {
      const res = await files.list(prefix)
      setItems(res.files)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(fileList)) {
        const key = `${prefix}${file.name}`
        const { url } = await files.getUploadUrl(key, file.type)
        await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      }
      await load()
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(item: FileItem) {
    const { url } = await files.getDownloadUrl(item.key)
    window.open(url, '_blank')
  }

  async function handleDelete(item: FileItem) {
    await files.delete(item.key)
    setItems(prev => prev.filter(f => f.key !== item.key))
    setToast({
      message: `${item.name} deleted`,
      undoKey: item.key,
    })
    setTimeout(() => setToast(null), 5000)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleUpload(e.dataTransfer.files)
  }, [prefix])

  const filtered = items.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = groupByMonth
    ? filtered.reduce((acc, item) => {
        const month = format(parseISO(item.lastModified), 'MMMM yyyy')
        if (!acc[month]) acc[month] = []
        acc[month].push(item)
        return acc
      }, {} as Record<string, FileItem[]>)
    : null

  return (
    <div className={styles.browser}>
      {/* Upload zone */}
      <div
        className={`${styles.uploadZone} ${dragging ? styles.uploadZoneDragging : ''} ${uploading ? styles.uploadZoneUploading : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleUpload(e.target.files)}
        />
        {uploading
          ? <span className={styles.uploadLabel}>Uploading…</span>
          : <span className={styles.uploadLabel}>
              Drop files here or <u>click to browse</u>
            </span>
        }
      </div>

      {/* Search */}
      {items.length > 5 && (
        <input
          type="search"
          placeholder="Search files…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={styles.search}
        />
      )}

      {/* File list */}
      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p className={styles.empty}>No files yet.</p>
      ) : grouped ? (
        Object.entries(grouped).reverse().map(([month, monthFiles]) => (
          <div key={month} className={styles.group}>
            <h3 className={styles.groupHeader}>{month}</h3>
            {monthFiles.map(item => (
              <FileRow
                key={item.key}
                item={item}
                onDownload={handleDownload}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ))
      ) : (
        filtered.map(item => (
          <FileRow
            key={item.key}
            item={item}
            onDownload={handleDownload}
            onDelete={handleDelete}
          />
        ))
      )}

      {/* Toast */}
      {toast && (
        <div className={styles.toast}>
          {toast.message}
        </div>
      )}
    </div>
  )
}

function FileRow({
  item,
  onDownload,
  onDelete,
}: {
  item: FileItem
  onDownload: (item: FileItem) => void
  onDelete: (item: FileItem) => void
}) {
  const ext = item.name.split('.').pop()?.toUpperCase() ?? '—'
  const size = item.size > 1024 * 1024
    ? `${(item.size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(item.size / 1024)} KB`

  return (
    <div className={styles.fileRow}>
      <span className={styles.fileExt}>{ext}</span>
      <span className={styles.fileName}>{item.name}</span>
      <span className={styles.fileMeta}>
        {format(parseISO(item.lastModified), 'd MMM yyyy')}
        {item.uploadedBy && ` · ${item.uploadedBy}`}
        {' · '}{size}
      </span>
      <div className={styles.fileActions}>
        <button onClick={() => onDownload(item)} className={styles.actionBtn}>Download</button>
        <button onClick={() => onDelete(item)} className={`${styles.actionBtn} ${styles.actionBtnDanger}`}>Delete</button>
      </div>
    </div>
  )
}
