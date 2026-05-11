# Socioscope Internal Portal — Claude Code Handoff

## Project Overview

Build an internal web portal for the Socioscope research team. It replaces a janky Google Sheet used as a makeshift intranet. The site must feel like a real product: clean, fast, editable inline by non-technical team members, and secure enough that nothing leaks without authentication.

---

## Constraints & Principles

- **Open source friendly** — no proprietary SaaS lock-in where avoidable
- **AWS-native** — team already uses S3, Lambda, API Gateway, SES, DynamoDB
- **GitHub Pages** for frontend hosting
- **No JSON editing** — everything editable via UI
- **No separate admin panel** — editing happens inline, in context
- **One auth level** (except credentials subsection, see below)
- **Seamless for non-technical users** — upload, edit, download should feel obvious
- **Maintainable after handoff** — next developer should find it logical

---

## Authentication

**Magic link / OTP via email domain restriction**

Flow:
1. User visits site → sees only a login screen
2. Enters their `@socioscope.org` email (or whatever the domain is — make this an env var `ALLOWED_EMAIL_DOMAIN`)
3. Lambda checks domain → sends 6-digit OTP via AWS SES
4. User enters OTP → Lambda validates → issues signed JWT (30-day expiry) stored in `httpOnly` cookie
5. All subsequent requests validated server-side via JWT

Rules:
- Only emails matching `ALLOWED_EMAIL_DOMAIN` can request OTP
- OTP expires after 10 minutes
- OTP is single-use
- Session lasts 30 days, then re-auth required
- No password, no manual account creation — if your org email works, you're in

**`/tools/credentials` subsection:**
Same session, but credentials values are blurred by default and require clicking "Reveal" with a confirmation prompt. No extra login. The site-level auth is considered sufficient.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (static export for GitHub Pages) |
| Hosting | GitHub Pages |
| File storage | AWS S3 (existing bucket) with versioning enabled |
| Structured data | AWS DynamoDB |
| Auth + OTP | AWS Lambda + AWS SES |
| API | AWS Lambda + API Gateway |
| Email sending | AWS SES |
| IaC (optional) | AWS CDK or plain CloudFormation |

### S3 Configuration
- Enable **versioning** on the bucket — this is the safety net against accidental deletion
- Enable **MFA delete** for extra protection
- All file access via **presigned URLs** only — bucket is never public
- Lifecycle rule: keep all versions, expire delete markers after 90 days

### DynamoDB Tables
```
announcements     { id, title, body, pinned, createdAt, createdBy }
links             { id, category, title, url, description, starred, order }
tools             { id, name, url, description, category, createdAt }
kanban_boards     { id, name, isDefault, createdAt }
kanban_columns    { id, boardId, name, order }
kanban_cards      { id, columnId, boardId, title, description, assignee, order, createdAt }
resources         { id, title, url, author, description, tags, createdAt }
process_docs      { id, title, body (rich text), order, updatedAt, updatedBy }
```

---

## Site Structure

```
/                          Homepage
/meeting-notes             File browser, upload
/data                      Corpus links + file browser
/documents                 Working docs, upload + browse
/documents/process         Transferable knowledge base
/resources                 External readings + links
/tools                     Tool directory
/tools/credentials         Credentials (blurred, reveal on click)
/tasks                     Kanban board(s)
```

---

## Page-by-Page Spec

### `/` — Homepage

Three sections, in order:

**1. Notice Board**
- Pinned announcements at top (if any), then chronological
- Each announcement has: title, body (markdown), timestamp, author
- "Post announcement" button visible to all logged-in users → inline compose form
- Announcements can be deleted or pinned by anyone (team is trusted)

**2. Starred Links**
- A curated row/grid of important links pulled from the `links` table where `starred = true`
- Shows title + short description
- "Edit" appears on hover — click to rename, change URL, remove star

**3. Start Here highlight**
- A visually distinct card linking to the main onboarding/overview doc in `/resources`
- Editable: the link and blurb text can be changed inline

**4. Section navigation**
- Cards or a clean grid linking to all 7 main sections with a one-line description each

---

### `/meeting-notes`

- Files stored in S3 under `meeting-notes/YYYY/MM/filename`
- UI: grouped by month, collapsible, most recent first
- Each file shows: name, upload date, uploader, download button, delete button (with undo toast — S3 versioning recovers it)
- **Upload:** drag-and-drop zone always visible at top, or click to browse
- Upload auto-places file in current month's folder
- Search bar filters by filename

