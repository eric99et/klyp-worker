import { spawn } from 'child_process'
import type { SubtitleStyle } from './types'

// FFmpeg wrapper functions
function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[FFmpeg] Running: ffmpeg ${args.join(' ')}`)

    const process = spawn('ffmpeg', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stderr = ''
    process.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    process.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`))
      }
    })

    process.on('error', (err) => {
      reject(new Error(`FFmpeg failed to start: ${err.message}`))
    })
  })
}

export async function extractAudio(inputPath: string, outputPath: string): Promise<void> {
  await runFFmpeg([
    '-i',
    inputPath,
    '-vn',
    '-acodec',
    'libmp3lame',
    '-ar',
    '16000',
    '-ac',
    '1',
    '-y',
    outputPath,
  ])
}

export async function cutClip(
  inputPath: string,
  outputPath: string,
  startSeconds: number,
  endSeconds: number
): Promise<void> {
  const duration = endSeconds - startSeconds

  await runFFmpeg([
    '-ss',
    startSeconds.toString(),
    '-i',
    inputPath,
    '-t',
    duration.toString(),
    '-c:v',
    'libx264',
    '-c:a',
    'aac',
    '-preset',
    'fast',
    '-crf',
    '23',
    '-y',
    outputPath,
  ])
}

export async function burnSubtitles(
  inputPath: string,
  subtitlePath: string,
  outputPath: string,
  style: SubtitleStyle,
  aspectRatio: '16:9' | '9:16' | '1:1'
): Promise<void> {
  const styleConfig = getSubtitleStyle(style)

  // Calculate dimensions based on aspect ratio
  let scaleFilter = ''
  switch (aspectRatio) {
    case '9:16':
      scaleFilter = 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2'
      break
    case '1:1':
      scaleFilter = 'scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2'
      break
    case '16:9':
    default:
      scaleFilter = 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2'
      break
  }

  // Escape special characters in subtitle path for ffmpeg
  const escapedSubtitlePath = subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")

  await runFFmpeg([
    '-i',
    inputPath,
    '-vf',
    `${scaleFilter},subtitles='${escapedSubtitlePath}':force_style='${styleConfig}'`,
    '-c:v',
    'libx264',
    '-c:a',
    'aac',
    '-preset',
    'fast',
    '-crf',
    '23',
    '-y',
    outputPath,
  ])
}

function getSubtitleStyle(style: SubtitleStyle): string {
  const styles: Record<SubtitleStyle, string> = {
    clean_white:
      'FontName=Arial,FontSize=24,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,BorderStyle=3,Outline=2,Shadow=1,MarginV=30',
    bold_yellow:
      'FontName=Impact,FontSize=28,PrimaryColour=&H00FFFF,OutlineColour=&H000000,BorderStyle=1,Outline=3,Shadow=2,MarginV=30,Bold=1',
    gradient_blue:
      'FontName=Arial,FontSize=26,PrimaryColour=&HFFFF00,OutlineColour=&HFF0000,BorderStyle=3,Outline=2,Shadow=1,MarginV=30',
    neon_green:
      'FontName=Arial Black,FontSize=26,PrimaryColour=&H00FF00,OutlineColour=&H000000,BorderStyle=1,Outline=3,Shadow=0,MarginV=30,Bold=1',
    minimal_gray:
      'FontName=Helvetica,FontSize=22,PrimaryColour=&HC0C0C0,OutlineColour=&H404040,BorderStyle=3,Outline=1,Shadow=0,MarginV=30',
    classic_black:
      'FontName=Times New Roman,FontSize=24,PrimaryColour=&H000000,BackColour=&H80FFFFFF,BorderStyle=4,Outline=0,Shadow=0,MarginV=30',
  }

  return styles[style] || styles.clean_white
}

export async function getVideoDuration(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const process = spawn('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      inputPath,
    ])

    let stdout = ''
    process.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    process.on('close', (code) => {
      if (code === 0) {
        resolve(parseFloat(stdout.trim()))
      } else {
        reject(new Error('Failed to get video duration'))
      }
    })
  })
}
