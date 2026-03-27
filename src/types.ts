export type JobStatus = 'queued' | 'processing' | 'rendering' | 'completed' | 'failed'

export interface ProcessRequest {
  jobId: string
  videoUrl: string
  webhookUrl: string
  webhookSecret?: string
  options?: ProcessOptions
}

export interface ProcessOptions {
  subtitleStyle?: SubtitleStyle
  aspectRatio?: '16:9' | '9:16' | '1:1'
  maxClips?: number
  minClipDuration?: number
  maxClipDuration?: number
  language?: string
}

export type SubtitleStyle =
  | 'clean_white'
  | 'bold_yellow'
  | 'gradient_blue'
  | 'neon_green'
  | 'minimal_gray'
  | 'classic_black'

export interface TranscriptSegment {
  start: number
  end: number
  text: string
}

export interface Transcript {
  rawText: string
  segments: TranscriptSegment[]
  language: string
}

export interface ClipResult {
  title: string
  startSeconds: number
  endSeconds: number
  viralityScore: number
  reasoning: string
  clipUrl: string
  thumbnailUrl?: string
  subtitleUrl?: string
}

export interface ProcessResult {
  transcript: Transcript
  clips: ClipResult[]
}

export interface WebhookPayload {
  externalJobId: string
  status: JobStatus
  error?: string
  transcript?: Transcript
  clips?: ClipResult[]
}
