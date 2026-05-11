/**
 * Generic DynamoDB CRUD Lambda factory.
 * Used by: announcements, links, tools, resources, process docs
 *
 * Usage:
 *   const { makeHandler } = require('../crud')
 *   exports.handler = makeHandler('announcements')
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} = require('@aws-sdk/lib-dynamodb')
const { authenticate, response, unauthorized, corsHeaders } = require('./middleware')
const crypto = require('crypto')

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }))

function makeHandler(tableSuffix, hooks = {}) {
  const TABLE = `${process.env.DYNAMODB_TABLE_PREFIX}${tableSuffix}`

  return async function handler(event) {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: corsHeaders(), body: '' }
    }

    const user = await authenticate(event)
    if (!user) return unauthorized()

    const method = event.httpMethod
    const path = event.path || event.rawPath || ''
    const segments = path.split('/').filter(Boolean)
    const id = segments[segments.length - 1]
    const hasId = id && !['announcements','links','tools','resources','process','boards','columns','cards','credentials'].includes(id)
    const params = event.queryStringParameters || {}

    // GET /resource
    if (method === 'GET' && !hasId) {
      let result = await dynamo.send(new ScanCommand({ TableName: TABLE }))
      let items = result.Items || []

      // Optional filter hook
      if (hooks.filter) items = hooks.filter(items, params)

      // Sort by createdAt or order if present
      items.sort((a, b) => {
        if (a.order !== undefined) return a.order - b.order
        return (a.createdAt || '') > (b.createdAt || '') ? -1 : 1
      })

      return response(200, { items })
    }

    // POST /resource
    if (method === 'POST' && !hasId) {
      const body = JSON.parse(event.body || '{}')
      const item = {
        id: crypto.randomUUID(),
        ...body,
        createdAt: new Date().toISOString(),
        createdBy: user.email,
      }

      if (hooks.beforeCreate) Object.assign(item, hooks.beforeCreate(item, user))

      await dynamo.send(new PutCommand({ TableName: TABLE, Item: item }))
      return response(201, item)
    }

    // PATCH /resource/:id
    if (method === 'PATCH' && hasId) {
      const body = JSON.parse(event.body || '{}')
      delete body.id
      delete body.createdAt
      delete body.createdBy

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

      return response(200, result.Attributes)
    }

    // DELETE /resource/:id
    if (method === 'DELETE' && hasId) {
      await dynamo.send(new DeleteCommand({ TableName: TABLE, Key: { id } }))
      return response(200, { ok: true })
    }

    return response(404, { error: 'Not found' })
  }
}

module.exports = { makeHandler }
