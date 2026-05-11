const { S3Client, ListObjectsV2Command, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')
const { authenticate, response, unauthorized, corsHeaders } = require('../middleware')

const s3 = new S3Client({ region: process.env.AWS_REGION })
const BUCKET = process.env.S3_BUCKET

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' }
  }

  const user = await authenticate(event)
  if (!user) return unauthorized()

  const method = event.httpMethod
  const path = event.path || event.rawPath || ''
  const params = event.queryStringParameters || {}

  // GET /files?prefix=...
  if (method === 'GET' && !path.includes('/download-url')) {
    const prefix = params.prefix || ''
    const result = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
    }))

    const fileItems = (result.Contents || [])
      .filter(obj => !obj.Key.endsWith('/'))
      .map(obj => ({
        key: obj.Key,
        name: obj.Key.split('/').pop(),
        size: obj.Size,
        lastModified: obj.LastModified.toISOString(),
      }))

    return response(200, { files: fileItems })
  }

  // POST /files/upload-url
  if (method === 'POST' && path.includes('/upload-url')) {
    const { key, contentType } = JSON.parse(event.body || '{}')
    if (!key) return response(400, { error: 'key required' })

    // Add uploader metadata
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType || 'application/octet-stream',
      Metadata: { uploadedBy: user.email },
    })

    const url = await getSignedUrl(s3, command, { expiresIn: 300 })
    return response(200, { url, key })
  }

  // GET /files/download-url?key=...
  if (method === 'GET' && path.includes('/download-url')) {
    const key = params.key
    if (!key) return response(400, { error: 'key required' })

    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key })
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 })
    return response(200, { url })
  }

  // DELETE /files?key=...
  if (method === 'DELETE') {
    const key = params.key
    if (!key) return response(400, { error: 'key required' })

    // S3 versioning means this just creates a delete marker, doesn't destroy data
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
    return response(200, { ok: true })
  }

  return response(404, { error: 'Not found' })
}
