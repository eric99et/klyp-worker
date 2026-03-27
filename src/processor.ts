import fs from 'fs'
import path from 'path'
import os from 'os'
import { v4 as uuidv4 } from 'uuid'
import { transcribeAudio } from './transcribe'
import { detectViralSegments } from './viral-detection'
import { extractAudio, cutClip, burnSubtitles } from './ffmpeg'
import { generateSubtitleFile } from './subtitles'
import { uploadFile } from './storage'
import type { ProcessOptions, ProcessResult, ClipResult, Transcript } from './types'

export async function processVideo(
  jobId: string,
  videoUrl: string,
  options: ProcessOptions = {},
  onProgress?: (progress: number) => void
): Promise<ProcessResult> {
  const workDir = path.join(os.tmpdir(), `klyp-${jobId}`)
  fs.mkdirSync(workDir, { recursive: true })

  try {
    const videoPath = path.join(workDir, 'input.mp4')
    const audioPath = path.join(workDir, 'audio.mp3')

    // Step 1: Download video (10-20%)
    console.log(`[Processor] Downloading video...`)
    onProgress?.(10)
    await downloadFile(videoUrl, videoPath)
    onProgress?.(20)

    // Step 2: Extract audio (20-30%)
    console.log(`[Processor] Extracting audio...`)
    await extractAudio(videoPath, audioPath)
    onProgress?.(30)

    // Step 3: Transcribe with OpenAI Whisper (30-50%)
    console.log(`[Processor] Transcribing audio...`)
    const transcript = await transcribeAudio(audioPath, options.language)
    onProgress?.(50)

    // Step 4: Detect viral segments with GPT (50-60%)
    console.log(`[Processor] Detecting viral segments...`)
    const segments = await detectViralSegments(transcript, {
      maxClips: options.maxClips || 5,
      minDuration: options.minClipDuration || 15,
      maxDuration: options.maxClipDuration || 60,
    })
    onProgress?.(60)

    // Step 5: Generate clips (60-80%)
    console.log(`[Processor] Generating ${segments.length} clips...`)
    const clips: ClipResult[] = []

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      const clipId = uuidv4()
      const clipPath = path.join(workDir, `clip-${clipId}.mp4`)
      const subtitlePath = path.join(workDir, `clip-${clipId}.srt`)
      const finalClipPath = path.join(workDir, `clip-${clipId}-final.mp4`)

      // Cut the clip from source video
      await cutClip(videoPath, clipPath, segment.startSeconds, segment.endSeconds)

      // Generate subtitle file for this segment
      const clipTranscript = getSegmentTranscript(transcript, segment.startSeconds, segment.endSeconds)
      await generateSubtitleFile(clipTranscript, subtitlePath, segment.startSeconds)

      // Burn subtitles into video
      await burnSubtitles(
        clipPath,
        subtitlePath,
        finalClipPath,
        options.subtitleStyle || 'clean_white',
        options.aspectRatio || '16:9'
      )

      // Upload to storage
      const clipUrl = await uploadFile(finalClipPath, `clips/${jobId}/${clipId}.mp4`)

      clips.push({
        title: segment.title,
        startSeconds: segment.startSeconds,
        endSeconds: segment.endSeconds,
        viralityScore: segment.viralityScore,
        reasoning: segment.reasoning,
        clipUrl,
      })

      onProgress?.(60 + Math.round(((i + 1) / segments.length) * 20))
    }

    return { transcript, clips }
  } finally {
    // Cleanup temp directory
    fs.rmSync(workDir, { recursive: true, force: true })
  }
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`)
  }

  const buffer = await response.arrayBuffer()
  fs.writeFileSync(destPath, Buffer.from(buffer))
}

function getSegmentTranscript(
  transcript: Transcript,
  startSeconds: number,
  endSeconds: number
): Transcript {
  const segments = transcript.segments.filter(
    (s) => s.start >= startSeconds && s.end <= endSeconds
  )

  return {
    rawText: segments.map((s) => s.text).join(' '),
    segments: segments.map((s) => ({
      ...s,
      start: s.start - startSeconds,
      end: s.end - startSeconds,
    })),
    language: transcript.language,
  }
}
