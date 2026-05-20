import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect, useMemo, FormEvent } from 'react'
import Layout from '../components/layout/Layout'
import {
  announcements, links, resources, tools, processDocs, files,
  Announcement, Link as LinkType, Resource, Tool, ProcessDoc, FileItem,
} from '../lib/api'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../lib/auth'
import styles from '../styles/Home.module.css'

type SearchHit =
  | { kind: 'announcement'; id: string; title: string; snippet: string; href: string }
  | { kind: 'link';         id: string; title: string; snippet: string; href: string; external: true }
  | { kind: 'tool';         id: string; title: string; snippet: string; href: string; external: true }
  | { kind: 'resource';     id: string; title: string; snippet: string; href: string; external: true }
  | { kind: 'process';      id: string; title: string; snippet: string; href: string }
  | { kind: 'file';         id: string; title: string; snippet: string; fileKey: string }

const KIND_LABEL: Record<SearchHit['kind'], string> = {
  announcement: 'Announcement',
  link: 'Link',
  tool: 'Tool',
  resource: 'Resource',
  process: 'Process doc',
  file: 'File',
}

const SECTIONS = [
  { href: '/meeting-notes',     label: 'Meeting notes',  desc: 'Browse and upload meeting records by month', icon: '◎' },
  { href: '/data',              label: 'Data',           desc: 'Corpus repository and data links',           icon: '◈' },
  { href: '/documents',         label: 'Documents',      desc: 'Working documents, cases, trackers',         icon: '▤' },
  { href: '/resources',         label: 'Resources',      desc: 'External readings and references',           icon: '◉' },
  { href: '/tools',             label: 'Tools',          desc: 'Tech tools, modules, and credentials',       icon: '◧' },
  { href: '/tasks',             label: 'Tasks',          desc: 'Project kanban board',                       icon: '◫' },
]