---

### `/data`

- Two subsections: **Corpus files** (S3 browser) and **Corpus links** (from `links` table, category = "data")
- File browser same pattern as meeting notes but folder structure is by continent/country/case
- Links section: title, URL, description, edit/delete on hover, "Add link" button

---

### `/documents`

- S3 browser for working documents (ongoing cases, change lists, trackers)
- Flat or one-level-deep folder structure
- Upload, download, delete (with versioning safety net)
- "New folder" button
- Subroute: `/documents/process` (separate page, see below)

---

### `/documents/process`

- Rich text knowledge base — not just file links
- Structured as titled sections/pages (stored in `process_docs` DynamoDB table)
- Each section editable inline: click text → edit in place → auto-save on blur
- Can add new sections, reorder via drag, delete
- Can also attach files (stored in S3 under `process/`) per section
- This is the transferable knowledge base — treat it like an internal wiki

---

### `/resources`

- External links with: title, URL, author/source, short description, tags
- Displayed as cards, filterable by tag
- "Add resource" button → inline form
- Edit/delete on hover
- One highlighted card at top: "Start Here" guide (same one from homepage)

---

### `/tools`

- Tool cards: name, URL, description, category (e.g. "Data Collection", "Analysis", "Platform")
- Grouped by category
- "Add tool" button → inline form
- Edit/delete on hover
- Subroute: `/tools/credentials`

---

### `/tools/credentials`

- List of credential entries: service name, username, password/token, notes, URL
- Stored in DynamoDB, **encrypted at rest** (use AWS KMS key)
- Password/token field blurred by default
- "Reveal" button → confirmation dialog → shows value for 30 seconds then re-blurs
- "Add credential" → inline form
- Edit/delete on hover
- Copy-to-clipboard button on each field

---

### `/tasks`

- Default board: "Socioscope Project" — created on first load if none exist
- Columns: Backlog / In Progress / Review / Done (defaults, renameable)
- Cards have: title, description, assignee (free text or dropdown of known team emails), created date
- Drag cards between columns
- "Add card" button at bottom of each column
- "New board" button at top right → names a new board, creates it with default columns
- Board switcher dropdown if multiple boards exist
- Cards editable on click → side panel or modal with full detail

---

## UI / UX Principles

**Editing is inline, not in a separate admin panel.**
Every editable element should be editable where it lives. Hover states reveal edit/delete controls. Forms appear in context, not in a separate route.

**File operations have a safety net, not a confirmation gate.**
Don't ask "are you sure?" on delete — just do it and show an "Undo" toast for 5 seconds. S3 versioning means nothing is truly lost.

**Upload is always one step.**
Drag onto any file section to upload. No wizard, no multi-step. Progress shown inline.

**Credentials are visible but protected by friction, not extra auth.**
Blurred by default. Reveal requires an intentional click + confirmation. This is sufficient given site-level auth.

---

## Design Direction

The team is a research organization based in Paris. The aesthetic should feel:
- **Editorial and considered** — like an internal tool built with taste, not a generic dashboard
- **Not startup-y** — no purple gradients, no rounded pill buttons everywhere
- Clean typographic hierarchy
- Muted, academic color palette — off-whites, warm grays, one strong accent color
- Monospace elements for credentials/code
- Generous whitespace
- Subtle hover states, no heavy animations

Font suggestions: a refined serif or semi-serif for headings (e.g. Fraunces, Playfair Display, or DM Serif Display), clean sans-serif for body (e.g. DM Sans, Geist, or Instrument Sans).

---

## Environment Variables

```env
ALLOWED_EMAIL_DOMAIN=socioscope.org
AWS_REGION=eu-west-1
AWS_S3_BUCKET=socioscope-internal
AWS_DYNAMODB_TABLE_PREFIX=socioscope_
AWS_SES_FROM_ADDRESS=noreply@socioscope.org
JWT_SECRET=...
KMS_KEY_ID=...  # for credentials encryption
NEXT_PUBLIC_API_BASE_URL=https://api.socioscope.org
```

---

## API Endpoints (Lambda + API Gateway)

### Auth
```
POST /auth/request-otp    { email } → sends OTP, returns { token: pendingToken }
POST /auth/verify-otp     { pendingToken, otp } → returns { sessionJwt }
POST /auth/logout          → clears cookie
```

