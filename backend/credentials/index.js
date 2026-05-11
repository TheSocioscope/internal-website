const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, ScanCommand, PutCommand, UpdateCommand, DeleteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb')
const { KMSClient, EncryptCommand, DecryptCommand } = require('@aws-sdk/client-kms')
const { CloudWatchLogsClient, PutLogEventsCommand } = require('@aws-sdk/client-cloudwatch-logs')
const { authenticate, response, unauthorized, corsHeaders } = require('../middleware')
const crypto = require('crypto')

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }))
const kms = new KMSClient({ region: process.env.AWS_REGION })
const TABLE = `${process.env.DYNAMODB_TABLE_PREFIX}credentials`
const KMS_KEY_ID = process.env.KMS_KEY_ID

async function encrypt(plaintext) {
  const result = await kms.send(new EncryptCommand({
    KeyId: KMS_KEY_ID,
    Plaintext: Buffer.from(plaintext),
  }))
  return Buffer.from(result.CiphertextBlob).toString('base64')
}

async function decrypt(ciphertext) {
  const result = await kms.send(new DecryptCommand({
    CiphertextBlob: Buffer.from(ciphertext, 'base64'),
  }))
  return Buffer.from(result.Plaintext).toString('utf8')
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' }
  }

  const user = await authenticate(event)
  if (!user) return unauthorized()

  const method = event.httpMethod
  const path = event.path || event.rawPath || ''
  const segments = path.split('/').filter(Boolean)
  const isReveal = path.includes('/reveal')
  const id = isReveal ? segments[segments.length - 2] : segments[segments.length - 1]
  const hasId = id && id !== 'credentials'

  // GET /credentials (list, passwords redacted)
  if (method === 'GET' && !hasId) {
    const result = await dynamo.send(new ScanCommand({ TableName: TABLE }))
    const items = (result.Items || []).map(item => ({
      ...item,
      password: '[redacted]',
    }))
    return response(200, { items })
  }

  // GET /credentials/:id/reveal
  if (method === 'GET' && isReveal) {
    const result = await dynamo.send(new GetCommand({ TableName: TABLE, Key: { id } }))
    if (!result.Item) return response(404, { error: 'Not found' })

    const plaintext = await decrypt(result.Item.password)

    // Log the reveal event to CloudWatch
    console.log(JSON.stringify({
      event: 'credential_reveal',
      credentialId: id,
      service: result.Item.service,
      revealedBy: user.email,
      timestamp: new Date().toISOString(),
    }))

    return response(200, { value: plaintext })
  }

  // POST /credentials
  if (method === 'POST' && !hasId) {
    const body = JSON.parse(event.body || '{}')
    const encryptedPassword = body.password ? await encrypt(body.password) : ''

    const item = {
      id: crypto.randomUUID(),
      service: body.service,
      username: body.username || '',
      password: encryptedPassword,
      url: body.url || '',
      notes: body.notes || '',
      createdAt: new Date().toISOString(),
      createdBy: user.email,
    }

    await dynamo.send(new PutCommand({ TableName: TABLE, Item: item }))
    return response(201, { ...item, password: '[redacted]' })
  }

  // PATCH /credentials/:id
  if (method === 'PATCH' && hasId && !isReveal) {
    const body = JSON.parse(event.body || '{}')
    if (body.password) body.password = await encrypt(body.password)
    delete body.id; delete body.createdAt; delete body.createdBy

    const updateExpr = 'SET ' + Object.keys(body).map((k, i) => `#k${i} = :v${i}`).join(', ')
    const names = Object.keys(body).reduce((acc, k, i) => ({ ...acc, [`#k${i}`]: k }), {})
    const values = Object.keys(body).reduce((acc, k, i) => ({ ...acc, [`:v${i}`]: body[k] }), {})

    const result = await dynamo.send(new UpdateCommand({
      TableName: TABLE,
      Key: { id },
      UpdateExpression: updateExpr,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    }))

    return response(200, { ...result.Attributes, password: '[redacted]' })
  }

  // DELETE /credentials/:id
  if (method === 'DELETE' && hasId) {
    await dynamo.send(new DeleteCommand({ TableName: TABLE, Key: { id } }))
    return response(200, { ok: true })
  }

  return response(404, { error: 'Not found' })
}