export default function HomePage() {
  const { user } = useAuth()
  const [announceItems, setAnnounceItems] = useState<Announcement[]>([])
  const [allLinks, setAllLinks] = useState<LinkType[]>([])
  const [allResources, setAllResources] = useState<Resource[]>([])
  const [allTools, setAllTools] = useState<Tool[]>([])
  const [allProcess, setAllProcess] = useState<ProcessDoc[]>([])
  const [allFiles, setAllFiles] = useState<FileItem[]>([])
  const [composing, setComposing] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    announcements.list().then(r => setAnnounceItems(r.items))
    links.list().then(r => setAllLinks(r.items))
    resources.list().then(r => setAllResources(r.items))
    tools.list().then(r => setAllTools(r.items))
    processDocs.list().then(r => setAllProcess(r.items))
    files.list('').then(r => setAllFiles(r.files)).catch(() => {})
  }, [])

  const starredLinks = useMemo(() => allLinks.filter(l => l.starred), [allLinks])
  const startHere = useMemo(
    () => allResources.find(r => r.tags.includes('start-here')) ?? null,
    [allResources],
  )

  const trimmedQuery = query.trim()
  const hits = useMemo<SearchHit[]>(() => {
    if (!trimmedQuery) return []
    const needle = trimmedQuery.toLowerCase()
    const match = (...fields: (string | undefined)[]) =>
      fields.some(f => f && f.toLowerCase().includes(needle))
    const snip = (s: string | undefined, max = 140) => {
      if (!s) return ''
      return s.length > max ? s.slice(0, max) + '…' : s
    }
    const out: SearchHit[] = []
    for (const a of announceItems) {
      if (match(a.title, a.body)) {
        out.push({ kind: 'announcement', id: a.id, title: a.title, snippet: snip(a.body), href: '/' })
      }
    }
    for (const l of allLinks) {
      if (match(l.title, l.description, l.category, l.url)) {
        out.push({ kind: 'link', id: l.id, title: l.title, snippet: snip(l.description || l.url), href: l.url, external: true })
      }
    }
    for (const t of allTools) {
      if (match(t.name, t.description, t.category, t.url)) {
        out.push({ kind: 'tool', id: t.id, title: t.name, snippet: snip(t.description || t.url), href: t.url, external: true })
      }
    }
    for (const r of allResources) {
      if (match(r.title, r.description, r.author, r.tags.join(' '), r.url)) {
        out.push({ kind: 'resource', id: r.id, title: r.title, snippet: snip(r.description || r.url), href: r.url, external: true })
      }
    }
    for (const p of allProcess) {
      if (match(p.title, p.body)) {
        const plain = p.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        out.push({ kind: 'process', id: p.id, title: p.title, snippet: snip(plain), href: '/documents/process' })
      }
    }
    for (const f of allFiles) {
      if (match(f.name, f.key)) {
        out.push({ kind: 'file', id: f.key, title: f.name, snippet: f.key, fileKey: f.key })
      }
    }
    return out
  }, [trimmedQuery, announceItems, allLinks, allTools, allResources, allProcess, allFiles])

  async function openFile(key: string) {
    try {
      const { url } = await files.getDownloadUrl(key)
      window.open(url, '_blank')
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not open file')
    }
  }

  async function postAnnouncement(e: FormEvent) {
    e.preventDefault()
    const item = await announcements.create({ title: newTitle, body: newBody, pinned: false })
    setAnnounceItems(prev => [item, ...prev])
    setNewTitle(''); setNewBody(''); setComposing(false)
  }

  async function deleteAnnouncement(id: string) {
    await announcements.delete(id)
    setAnnounceItems(prev => prev.filter(a => a.id !== id))
  }

  async function togglePin(item: Announcement) {
    const updated = await announcements.update(item.id, { pinned: !item.pinned })
    setAnnounceItems(prev => prev.map(a => a.id === item.id ? updated : a))
  }

  const pinned = announceItems.filter(a => a.pinned)
  const rest = announceItems.filter(a => !a.pinned)

  return (
    <>
      <Head><title>Socioscope</title></Head>
      <Layout>
        <div className={styles.page}>

          {/* Global search */}
          <div className={styles.searchWrap}>
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search announcements, links, tools, resources, process docs…"
              className={styles.searchInput}
              aria-label="Search"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className={styles.searchClear} aria-label="Clear search">
                ×
              </button>
            )}
          </div>

          {trimmedQuery ? (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                {hits.length === 0 ? 'No results' : `${hits.length} result${hits.length === 1 ? '' : 's'}`}
                <span className={styles.searchFor}> for “{trimmedQuery}”</span>
              </h2>
              <div className={styles.results}>
                {hits.map(h => {
                  const inner = (
                    <>
                      <span className={styles.resultKind}>{KIND_LABEL[h.kind]}</span>
                      <span className={styles.resultTitle}>{h.title}</span>
                      {h.snippet && <span className={styles.resultSnippet}>{h.snippet}</span>}
                    </>
                  )
                  if (h.kind === 'file') {
                    return (
                      <button
                        key={`${h.kind}-${h.id}`}
                        type="button"
                        onClick={() => openFile(h.fileKey)}
                        className={styles.resultCard}
                      >
                        {inner}
                      </button>
                    )
                  }
                  return 'external' in h ? (
                    <a key={`${h.kind}-${h.id}`} href={h.href} target="_blank" rel="noreferrer" className={styles.resultCard}>
                      {inner}
                    </a>
                  ) : (
                    <Link key={`${h.kind}-${h.id}`} href={h.href} className={styles.resultCard}>
                      {inner}
                    </Link>
                  )
                })}
              </div>
            </section>
          ) : (
          <>

          {/* Start here highlight */}
          {startHere && (
            <Link href={startHere.url} target="_blank" className={styles.startHere}>
              <span className={styles.startHereBadge}>Start here</span>
              <span className={styles.startHereTitle}>{startHere.title}</span>
              <span className={styles.startHereDesc}>{startHere.description}</span>
            </Link>
          )}

          {/* Notice board */}
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Notice board</h2>
              <button onClick={() => setComposing(v => !v)} className={styles.addBtn}>
                {composing ? 'Cancel' : '+ Post'}
              </button>
            </div>

            {composing && (
              <form onSubmit={postAnnouncement} className={styles.composeForm}>
                <input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Title"
                  required
                  className={styles.composeInput}
                  autoFocus
                />
                <textarea
                  value={newBody}
                  onChange={e => setNewBody(e.target.value)}
                  placeholder="What's the announcement?"
                  required
                  className={styles.composeTextarea}
                  rows={3}
                />
                <button type="submit" className={styles.submitBtn}>Post announcement</button>
              </form>
            )}

            {announceItems.length === 0 && !composing && (
              <p className={styles.empty}>No announcements yet.</p>
            )}

            {pinned.map(a => <AnnouncementCard key={a.id} item={a} onDelete={deleteAnnouncement} onPin={togglePin} />)}
            {rest.map(a => <AnnouncementCard key={a.id} item={a} onDelete={deleteAnnouncement} onPin={togglePin} />)}
          </section>

          {/* Starred links */}
          {starredLinks.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Quick links</h2>
              <div className={styles.linkGrid}>
                {starredLinks.map(link => (
                  <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className={styles.linkCard}>
                    <span className={styles.linkTitle}>{link.title}</span>
                    {link.description && <span className={styles.linkDesc}>{link.description}</span>}
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Section nav */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Sections</h2>
            <div className={styles.sectionGrid}>
              {SECTIONS.map(s => (
                <Link key={s.href} href={s.href} className={styles.sectionCard}>
                  <span className={styles.sectionIcon}>{s.icon}</span>
                  <span className={styles.sectionLabel}>{s.label}</span>
                  <span className={styles.sectionDesc}>{s.desc}</span>
                </Link>
              ))}
            </div>
          </section>

          </>
          )}

        </div>
      </Layout>
    </>
  )
}

function AnnouncementCard({
  item, onDelete, onPin
}: {
  item: Announcement
  onDelete: (id: string) => void
  onPin: (item: Announcement) => void
}) {
  return (
    <div className={`${styles.announcement} ${item.pinned ? styles.announcementPinned : ''}`}>
      {item.pinned && <span className={styles.pinnedBadge}>Pinned</span>}
      <div className={styles.announceHead}>
        <strong className={styles.announceTitle}>{item.title}</strong>
        <span className={styles.announceMeta}>
          {item.createdBy} · {format(parseISO(item.createdAt), 'd MMM')}
        </span>
      </div>
      <p className={styles.announceBody}>{item.body}</p>
      <div className={styles.announceActions}>
        <button onClick={() => onPin(item)} className={styles.actionLink}>
          {item.pinned ? 'Unpin' : 'Pin'}
        </button>
        <button onClick={() => onDelete(item.id)} className={`${styles.actionLink} ${styles.actionLinkDanger}`}>
          Delete
        </button>
      </div>
    </div>
  )
}
