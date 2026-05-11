# Socioscope Internal Portal — Claude Code Handoff (v2)

## Status: Substantial scaffolding complete. Read this before starting.

Everything in this repo has been pre-built. Claude Code's job is to:
1. Wire it together
2. Fill in the remaining pages
3. Test and deploy

Do NOT rewrite what's here. Read each file before touching it.

---

## What's already built

### Frontend (`/frontend`)
- `pages/_app.tsx` — auth guard, redirects unauthenticated users to `/login`
- `pages/login.tsx` + `styles/Login.module.css` — full OTP login flow (email → code → session)
- `lib/auth.ts` — auth context, `useAuth()` hook, session check against `/auth/me`
- `lib/api.ts` — complete typed API client for ALL endpoints, plus all TypeScript types
- `components/layout/Layout.tsx` + `Layout.module.css` — sidebar nav, all routes, user info, logout
- `components/files/FileBrowser.tsx` + `FileBrowser.module.css` — drag-drop upload, list, download, delete with toast, group-by-month mode, search
- `pages/index.tsx` + `styles/Home.module.css` — homepage: start-here card, notice board with compose, starred links, section grid
- `pages/meeting-notes.tsx` — uses FileBrowser with `groupByMonth=true`
- `pages/documents/index.tsx` — uses FileBrowser for working docs
- `pages/documents/process.tsx` — rich text knowledge base, sections with Tiptap editor
- `components/process/ProcessEditor.tsx` — inline Tiptap editor per section, auto-saves on blur
- `pages/data.tsx` — corpus links (add/delete) + file browser
- `pages/resources.tsx` — resource cards with tag filtering, add/delete inline
- `pages/tools/index.tsx` + `styles/Tools.module.css` — tool cards grouped by category, add/edit/delete inline
- `pages/tools/credentials.tsx` + `styles/Credentials.module.css` — credentials with blur/reveal (30s), copy-to-clipboard, KMS-backed
- `pages/tasks.tsx` + `styles/Tasks.module.css` — kanban board with drag-drop, multi-board support, add cards inline
- `styles/globals.css` — design system: Fraunces display font, DM Sans body, DM Mono, CSS variables, green accent palette

### Backend (`/backend`)
- `middleware.js` — `authenticate()`, `response()`, `unauthorized()` helpers used by all Lambdas
- `crud.js` — generic DynamoDB CRUD Lambda factory with filter + hook support
- `auth/index.js` — full OTP Lambda: request OTP (SES), verify OTP (DynamoDB TTL), issue JWT cookie, `/me`, `/logout`
- `files/index.js` — S3 Lambda: list, presigned upload URL, presigned download URL, soft delete
- `announcements/index.js` — uses crud factory
- `links/index.js` — uses crud factory with category filter
- `tools/index.js` — uses crud factory
- `resources/index.js` — uses crud factory with tag filter
- `process/index.js` — uses crud factory
- `credentials/index.js` — custom Lambda with KMS encrypt/decrypt, reveal endpoint with CloudWatch logging
- `tasks/index.js` — boards, columns, cards CRUD with default column creation on new board

### Infrastructure (`/infrastructure`)
- `stack.ts` — complete CDK stack: S3 (versioned), all DynamoDB tables, KMS key, all Lambda functions with correct IAM permissions, API Gateway with routes, outputs
- `app.ts` — CDK app entry point

---

## What Claude Code needs to do

### Step 1 — Prerequisites (do this first)

```bash
# Install dependencies
cd frontend && npm install
cd ../infrastructure && npm install

# Generate JWT secret and store in SSM
aws ssm put-parameter \
  --name /socioscope/jwt-secret \
  --value "$(openssl rand -base64 64)" \
  --type SecureString

# Verify SES email domain is set up
# (SES > Verified identities > add your domain if not already done)
# SES must be out of sandbox mode for sending to non-verified addresses
aws ses get-account-sending-enabled
```

### Step 2 — Configure environment

Copy `.env.example` to `.env.local` in `/frontend` and fill in:
- `NEXT_PUBLIC_API_BASE_URL` — you get this after deploying infra in step 3
- `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN` — your actual email domain

