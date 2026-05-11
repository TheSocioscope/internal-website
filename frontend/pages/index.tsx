import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect, FormEvent } from 'react'
import Layout from '../components/layout/Layout'
import { announcements, links, resources, Announcement, Link as LinkType, Resource } from '../lib/api'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../lib/auth'
import styles from '../styles/Home.module.css'

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
  const [starredLinks, setStarredLinks] = useState<LinkType[]>([])
  const [startHere, setStartHere] = useState<Resource | null>(null)
  const [composing, setComposing] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')

  useEffect(() => {
    announcements.list().then(r => setAnnounceItems(r.items))
    links.list().then(r => setStarredLinks(r.items.filter(l => l.starred)))
    resources.list().then(r => setStartHere(r.items.find(r => r.tags.includes('start-here')) ?? null))
  }, [])

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
