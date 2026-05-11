import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from '../../lib/auth'
import styles from './Layout.module.css'

const NAV = [
  { href: '/',                  label: 'Home',          icon: '⌂' },
  { href: '/meeting-notes',     label: 'Meeting notes', icon: '◎' },
  { href: '/data',              label: 'Data',          icon: '◈' },
  { href: '/documents',         label: 'Documents',     icon: '▤' },
  { href: '/documents/process', label: 'Process',       icon: '◳', indent: true },
  { href: '/resources',         label: 'Resources',     icon: '◉' },
  { href: '/tools',             label: 'Tools',         icon: '◧' },
  { href: '/tools/credentials', label: 'Credentials',   icon: '◈', indent: true },
  { href: '/tasks',             label: 'Tasks',         icon: '◫' },
]

interface LayoutProps {
  children: React.ReactNode
  title?: string
}

export default function Layout({ children, title }: LayoutProps) {
  const router = useRouter()
  const { user, logout } = useAuth()

  return (
    <div className={styles.shell}>
      <nav className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <span className={styles.logoMark}>S</span>
          <span className={styles.logoText}>Socioscope</span>
        </div>

        <ul className={styles.navList}>
          {NAV.map(item => {
            const active = router.pathname === item.href
            return (
              <li key={item.href} className={item.indent ? styles.navIndent : ''}>
                <Link
                  href={item.href}
                  className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className={styles.sidebarFooter}>
          <p className={styles.userEmail}>{user?.email}</p>
          <button onClick={logout} className={styles.logoutBtn}>Sign out</button>
        </div>
      </nav>

      <main className={styles.main}>
        {title && (
          <header className={styles.pageHeader}>
            <h1>{title}</h1>
          </header>
        )}
        <div className={styles.content}>
          {children}
        </div>
      </main>
    </div>
  )
}
