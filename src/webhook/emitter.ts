const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export interface CompletionWebhookPayload {
  run_id: string;
  video_idea_id?: string;
  video_url: string;
  status: 'completed' | 'failed';
  error?: string;
  platform?: string;
  compose_job_id: string;
}

/**
 * Send completion webhook to n8n (or any configured endpoint).
 * Retries up to MAX_RETRIES times on 5xx responses.
 * Mirrors the contract from edit-videos send_completion_webhook.
 */
export async function sendCompletionWebhook(payload: CompletionWebhookPayload): Promise<void> {
  const webhookUrl = process.env.VIDEO_COMPLETED_N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[webhook] VIDEO_COMPLETED_N8N_WEBHOOK_URL not set — skipping webhook');
    return;
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`[webhook] Sending completion webhook attempt ${attempt}/${MAX_RETRIES} for run_id=${payload.run_id}`);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log(`[webhook] Webhook delivered successfully (status ${response.status})`);
        return;
      }

      if (response.status >= 400 && response.status < 500) {
        // Non-retryable client error
        throw new Error(`Webhook rejected with non-retryable status ${response.status}`);
      }

      lastError = new Error(`Webhook attempt ${attempt} failed with status ${response.status}`);
      console.warn(`[webhook] ${lastError.message}`);
    } catch (err) {
      if ((err as Error).message.includes('non-retryable')) throw err;
      lastError = err as Error;
      console.warn(`[webhook] Attempt ${attempt} error: ${lastError.message}`);
    }

    if (attempt < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }

  throw lastError ?? new Error('Webhook delivery failed after all retries');
}
