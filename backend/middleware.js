const { jwtVerify } = require('jose')

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

async function authenticate(event) {
  const cookie = event.headers?.cookie || event.headers?.Cookie || ''
  const match = cookie.match(/session=([^;]+)/)
  if (!match) return null

  try {
    const { payload } = await jwtVerify(match[1], JWT_SECRET)
    return { email: payload.email }
  } catch {
    return null
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.FRONTEND_URL,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  }
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    body: JSON.stringify(body),
  }
}

function unauthorized() {
  return response(401, { error: 'Not authenticated' })
}

module.exports = { authenticate, response, unauthorized, corsHeaders }