For the CDK stack, set these environment variables before deploying:
```bash
export ALLOWED_EMAIL_DOMAIN=yourdomain.org
export FRONTEND_URL=https://your-org.github.io/socioscope-portal
export SES_FROM_ADDRESS=noreply@yourdomain.org
```

### Step 3 — Deploy infrastructure

```bash
cd infrastructure
npm install
npx cdk bootstrap   # first time only
npx cdk deploy

# Note the API URL from outputs - put it in frontend/.env.local
```

### Step 4 — Fix the JWT_SECRET reference in stack.ts

The current stack.ts uses `{{resolve:ssm:/socioscope/jwt-secret}}` for the JWT secret. This is the CDK SSM dynamic reference syntax. Verify it resolves correctly or replace with:

```typescript
import * as ssm from 'aws-cdk-lib/aws-ssm'
const jwtSecret = ssm.StringParameter.valueForSecureStringParameter(this, 'JwtSecret', '/socioscope/jwt-secret')
// then use jwtSecret in the Lambda environment
```

### Step 5 — Install Lambda dependencies

Each Lambda that uses AWS SDK needs its own `package.json`. Create these:

```bash
# In backend/auth/
npm init -y && npm install @aws-sdk/client-ses @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb jose

# In backend/files/
npm init -y && npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# In backend/credentials/
npm init -y && npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/client-kms

# In backend/tasks/
npm init -y && npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb

# For crud.js consumers (announcements, links, tools, resources, process)
# Each needs:
npm init -y && npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

Update `stack.ts` to bundle Lambda dependencies — use `NodejsFunction` from `aws-cdk-lib/aws-lambda-nodejs` instead of plain `Function` with `Code.fromAsset`. This auto-bundles with esbuild:

```typescript
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'

const authFn = new NodejsFunction(this, 'AuthFn', {
  entry: path.join(__dirname, '../backend/auth/index.js'),
  handler: 'handler',
  runtime: lambda.Runtime.NODEJS_20_X,
  environment: sharedEnv,
  // ... rest of config
})
```

Do this for all Lambda functions in the stack.

### Step 6 — Test auth flow locally

```bash
cd frontend && npm run dev
# Visit http://localhost:3000
# Should redirect to /login
# Enter your @domain.org email
# Check email for OTP
# Enter OTP → should reach homepage
```

### Step 7 — Verify each page works

Test each route manually:
- `/` — homepage loads, announcements post/delete, starred links appear
- `/meeting-notes` — upload a file, see it appear, download it, delete it
- `/data` — add a corpus link, upload a file
- `/documents` — upload a file
- `/documents/process` — add a section, type in it, blur to save, reload and verify persistence
- `/tools` — add a tool, edit it, delete it
- `/tools/credentials` — add a credential, verify password is blurred, reveal it, check CloudWatch for log entry
- `/tasks` — default board created, add cards, drag between columns, create second board
- `/resources` — add a resource with tags, filter by tag

### Step 8 — Deploy frontend

```bash
cd frontend
npm run build
# For GitHub Pages:
npm run deploy
# Or push to main and set up GitHub Actions (see below)
```

### Step 9 — GitHub Actions CI/CD (recommended)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: cd frontend && npm ci && npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: frontend/out
```

---

## Known gaps to address

These are intentionally left for Claude Code to implement based on what it finds in testing:

1. **`next.config.js` `basePath`** — if the GitHub Pages URL is `org.github.io/socioscope-portal`, set `basePath: '/socioscope-portal'` in `next.config.js`

2. **CORS on API Gateway** — verify the CDK CORS config actually propagates to all routes. May need to add `Access-Control-Allow-Origin` headers to Lambda responses explicitly (the `corsHeaders()` function in `middleware.js` already does this, but test it)

3. **Cookie SameSite on localhost** — `SameSite=Strict` cookies won't work on localhost during development. For local dev, temporarily change to `SameSite=Lax` in `auth/index.js`

