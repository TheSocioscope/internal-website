// pages/documents/index.tsx
import Head from 'next/head'
import Link from 'next/link'
import Layout from '../../components/layout/Layout'
import FileBrowser from '../../components/files/FileBrowser'

export default function DocumentsPage() {
  return (
    <>
      <Head><title>Documents — Socioscope</title></Head>
      <Layout title="Documents">
        <p style={{ fontSize: 14, color: 'var(--color-warm-gray)', marginBottom: '1.5rem' }}>
          Working documents, case lists, trackers. See also:{' '}
          <Link href="/documents/process">Process documentation →</Link>
        </p>
        <FileBrowser prefix="documents/" />
      </Layout>
    </>
  )
}
