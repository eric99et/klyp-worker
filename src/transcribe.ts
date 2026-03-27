import OpenAI from 'openai'
import fs from 'fs'
import type { Transcript, TranscriptSegment } from './types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function transcribeAudio(
  audioPath: string,
  language?: string
): Promise<Transcript> {
  console.log(`[Transcribe] Processing audio file: ${audioPath}`)

  const audioFile = fs.createReadStream(audioPath)

  // Use Whisper API with verbose_json to get word-level timestamps
  const response = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    response_format: 'verbose_json',
    language: language || undefined,
    timestamp_granularities: ['segment'],
  })

  // Parse the response into our format
  const segments: TranscriptSegment[] = []

  if ('segments' in response && Array.isArray(response.segments)) {
    for (const segment of response.segments as Array<{ start: number; end: number; text: string }>) {
      segments.push({
        start: segment.start,
        end: segment.end,
        text: segment.text.trim(),
      })
    }
  }

  const transcript: Transcript = {
    rawText: response.text,
    segments,
    language: ('language' in response ? (response as { language: string }).language : language) || 'en',
  }

  console.log(`[Transcribe] Completed: ${segments.length} segments, ${transcript.rawText.length} characters`)

  return transcript
}
