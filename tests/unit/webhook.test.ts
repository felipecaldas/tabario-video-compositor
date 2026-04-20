import { sendCompletionWebhook } from '../../src/webhook/emitter';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('sendCompletionWebhook', () => {
  beforeEach(() => {
    process.env.VIDEO_COMPLETED_N8N_WEBHOOK_URL = 'https://n8n.example.com/webhook/test';
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.VIDEO_COMPLETED_N8N_WEBHOOK_URL;
  });

  const basePayload = {
    run_id: 'run-1',
    video_url: 'https://storage.example.com/video.mp4',
    status: 'completed' as const,
    compose_job_id: 'job-1',
  };

  it('sends POST with correct payload on success', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    await sendCompletionWebhook(basePayload);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://n8n.example.com/webhook/test');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.run_id).toBe('run-1');
    expect(body.status).toBe('completed');
  });

  it('skips webhook when URL not set', async () => {
    delete process.env.VIDEO_COMPLETED_N8N_WEBHOOK_URL;
    await sendCompletionWebhook(basePayload);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('retries on 5xx and eventually throws', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 });
    await expect(sendCompletionWebhook(basePayload)).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledTimes(3);
  }, 20000);

  it('throws immediately on 4xx (non-retryable)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });
    await expect(sendCompletionWebhook(basePayload)).rejects.toThrow('non-retryable');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
