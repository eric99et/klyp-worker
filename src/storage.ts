import fs from 'fs'
import path from 'path'

export async function uploadFile(filePath: string, destPath: string): Promise<string> {
  const provider = process.env.STORAGE_PROVIDER || 'vercel-blob'

  switch (provider) {
    case 'vercel-blob':
      return uploadToVercelBlob(filePath, destPath)
    case 'local':
      return uploadLocal(filePath, destPath)
    default:
      throw new Error(`Unknown storage provider: ${provider}`)
  }
}

async function uploadToVercelBlob(filePath: string, destPath: string): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for Vercel Blob storage')
  }

  const fileBuffer = fs.readFileSync(filePath)
  const filename = path.basename(destPath)

  const response = await fetch(`https://blob.vercel-storage.com/${destPath}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': getContentType(filename),
      'x-vercel-blob-content-type': getContentType(filename),
    },
    body: fileBuffer,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Vercel Blob upload failed: ${error}`)
  }

  const result = (await response.json()) as { url: string }
  return result.url
}

async function uploadLocal(filePath: string, destPath: string): Promise<string> {
  const outputDir = process.env.LOCAL_STORAGE_PATH || './output'
  const fullPath = path.join(outputDir, destPath)

  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.copyFileSync(filePath, fullPath)

  const baseUrl = process.env.LOCAL_STORAGE_URL || `http://localhost:${process.env.PORT || 3000}/output`
  return `${baseUrl}/${destPath}`
}

function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  const types: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.srt': 'text/plain',
    '.vtt': 'text/vtt',
  }
  return types[ext] || 'application/octet-stream'
}
