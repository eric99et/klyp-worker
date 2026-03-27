import fs from 'fs'
import type { Transcript } from './types'

/**
 * Generate an SRT subtitle file from a transcript
 */
export async function generateSubtitleFile(
  transcript: Transcript,
  outputPath: string,
  timeOffset: number = 0
): Promise<void> {
  const srtContent = generateSRT(transcript, timeOffset)
  fs.writeFileSync(outputPath, srtContent, 'utf-8')
  console.log(`[Subtitles] Generated SRT file: ${outputPath}`)
}

/**
 * Generate SRT format subtitle content
 */
function generateSRT(transcript: Transcript, timeOffset: number = 0): string {
  const lines: string[] = []

  transcript.segments.forEach((segment, index) => {
    const startTime = formatSRTTime(Math.max(0, segment.start - timeOffset))
    const endTime = formatSRTTime(Math.max(0, segment.end - timeOffset))

    lines.push(`${index + 1}`)
    lines.push(`${startTime} --> ${endTime}`)
    lines.push(segment.text)
    lines.push('')
  })

  return lines.join('\n')
}

/**
 * Format seconds to SRT timestamp format (HH:MM:SS,mmm)
 */
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(ms, 3)}`
}

function pad(num: number, size: number = 2): string {
  return num.toString().padStart(size, '0')
}

/**
 * Generate ASS format subtitle content (more styling options)
 */
export function generateASS(
  transcript: Transcript,
  style: {
    fontName?: string
    fontSize?: number
    primaryColor?: string
    outlineColor?: string
    bold?: boolean
  } = {}
): string {
  const {
    fontName = 'Arial',
    fontSize = 24,
    primaryColor = '&HFFFFFF',
    outlineColor = '&H000000',
    bold = false,
  } = style

  const header = `[Script Info]
Title: Generated Subtitles
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${primaryColor},&H000000FF,${outlineColor},&H00000000,${bold ? '-1' : '0'},0,0,0,100,100,0,0,1,2,1,2,10,10,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`

  const events = transcript.segments
    .map((segment) => {
      const start = formatASSTime(segment.start)
      const end = formatASSTime(segment.end)
      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${segment.text}`
    })
    .join('\n')

  return header + events
}

/**
 * Format seconds to ASS timestamp format (H:MM:SS.cc)
 */
function formatASSTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const centiseconds = Math.floor((seconds % 1) * 100)

  return `${hours}:${pad(minutes)}:${pad(secs)}.${pad(centiseconds)}`
}
