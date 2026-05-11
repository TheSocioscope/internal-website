import Head from 'next/head'
import Layout from '../components/layout/Layout'
import FileBrowser from '../components/files/FileBrowser'

export default function MeetingNotesPage() {
  return (
    <>
      <Head><title>Meeting notes — Socioscope</title></Head>
      <Layout title="Meeting notes">
        <FileBrowser prefix="meeting-notes/" groupByMonth={true} />
      </Layout>
    </>
  )
}
