import { useState, useEffect, useCallback, useRef } from 'react'
import { files, FileItem, FolderItem } from '../../lib/api'
import { format, parseISO } from 'date-fns'
import styles from './FileBrowser.module.css'

interface FileBrowserProps {
  prefix: string
  groupByMonth?: boolean
  hierarchical?: boolean
}

const EDITABLE_EXTENSIONS = new Set([
  'md', 'txt', 'csv', 'tsv', 'json', 'yml', 'yaml', 'log', 'xml', 'html', 'css', 'js', 'ts',
])

function isEditable(name: string) {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  return EDITABLE_EXTENSIONS.has(ext)
}

function contentTypeFor(name: string) {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  if (ext === 'md') return 'text/markdown'
  if (ext === 'json') return 'application/json'
  if (ext === 'csv') return 'text/csv'
  if (ext === 'html') return 'text/html'
  return 'text/plain'
}

export default function FileBrowser({ prefix, groupByMonth = false, hierarchical = false }: FileBrowserProps) {
  const [items, setItems] = useState<FileItem[]>([])
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [subPath, setSubPath] = useState('')  // relative to `prefix`, ends with '/' or is ''
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ message: string; undoKey?: string } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<{ item: FileItem; content: string; saving: boolean } | null>(null)
  const replaceTarget = useRef<FileItem | null>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  const effectivePrefix = hierarchical ? `${prefix}${subPath}` : prefix

  useEffect(() => { setSubPath('') }, [prefix])
  useEffect(() => { load() }, [effectivePrefix, hierarchical])

  async function load() {
    setLoading(true)
    try {
      if (hierarchical) {
        const res = await files.listHierarchical(effectivePrefix)
        setItems(res.files)
        setFolders(res.folders)
      } else {
        const res = await files.list(effectivePrefix)
        setItems(res.files)
        setFolders([])
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(fileList)) {
        const key = `${effectivePrefix}${file.name}`
        const { url } = await files.getUploadUrl(key, file.type)
        await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      }
      await load()
    } finally {
      setUploading(false)
    }
  }

  async function handleCreateFolder() {
    const raw = window.prompt('New folder name:')
    if (!raw) return
    const name = raw.trim().replace(/^\/+|\/+$/g, '')
    if (!name) return
    if (name.includes('/')) {
      window.alert('Folder name cannot contain "/"')
      return
    }
    if (folders.some(f => f.name === name)) {
      window.alert('A folder with that name already exists here.')
      return
    }
    try {
      await files.createFolder(`${effectivePrefix}${name}/`)
      await load()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not create folder')
    }
  }

  async function handleDeleteFolder(folder: FolderItem) {
    if (!window.confirm(`Delete folder "${folder.name}" and everything in it?`)) return
    try {
      await files.delete(folder.key)
      await load()
      setToast({ message: `Folder "${folder.name}" deleted` })
      setTimeout(() => setToast(null), 3000)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not delete folder')
    }
  }

  function navigateToFolder(folder: FolderItem) {
    setSubPath(folder.key.slice(prefix.length))
  }

  function navigateToCrumb(segmentIndex: number) {
    const parts = subPath.split('/').filter(Boolean)
    const next = parts.slice(0, segmentIndex + 1).join('/')
    setSubPath(next ? `${next}/` : '')
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

  async function handleRename(item: FileItem) {
    const newName = window.prompt('Rename file:', item.name)
    if (!newName || newName.trim() === '' || newName === item.name) return
    if (newName.includes('/')) {
      window.alert('Name cannot contain "/"')
      return
    }
    const lastSlash = item.key.lastIndexOf('/')
    const dir = lastSlash >= 0 ? item.key.slice(0, lastSlash + 1) : ''
    const toKey = `${dir}${newName.trim()}`
    if (items.some(f => f.key === toKey)) {
      window.alert('A file with that name already exists here.')
      return
    }
    try {
      await files.rename(item.key, toKey)
      await load()
      setToast({ message: `Renamed to ${newName.trim()}` })
      setTimeout(() => setToast(null), 3000)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Rename failed')
    }
  }

  function handleReplaceClick(item: FileItem) {
    replaceTarget.current = item
    replaceInputRef.current?.click()
  }

  async function handleReplaceFile(picked: FileList | null) {
    const file = picked?.[0]
    const target = replaceTarget.current
    replaceTarget.current = null
    if (replaceInputRef.current) replaceInputRef.current.value = ''
    if (!file || !target) return
    setUploading(true)
    try {
      const { url } = await files.getUploadUrl(target.key, file.type || contentTypeFor(target.name))
      await fetch(url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || contentTypeFor(target.name) },
      })
      await load()
      setToast({ message: `Replaced ${target.name}` })
      setTimeout(() => setToast(null), 3000)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Replace failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleEdit(item: FileItem) {
    try {
      const { url } = await files.getDownloadUrl(item.key)
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Could not load file (${res.status})`)
      const text = await res.text()
      setEditing({ item, content: text, saving: false })
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not open file')
    }
  }

  async function handleEditSave() {
    if (!editing) return
    setEditing({ ...editing, saving: true })
    try {
      const ct = contentTypeFor(editing.item.name)
      const { url } = await files.getUploadUrl(editing.item.key, ct)
      const res = await fetch(url, {
        method: 'PUT',
        body: editing.content,
        headers: { 'Content-Type': ct },
      })
      if (!res.ok) throw new Error(`Upload failed (${res.status})`)
      await load()
      setEditing(null)
      setToast({ message: `Saved ${editing.item.name}` })
      setTimeout(() => setToast(null), 3000)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Save failed')
      setEditing(prev => prev && { ...prev, saving: false })
    }
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

  const crumbSegments = subPath.split('/').filter(Boolean)

  return (
    <div className={styles.browser}>
      {hierarchical && (
        <div className={styles.breadcrumbBar}>
          <nav className={styles.breadcrumbs} aria-label="Folder path">
            <button
              type="button"
              onClick={() => setSubPath('')}
              className={styles.crumb}
              disabled={crumbSegments.length === 0}
            >
              Root
            </button>
            {crumbSegments.map((seg, i) => (
              <span key={i} className={styles.crumbWrap}>
                <span className={styles.crumbSep}>/</span>
                <button
                  type="button"
                  onClick={() => navigateToCrumb(i)}
                  className={styles.crumb}
                  disabled={i === crumbSegments.length - 1}
                >
                  {seg}
                </button>
              </span>
            ))}
          </nav>
          <button type="button" onClick={handleCreateFolder} className={styles.actionBtn}>
            + New folder
          </button>
        </div>
      )}

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

      {/* Folder list (hierarchical mode) */}
      {hierarchical && folders.length > 0 && (
        <div className={styles.folderList}>
          {folders
            .filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
            .map(folder => (
              <div key={folder.key} className={styles.folderRow}>
                <span className={styles.folderIcon}>▸</span>
                <button
                  type="button"
                  className={styles.folderName}
                  onClick={() => navigateToFolder(folder)}
                >
                  {folder.name}
                </button>
                <div className={styles.fileActions}>
                  <button
                    onClick={() => handleDeleteFolder(folder)}
                    className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* File list */}
      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : filtered.length === 0 && folders.length === 0 ? (
        <p className={styles.empty}>{hierarchical ? 'Empty folder.' : 'No files yet.'}</p>
      ) : filtered.length === 0 ? (
        null
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
                onRename={handleRename}
                onReplace={handleReplaceClick}
                onEdit={handleEdit}
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
            onRename={handleRename}
            onReplace={handleReplaceClick}
            onEdit={handleEdit}
          />
        ))
      )}

      {/* Hidden input for Replace */}
      <input
        ref={replaceInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={e => handleReplaceFile(e.target.files)}
      />

      {/* Edit modal */}
      {editing && (
        <div className={styles.modalOverlay} onClick={() => !editing.saving && setEditing(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <span className={styles.modalTitle}>{editing.item.name}</span>
              <button
                className={styles.actionBtn}
                onClick={() => setEditing(null)}
                disabled={editing.saving}
              >
                Cancel
              </button>
            </div>
            <textarea
              className={styles.editor}
              value={editing.content}
              onChange={e => setEditing({ ...editing, content: e.target.value })}
              spellCheck={false}
              autoFocus
            />
            <div className={styles.modalFoot}>
              <button
                className={styles.saveBtn}
                onClick={handleEditSave}
                disabled={editing.saving}
              >
                {editing.saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
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
  onRename,
  onReplace,
  onEdit,
}: {
  item: FileItem
  onDownload: (item: FileItem) => void
  onDelete: (item: FileItem) => void
  onRename: (item: FileItem) => void
  onReplace: (item: FileItem) => void
  onEdit: (item: FileItem) => void
}) {
  const ext = item.name.split('.').pop()?.toUpperCase() ?? '—'
  const size = item.size > 1024 * 1024
    ? `${(item.size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(item.size / 1024)} KB`
  const editable = isEditable(item.name)

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
        {editable && (
          <button onClick={() => onEdit(item)} className={styles.actionBtn}>Edit</button>
        )}
        <button onClick={() => onRename(item)} className={styles.actionBtn}>Rename</button>
        <button onClick={() => onReplace(item)} className={styles.actionBtn}>Replace</button>
        <button onClick={() => onDownload(item)} className={styles.actionBtn}>Download</button>
        <button onClick={() => onDelete(item)} className={`${styles.actionBtn} ${styles.actionBtnDanger}`}>Delete</button>
      </div>
    </div>
  )
}
