const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, ScanCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb')
const { authenticate, response, unauthorized, corsHeaders } = require('../middleware')
const crypto = require('crypto')

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }))
const PREFIX = process.env.DYNAMODB_TABLE_PREFIX

const BOARDS_TABLE = `${PREFIX}kanban_boards`
const COLUMNS_TABLE = `${PREFIX}kanban_columns`
const CARDS_TABLE = `${PREFIX}kanban_cards`

const DEFAULT_COLUMNS = ['Backlog', 'In progress', 'Review', 'Done']

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' }
  }

  const user = await authenticate(event)
  if (!user) return unauthorized()

  const method = event.httpMethod
  const path = event.path || event.rawPath || ''
  const segments = path.split('/').filter(Boolean)

  // /boards
  if (segments[0] === 'boards') {
    const boardId = segments[1]
    const sub = segments[2] // columns or cards

    // GET /boards
    if (method === 'GET' && !boardId) {
      const result = await dynamo.send(new ScanCommand({ TableName: BOARDS_TABLE }))
      const items = (result.Items || []).sort((a, b) => a.createdAt > b.createdAt ? 1 : -1)
      return response(200, { items })
    }

    // POST /boards
    if (method === 'POST' && !boardId) {
      const { name } = JSON.parse(event.body || '{}')
      const boards = await dynamo.send(new ScanCommand({ TableName: BOARDS_TABLE }))
      const isDefault = (boards.Items || []).length === 0

      const board = {
        id: crypto.randomUUID(),
        name,
        isDefault,
        createdAt: new Date().toISOString(),
        createdBy: user.email,
      }
      await dynamo.send(new PutCommand({ TableName: BOARDS_TABLE, Item: board }))

      // Create default columns
      for (let i = 0; i < DEFAULT_COLUMNS.length; i++) {
        await dynamo.send(new PutCommand({
          TableName: COLUMNS_TABLE,
          Item: {
            id: crypto.randomUUID(),
            boardId: board.id,
            name: DEFAULT_COLUMNS[i],
            order: i,
            createdAt: new Date().toISOString(),
          },
        }))
      }

      return response(201, board)
    }

    // GET /boards/:id/columns
    if (method === 'GET' && boardId && sub === 'columns') {
      const result = await dynamo.send(new ScanCommand({
        TableName: COLUMNS_TABLE,
        FilterExpression: 'boardId = :bid',
        ExpressionAttributeValues: { ':bid': boardId },
      }))
      const items = (result.Items || []).sort((a, b) => a.order - b.order)
      return response(200, { items })
    }

    // POST /boards/:id/columns
    if (method === 'POST' && boardId && sub === 'columns') {
      const { name, order } = JSON.parse(event.body || '{}')
      const col = {
        id: crypto.randomUUID(),
        boardId,
        name,
        order: order ?? 0,
        createdAt: new Date().toISOString(),
      }
      await dynamo.send(new PutCommand({ TableName: COLUMNS_TABLE, Item: col }))
      return response(201, col)
    }

    // GET /boards/:id/cards
    if (method === 'GET' && boardId && sub === 'cards') {
      const result = await dynamo.send(new ScanCommand({
        TableName: CARDS_TABLE,
        FilterExpression: 'boardId = :bid',
        ExpressionAttributeValues: { ':bid': boardId },
      }))
      const items = (result.Items || []).sort((a, b) => a.order - b.order)
      return response(200, { items })
    }

    // POST /boards/:id/cards
    if (method === 'POST' && boardId && sub === 'cards') {
      const body = JSON.parse(event.body || '{}')
      const card = {
        id: crypto.randomUUID(),
        boardId,
        columnId: body.columnId,
        title: body.title,
        description: body.description || '',
        assignee: body.assignee || '',
        order: body.order ?? 0,
        createdAt: new Date().toISOString(),
        createdBy: user.email,
      }
      await dynamo.send(new PutCommand({ TableName: CARDS_TABLE, Item: card }))
      return response(201, card)
    }
  }

  // /columns/:id
  if (segments[0] === 'columns') {
    const id = segments[1]

    if (method === 'PATCH') {
      const body = JSON.parse(event.body || '{}')
      delete body.id; delete body.boardId; delete body.createdAt

      const updateExpr = 'SET ' + Object.keys(body).map((k, i) => `#k${i} = :v${i}`).join(', ')
      const names = Object.keys(body).reduce((acc, k, i) => ({ ...acc, [`#k${i}`]: k }), {})
      const values = Object.keys(body).reduce((acc, k, i) => ({ ...acc, [`:v${i}`]: body[k] }), {})

      const result = await dynamo.send(new UpdateCommand({
        TableName: COLUMNS_TABLE,
        Key: { id },
        UpdateExpression: updateExpr,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: 'ALL_NEW',
      }))
      return response(200, result.Attributes)
    }

    if (method === 'DELETE') {
      await dynamo.send(new DeleteCommand({ TableName: COLUMNS_TABLE, Key: { id } }))
      return response(200, { ok: true })
    }
  }

  // /cards/:id
  if (segments[0] === 'cards') {
    const id = segments[1]

    if (method === 'PATCH') {
      const body = JSON.parse(event.body || '{}')
      delete body.id; delete body.boardId; delete body.createdAt; delete body.createdBy

      const updateExpr = 'SET ' + Object.keys(body).map((k, i) => `#k${i} = :v${i}`).join(', ')
      const names = Object.keys(body).reduce((acc, k, i) => ({ ...acc, [`#k${i}`]: k }), {})
      const values = Object.keys(body).reduce((acc, k, i) => ({ ...acc, [`:v${i}`]: body[k] }), {})

      const result = await dynamo.send(new UpdateCommand({
        TableName: CARDS_TABLE,
        Key: { id },
        UpdateExpression: updateExpr,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: 'ALL_NEW',
      }))
      return response(200, result.Attributes)
    }

    if (method === 'DELETE') {
      await dynamo.send(new DeleteCommand({ TableName: CARDS_TABLE, Key: { id } }))
      return response(200, { ok: true })
    }
  }

  return response(404, { error: 'Not found' })
}
