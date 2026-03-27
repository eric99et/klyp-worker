import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { processVideo } from './processor'
import { sendWebhook } from './webhook'
import type { ProcessRequest, JobStatus } from './types'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// In-memory job tracking
const jobs = new Map<string, { status: JobStatus; progress: number; error?: string }>()

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Klyp Video Worker',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: 'GET /health',
      process: 'POST /process',
      status: 'GET /status/:jobId',
    },
  })
})

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  })
})

// Process video endpoint
app.post('/process', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  const expectedSecret = process.env.WORKER_SECRET

  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const body = req.body as ProcessRequest

  // Validate required fields
  if (!body.jobId || !body.videoUrl || !body.webhookUrl) {
    res.status(400).json({
      error: 'Missing required fields: jobId, videoUrl, webhookUrl',
    })
    return
  }

  // Initialize job tracking
  jobs.set(body.jobId, { status: 'queued', progress: 0 })

  // Respond immediately - processing happens async
  res.json({
    success: true,
    jobId: body.jobId,
    message: 'Processing started',
  })

  // Process video asynchronously (fire and forget)
  processVideoAsync(body)
})

// Get job status endpoint
app.get('/status/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params
  const job = jobs.get(jobId)

  if (!job) {
    res.status(404).json({ error: 'Job not found' })
    return
  }

  res.json({
    jobId,
    ...job,
  })
})

// Async video processing
async function processVideoAsync(request: ProcessRequest) {
  const { jobId, videoUrl, webhookUrl, webhookSecret, options } = request

  try {
    // Update status: processing
    jobs.set(jobId, { status: 'processing', progress: 10 })
    await sendWebhook(webhookUrl, webhookSecret, {
      externalJobId: jobId,
      status: 'processing',
    })

    // Process the video
    const result = await processVideo(jobId, videoUrl, options, (progress) => {
      const current = jobs.get(jobId)
      if (current) {
        jobs.set(jobId, { ...current, progress })
      }
    })

    // Update status: rendering
    jobs.set(jobId, { status: 'rendering', progress: 80 })
    await sendWebhook(webhookUrl, webhookSecret, {
      externalJobId: jobId,
      status: 'rendering',
    })

    // Small delay to simulate rendering finalization
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Update status: completed
    jobs.set(jobId, { status: 'completed', progress: 100 })
    await sendWebhook(webhookUrl, webhookSecret, {
      externalJobId: jobId,
      status: 'completed',
      transcript: result.transcript,
      clips: result.clips,
    })

    console.log(`[Worker] Job ${jobId} completed successfully with ${result.clips.length} clips`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Worker] Job ${jobId} failed:`, errorMessage)

    jobs.set(jobId, { status: 'failed', progress: 0, error: errorMessage })
    await sendWebhook(webhookUrl, webhookSecret, {
      externalJobId: jobId,
      status: 'failed',
      error: errorMessage,
    })
  }
}

app.listen(PORT, () => {
  console.log(`[Worker] Klyp video processor running on port ${PORT}`)
  console.log(`[Worker] Endpoints:`)
  console.log(`  - GET  /health`)
  console.log(`  - GET  /`)
  console.log(`  - POST /process`)
  console.log(`  - GET  /status/:jobId`)
})