### Files (S3)
```
GET  /files?prefix=...           → list files in prefix
POST /files/upload-url           → get presigned upload URL
GET  /files/download-url?key=... → get presigned download URL
DELETE /files?key=...            → soft delete (S3 versioning)
```

### Announcements
```
GET    /announcements
POST   /announcements
PATCH  /announcements/:id
DELETE /announcements/:id
```

### Links
```
GET    /links?category=...
POST   /links
PATCH  /links/:id
DELETE /links/:id
```

### Tools + Credentials
```
GET    /tools
POST   /tools
PATCH  /tools/:id
DELETE /tools/:id

GET    /credentials           → returns entries with password field redacted
POST   /credentials
PATCH  /credentials/:id
DELETE /credentials/:id
GET    /credentials/:id/reveal  → returns decrypted password, logs access
```

### Tasks
```
GET    /boards
POST   /boards
GET    /boards/:id/columns
POST   /boards/:id/columns
PATCH  /columns/:id
DELETE /columns/:id
GET    /boards/:id/cards
POST   /boards/:id/cards
PATCH  /cards/:id             → handles column change (drag drop)
DELETE /cards/:id
```

### Resources
```
GET    /resources?tag=...
POST   /resources
PATCH  /resources/:id
DELETE /resources/:id
```

### Process Docs
```
GET    /process
POST   /process
PATCH  /process/:id
DELETE /process/:id
PATCH  /process/reorder       → { ids: [...] }
```

---

## Repo Structure

```
/
├── frontend/                  # Next.js app
│   ├── pages/
│   │   ├── index.tsx
│   │   ├── meeting-notes.tsx
│   │   ├── data.tsx
│   │   ├── documents/
│   │   │   ├── index.tsx
│   │   │   └── process.tsx
│   │   ├── resources.tsx
│   │   ├── tools/
│   │   │   ├── index.tsx
│   │   │   └── credentials.tsx
│   │   └── tasks.tsx
│   ├── components/
│   │   ├── auth/
│   │   ├── files/             # FileBrowser, UploadZone, FileRow
│   │   ├── kanban/            # Board, Column, Card, DragContext
│   │   ├── announcements/
│   │   ├── links/
│   │   ├── tools/
│   │   ├── credentials/
│   │   ├── resources/
│   │   └── process/           # RichTextEditor, ProcessSection
│   └── lib/
│       ├── api.ts             # typed API client
│       ├── auth.ts            # JWT helpers, session
│       └── hooks/
├── backend/                   # Lambda functions
│   ├── auth/
│   ├── files/
│   ├── announcements/
│   ├── links/
│   ├── tools/
│   ├── credentials/
│   ├── tasks/
│   ├── resources/
│   └── process/
├── infrastructure/            # CDK or CloudFormation
│   ├── s3.ts
│   ├── dynamodb.ts
│   ├── lambda.ts
│   ├── api-gateway.ts
│   ├── ses.ts
│   └── kms.ts
└── README.md
```

---

## Build Order (recommended)

1. **Infrastructure** — S3 (with versioning), DynamoDB tables, KMS key, SES domain verification
2. **Auth Lambda** — OTP request + verify, JWT issuance
3. **Login page** — email input → OTP input → redirect
4. **Homepage shell** — layout, nav, section cards (static)
5. **File browser + upload** — get this working for `/meeting-notes` first, then reuse across site
6. **Announcements** — simplest structured content, good pattern setter
7. **Links + Starred links** — homepage becomes functional
8. **Tools + Credentials** — credentials reveal flow
9. **Tasks / Kanban** — most complex component, leave for when patterns are established
10. **Resources** — simple list with tags
11. **Process docs** — rich text editor (use Tiptap or Lexical)
12. **Polish** — search, empty states, error states, mobile responsiveness

---

## Notes for the Developer

- **Tiptap** is recommended for the process docs rich text editor — open source, React-native, extensible
- **@lourenci/react-kanban** for the kanban board — open source, composable, doesn't dictate UI so it can be styled to match the site aesthetic. Handles boards/columns/cards and drag-and-drop out of the box. Simpler than building on raw dnd-kit.
- **Uppy** for file uploads — handles presigned S3 uploads natively, shows progress, resumable
- All API calls should include the JWT from cookie — middleware should handle 401 → redirect to login
- The site should work on mobile (team may be in the field) — responsive layouts required
- Add a `?version=` query param support to file downloads so specific S3 versions can be retrieved if needed
- Log all credential reveal events to CloudWatch with user email + timestamp
- Never log OTP values or JWT secrets to CloudWatch
