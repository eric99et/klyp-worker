import type { WebhookPayload } from './types'

export async function sendWebhook(
  webhookUrl: string,
  webhookSecret: string | undefined,
  payload: WebhookPayload
): Promise<void> {
  console.log(`[Webhook] Sending ${payload.status} callback to ${webhookUrl}`)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (webhookSecret) {
    headers['Authorization'] = `Bearer ${webhookSecret}`
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Webhook] Failed: ${response.status} ${errorText}`)
    } else {
      console.log(`[Webhook] Success: ${payload.status}`)
    }
  } catch (error) {
    console.error(`[Webhook] Error:`, error)
  }
}
