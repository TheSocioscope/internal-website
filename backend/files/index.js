const { S3Client, ListObjectsV2Command, DeleteObjectCommand, HeadObjectCommand, CopyObjectCommand } = require('@aws-sdk/client-s3')
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

  // GET /files?prefix=...&delimiter=/
  if (method === 'GET' && !path.includes('/download-url')) {
    const prefix = params.prefix || ''
    const delimiter = params.delimiter || undefined
    const result = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      Delimiter: delimiter,
    }))

    const fileItems = (result.Contents || [])
      .filter(obj => !obj.Key.endsWith('/') && !obj.Key.endsWith('/.keep'))
      .map(obj => ({
        key: obj.Key,
        name: obj.Key.slice(prefix.length).split('/').pop(),
        size: obj.Size,
        lastModified: obj.LastModified.toISOString(),
      }))

    if (delimiter) {
      const folders = (result.CommonPrefixes || [])
        .map(p => p.Prefix)
        .filter(Boolean)
        .map(p => ({
          key: p,
          name: p.slice(prefix.length).replace(/\/$/, ''),
        }))
      return response(200, { files: fileItems, folders })
    }

    return response(200, { files: fileItems })
  }

  // POST /files/folder  body: { key: 'prefix/sub/' }
  if (method === 'POST' && path.includes('/folder')) {
    const { key } = JSON.parse(event.body || '{}')
    if (!key || !key.endsWith('/')) {
      return response(400, { error: 'key must end with "/"' })
    }
    if (key.includes('//') || key.startsWith('/')) {
      return response(400, { error: 'invalid folder key' })
    }
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: `${key}.keep`,
      Body: '',
      ContentType: 'application/octet-stream',
      Metadata: { uploadedBy: user.email },
    }))
    return response(200, { ok: true, key })
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

  // POST /files/rename  body: { fromKey, toKey }
  if (method === 'POST' && path.includes('/rename')) {
    const { fromKey, toKey } = JSON.parse(event.body || '{}')
    if (!fromKey || !toKey) return response(400, { error: 'fromKey and toKey required' })
    if (fromKey === toKey) return response(200, { ok: true, key: toKey })

    const encodedSource = `${BUCKET}/${fromKey.split('/').map(encodeURIComponent).join('/')}`
    await s3.send(new CopyObjectCommand({
      Bucket: BUCKET,
      Key: toKey,
      CopySource: encodedSource,
      MetadataDirective: 'COPY',
    }))
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: fromKey }))
    return response(200, { ok: true, key: toKey })
  }

  // DELETE /files?key=...
  if (method === 'DELETE') {
    const key = params.key
    if (!key) return response(400, { error: 'key required' })

    if (key.endsWith('/')) {
      // Folder: list everything under it and delete each object.
      // S3 versioning preserves history; this only adds delete markers.
      let continuationToken
      do {
        const listed = await s3.send(new ListObjectsV2Command({
          Bucket: BUCKET,
          Prefix: key,
          ContinuationToken: continuationToken,
        }))
        for (const obj of listed.Contents || []) {
          await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: obj.Key }))
        }
        continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined
      } while (continuationToken)
      return response(200, { ok: true })
    }

    // S3 versioning means this just creates a delete marker, doesn't destroy data
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
    return response(200, { ok: true })
  }

  return response(404, { error: 'Not found' })
}
