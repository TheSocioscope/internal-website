const BASE = process.env.NEXT_PUBLIC_API_BASE_URL

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    if (res.status === 401) window.location.href = '/login'
    throw new Error(`API error ${res.status}: ${path}`)
  }
  return res.json()
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export const auth = {
  requestOtp: (email: string) =>
    req<{ pendingToken: string }>('/auth/request-otp', {
      method: 'POST', body: JSON.stringify({ email }),
    }),
  verifyOtp: (pendingToken: string, otp: string) =>
    req<{ ok: boolean }>('/auth/verify-otp', {
      method: 'POST', body: JSON.stringify({ pendingToken, otp }),
    }),
  me: () => req<{ user: { email: string; exp: number } }>('/auth/me'),
  logout: () => req('/auth/logout', { method: 'POST' }),
}

// ── Files ─────────────────────────────────────────────────────────────────────
export const files = {
  list: (prefix: string) =>
    req<{ files: FileItem[] }>(`/files?prefix=${encodeURIComponent(prefix)}`),
  getUploadUrl: (key: string, contentType: string) =>
    req<{ url: string; key: string }>('/files/upload-url', {
      method: 'POST', body: JSON.stringify({ key, contentType }),
    }),
  getDownloadUrl: (key: string) =>
    req<{ url: string }>(`/files/download-url?key=${encodeURIComponent(key)}`),
  delete: (key: string) =>
    req(`/files?key=${encodeURIComponent(key)}`, { method: 'DELETE' }),
}

// ── Announcements ─────────────────────────────────────────────────────────────
export const announcements = {
  list: () => req<{ items: Announcement[] }>('/announcements'),
  create: (data: Pick<Announcement, 'title' | 'body' | 'pinned'>) =>
    req<Announcement>('/announcements', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Announcement>) =>
    req<Announcement>(`/announcements/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    req(`/announcements/${id}`, { method: 'DELETE' }),
}

// ── Links ─────────────────────────────────────────────────────────────────────
export const links = {
  list: (category?: string) =>
    req<{ items: Link[] }>(`/links${category ? `?category=${category}` : ''}`),
  create: (data: Omit<Link, 'id'>) =>
    req<Link>('/links', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Link>) =>
    req<Link>(`/links/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    req(`/links/${id}`, { method: 'DELETE' }),
}

// ── Tools ─────────────────────────────────────────────────────────────────────
export const tools = {
  list: () => req<{ items: Tool[] }>('/tools'),
  create: (data: Omit<Tool, 'id' | 'createdAt'>) =>
    req<Tool>('/tools', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Tool>) =>
    req<Tool>(`/tools/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    req(`/tools/${id}`, { method: 'DELETE' }),
}

// ── Credentials ───────────────────────────────────────────────────────────────
export const credentials = {
  list: () => req<{ items: Credential[] }>('/credentials'),
  reveal: (id: string) => req<{ value: string }>(`/credentials/${id}/reveal`),
  create: (data: Omit<Credential, 'id'>) =>
    req<Credential>('/credentials', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Credential>) =>
    req<Credential>(`/credentials/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    req(`/credentials/${id}`, { method: 'DELETE' }),
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
export const tasks = {
  listBoards: () => req<{ items: Board[] }>('/boards'),
  createBoard: (name: string) =>
    req<Board>('/boards', { method: 'POST', body: JSON.stringify({ name }) }),
  listColumns: (boardId: string) =>
    req<{ items: Column[] }>(`/boards/${boardId}/columns`),
  createColumn: (boardId: string, name: string, order: number) =>
    req<Column>(`/boards/${boardId}/columns`, {
      method: 'POST', body: JSON.stringify({ name, order }),
    }),
  updateColumn: (id: string, data: Partial<Column>) =>
    req<Column>(`/columns/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteColumn: (id: string) =>
    req(`/columns/${id}`, { method: 'DELETE' }),
  listCards: (boardId: string) =>
    req<{ items: Card[] }>(`/boards/${boardId}/cards`),
  createCard: (boardId: string, data: Omit<Card, 'id' | 'createdAt'>) =>
    req<Card>(`/boards/${boardId}/cards`, { method: 'POST', body: JSON.stringify(data) }),
  updateCard: (id: string, data: Partial<Card>) =>
    req<Card>(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCard: (id: string) =>
    req(`/cards/${id}`, { method: 'DELETE' }),
}

// ── Resources ─────────────────────────────────────────────────────────────────
export const resources = {
  list: (tag?: string) =>
    req<{ items: Resource[] }>(`/resources${tag ? `?tag=${tag}` : ''}`),
  create: (data: Omit<Resource, 'id' | 'createdAt'>) =>
    req<Resource>('/resources', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Resource>) =>
    req<Resource>(`/resources/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    req(`/resources/${id}`, { method: 'DELETE' }),
}

// ── Process docs ──────────────────────────────────────────────────────────────
export const processDocs = {
  list: () => req<{ items: ProcessDoc[] }>('/process'),
  create: (data: Omit<ProcessDoc, 'id' | 'updatedAt' | 'updatedBy'>) =>
    req<ProcessDoc>('/process', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<ProcessDoc>) =>
    req<ProcessDoc>(`/process/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    req(`/process/${id}`, { method: 'DELETE' }),
  reorder: (ids: string[]) =>
    req('/process/reorder', { method: 'PATCH', body: JSON.stringify({ ids }) }),
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface FileItem {
  key: string
  name: string
  size: number
  lastModified: string
  uploadedBy?: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  pinned: boolean
  createdAt: string
  createdBy: string
}

export interface Link {
  id: string
  category: string
  title: string
  url: string
  description: string
  starred: boolean
  order: number
}

export interface Tool {
  id: string
  name: string
  url: string
  description: string
  category: string
  createdAt: string
}

export interface Credential {
  id: string
  service: string
  username: string
  password: string  // redacted in list, revealed via /reveal endpoint
  notes: string
  url: string
}

export interface Board {
  id: string
  name: string
  isDefault: boolean
  createdAt: string
}

export interface Column {
  id: string
  boardId: string
  name: string
  order: number
}

export interface Card {
  id: string
  columnId: string
  boardId: string
  title: string
  description: string
  assignee: string
  order: number
  createdAt: string
}

export interface Resource {
  id: string
  title: string
  url: string
  author: string
  description: string
  tags: string[]
  createdAt: string
}

export interface ProcessDoc {
  id: string
  title: string
  body: string
  order: number
  updatedAt: string
  updatedBy: string
}
