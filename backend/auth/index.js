const nodemailer = require('nodemailer')
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb')
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm')
const { SignJWT, jwtVerify } = require('jose')
const crypto = require('crypto')

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }))
const ssm = new SSMClient({ region: process.env.AWS_REGION })

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)
const ALLOWED_EMAILS_PARAM = process.env.ALLOWED_EMAILS_PARAM
const ALLOWLIST_TTL_MS = 60_000
const TABLE = `${process.env.DYNAMODB_TABLE_PREFIX}otp_tokens`
const OTP_TTL_SECONDS = 600
const SESSION_DAYS = 30

let allowlistCache = { set: null, expiresAt: 0 }

async function getAllowedEmails() {
  const now = Date.now()
  if (allowlistCache.set && allowlistCache.expiresAt > now) return allowlistCache.set
  const res = await ssm.send(new GetParameterCommand({ Name: ALLOWED_EMAILS_PARAM }))
  const raw = res.Parameter?.Value || ''
  const list = raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  allowlistCache = { set: new Set(list), expiresAt: now + ALLOWLIST_TTL_MS }
  return allowlistCache.set
}

function generateOtp() {
  return String(crypto.randomInt(100000, 999999))
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.FRONTEND_URL,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  }
}

function response(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(), ...extraHeaders },
    body: JSON.stringify(body),
  }
}

// POST /auth/request-otp
async function requestOtp(event) {
  const { email } = JSON.parse(event.body || '{}')

  const allowed = await getAllowedEmails()
  if (!email || !allowed.has(email.toLowerCase())) {
    return response(400, { error: 'Email not authorised' })
  }

  const otp = generateOtp()
  const pendingToken = crypto.randomUUID()
  const expiresAt = Math.floor(Date.now() / 1000) + OTP_TTL_SECONDS

  await dynamo.send(new PutCommand({
    TableName: TABLE,
    Item: {
      pendingToken,
      email,
      otpHash: crypto.createHash('sha256').update(otp).digest('hex'),
      expiresAt,
      ttl: expiresAt,
    },
  }))

  await transporter.sendMail({
    from: `Socioscope <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `Your Socioscope sign-in code: ${otp}`,
    text: `Your sign-in code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 2rem;">
        <h2 style="font-size: 1.2rem; margin-bottom: 1rem;">Sign in to Socioscope</h2>
        <p style="font-size: 2rem; letter-spacing: 0.3em; font-weight: bold; text-align: center;
                  background: #f0ede7; padding: 1rem; border-radius: 8px; margin: 1.5rem 0;">${otp}</p>
        <p style="color: #888; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `,
  })

  return response(200, { pendingToken })
}

// POST /auth/verify-otp
async function verifyOtp(event) {
  const { pendingToken, otp } = JSON.parse(event.body || '{}')

  if (!pendingToken || !otp) {
    return response(400, { error: 'Missing fields' })
  }

  const result = await dynamo.send(new GetCommand({
    TableName: TABLE,
    Key: { pendingToken },
  }))

  const item = result.Item
  if (!item) return response(401, { error: 'Invalid or expired code' })

  const now = Math.floor(Date.now() / 1000)
  if (item.expiresAt < now) {
    return response(401, { error: 'Code expired' })
  }

  const otpHash = crypto.createHash('sha256').update(otp).digest('hex')
  if (otpHash !== item.otpHash) {
    return response(401, { error: 'Invalid code' })
  }

  await dynamo.send(new DeleteCommand({ TableName: TABLE, Key: { pendingToken } }))

  const jwt = await new SignJWT({ email: item.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(JWT_SECRET)

  const cookieValue = `session=${jwt}; HttpOnly; Secure; SameSite=None; Max-Age=${SESSION_DAYS * 86400}; Path=/`

  return response(200, { ok: true }, { 'Set-Cookie': cookieValue })
}

// GET /auth/me
async function me(event) {
  const cookie = event.headers?.cookie || event.headers?.Cookie || ''
  const match = cookie.match(/session=([^;]+)/)
  if (!match) return response(401, { error: 'Not authenticated' })

  try {
    const { payload } = await jwtVerify(match[1], JWT_SECRET)
    return response(200, { user: { email: payload.email, exp: payload.exp } })
  } catch {
    return response(401, { error: 'Invalid session' })
  }
}

// POST /auth/logout
async function logout() {
  const cookieValue = `session=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/`
  return response(200, { ok: true }, { 'Set-Cookie': cookieValue })
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' }
  }

  const path = event.path || event.rawPath || ''

  if (path.endsWith('/request-otp') && event.httpMethod === 'POST') return requestOtp(event)
  if (path.endsWith('/verify-otp') && event.httpMethod === 'POST') return verifyOtp(event)
  if (path.endsWith('/me') && event.httpMethod === 'GET') return me(event)
  if (path.endsWith('/logout') && event.httpMethod === 'POST') return logout(event)

  return response(404, { error: 'Not found' })
}