4. **S3 presigned URL CORS** — the S3 bucket has CORS configured in CDK, but confirm the upload works end-to-end. The upload in `FileBrowser.tsx` does a direct `PUT` to S3 via presigned URL.

5. **DynamoDB table for process_docs** — `crud.js` uses `tableSuffix` to build the table name. The process Lambda uses `makeHandler('process_docs')` which maps to `socioscope_process_docs`. Verify this matches the CDK table name exactly.

6. **Middleware.js path** — the crud Lambdas do `require('../middleware')`. When bundled with `NodejsFunction`, this should resolve correctly. If using `Code.fromAsset`, you need to copy `middleware.js` into each Lambda directory or use a Lambda layer.

7. **File upload metadata** — the `FileBrowser` gets a presigned URL then does a raw `fetch PUT`. The uploader's email is set as S3 object metadata in `getUploadUrl`. When listing files, the S3 `ListObjectsV2` response doesn't include metadata — to show `uploadedBy`, you'd need to store it in DynamoDB separately or use a Lambda trigger. Skip this for v1 and just omit the uploader name.

---

## Design reference

The design uses:
- **Fraunces** (serif, variable) for headings and logo — elegant, editorial
- **DM Sans** for all body/UI text — clean, readable
- **DM Mono** for credentials/code — clear distinction
- **Accent color**: `#2d5a3d` (forest green) — `--color-accent`
- **Background**: `#f7f5f0` (warm off-white) — `--color-paper`
- **All CSS variables defined in** `styles/globals.css`

Do not change the design system. Extend it if needed by adding new variables to `globals.css`.

---

## File structure

```
/
├── .env.example
├── package.json              (workspace root)
├── frontend/
│   ├── package.json
│   ├── next.config.js
│   ├── pages/
│   │   ├── _app.tsx          ✅ done
│   │   ├── login.tsx         ✅ done
│   │   ├── index.tsx         ✅ done
│   │   ├── meeting-notes.tsx ✅ done
│   │   ├── data.tsx          ✅ done
│   │   ├── resources.tsx     ✅ done
│   │   ├── tasks.tsx         ✅ done
│   │   ├── documents/
│   │   │   ├── index.tsx     ✅ done
│   │   │   └── process.tsx   ✅ done
│   │   └── tools/
│   │       ├── index.tsx     ✅ done
│   │       └── credentials.tsx ✅ done
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Layout.tsx    ✅ done
│   │   │   └── Layout.module.css ✅ done
│   │   ├── files/
│   │   │   ├── FileBrowser.tsx ✅ done
│   │   │   └── FileBrowser.module.css ✅ done
│   │   └── process/
│   │       └── ProcessEditor.tsx ✅ done
│   ├── lib/
│   │   ├── auth.ts           ✅ done
│   │   └── api.ts            ✅ done
│   └── styles/
│       ├── globals.css       ✅ done
│       ├── Login.module.css  ✅ done
│       ├── Home.module.css   ✅ done
│       ├── Tools.module.css  ✅ done
│       ├── Credentials.module.css ✅ done
│       └── Tasks.module.css  ✅ done
├── backend/
│   ├── middleware.js         ✅ done
│   ├── crud.js               ✅ done
│   ├── auth/index.js         ✅ done
│   ├── files/index.js        ✅ done
│   ├── announcements/index.js ✅ done
│   ├── links/index.js        ✅ done
│   ├── tools/index.js        ✅ done
│   ├── resources/index.js    ✅ done
│   ├── process/index.js      ✅ done
│   ├── credentials/index.js  ✅ done
│   └── tasks/index.js        ✅ done
└── infrastructure/
    ├── app.ts                ✅ done
    └── stack.ts              ✅ done
```

---

## Quick start for Claude Code

```
Read this file fully. Then:
1. Run `npm install` in /frontend and /infrastructure
2. Follow Steps 1–5 in order
3. Fix the NodejsFunction bundling (Step 5) before deploying
4. Deploy infra, get API URL, set it in .env.local
5. Run frontend locally and test auth
6. Fix any issues found in the "Known gaps" section
7. Deploy frontend to GitHub Pages
```
