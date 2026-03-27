import OpenAI from 'openai'
import type { Transcript } from './types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface ViralSegment {
  title: string
  startSeconds: number
  endSeconds: number
  viralityScore: number
  reasoning: string
}

interface DetectionOptions {
  maxClips: number
  minDuration: number
  maxDuration: number
}

export async function detectViralSegments(
  transcript: Transcript,
  options: DetectionOptions
): Promise<ViralSegment[]> {
  console.log(`[ViralDetection] Analyzing transcript for viral segments...`)

  const prompt = `You are an expert at identifying viral-worthy clips from video transcripts. Your job is to find the most engaging, shareable moments.

TRANSCRIPT:
${transcript.rawText}

SEGMENT TIMESTAMPS (for reference):
${transcript.segments.map((s) => `[${formatTime(s.start)} - ${formatTime(s.end)}]: ${s.text}`).join('\n')}

REQUIREMENTS:
- Find up to ${options.maxClips} viral-worthy segments
- Each segment should be between ${options.minDuration} and ${options.maxDuration} seconds
- Look for: emotional moments, surprising revelations, actionable advice, funny moments, controversial statements, motivational content
- Each clip should be self-contained and make sense without context
- Prioritize segments that would perform well on TikTok, Instagram Reels, or YouTube Shorts

OUTPUT FORMAT (JSON array):
[
  {
    "title": "Short catchy title for the clip (max 50 chars)",
    "startSeconds": <start time in seconds>,
    "endSeconds": <end time in seconds>,
    "viralityScore": <1-100 score based on viral potential>,
    "reasoning": "Brief explanation of why this segment would go viral"
  }
]

Return ONLY valid JSON, no additional text.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a viral content expert. Return only valid JSON arrays.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 2000,
  })

  const content = response.choices[0]?.message?.content || '[]'

  try {
    // Extract JSON from the response (handle markdown code blocks)
    let jsonStr = content
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1]
    }

    const segments = JSON.parse(jsonStr.trim()) as ViralSegment[]

    // Validate and filter segments
    const validSegments = segments
      .filter((s) => {
        const duration = s.endSeconds - s.startSeconds
        return (
          s.startSeconds >= 0 &&
          s.endSeconds > s.startSeconds &&
          duration >= options.minDuration &&
          duration <= options.maxDuration
        )
      })
      .slice(0, options.maxClips)
      .sort((a, b) => b.viralityScore - a.viralityScore)

    console.log(`[ViralDetection] Found ${validSegments.length} viral segments`)
    return validSegments
  } catch (error) {
    console.error('[ViralDetection] Failed to parse GPT response:', error)
    console.error('[ViralDetection] Raw response:', content)

    // Fallback: create a single clip from the beginning
    return [
      {
        title: 'Highlight Clip',
        startSeconds: 0,
        endSeconds: Math.min(options.maxDuration, getTranscriptDuration(transcript)),
        viralityScore: 50,
        reasoning: 'Automatic clip from video start',
      },
    ]
  }
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function getTranscriptDuration(transcript: Transcript): number {
  if (transcript.segments.length === 0) return 30
  return transcript.segments[transcript.segments.length - 1].end
}
