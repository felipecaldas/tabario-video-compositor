import { transcribe } from '../../src/asr/transcribe';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  delete process.env.VIDEO_MERGER_URL;
});

describe('transcribe — HTTP client', () => {
  it('calls edit-videos POST /transcribe/words and converts words to frames', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        words: [
          { word: ' Hello ', start: 0.0, end: 0.5 },
          { word: ' world ', start: 0.6, end: 1.0 },
        ],
        detected_language: 'en',
        confidence: 0.97,
      }),
    });

    const track = await transcribe('/data/shared/run-123/voiceover.mp3', { fps: 30 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://video-merger:8000/transcribe/words');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ mp3_path: '/data/shared/run-123/voiceover.mp3' });

    expect(track.words).toHaveLength(2);
    expect(track.words[0]).toEqual({ word: 'Hello', start_frame: 0, end_frame: 15 });
    expect(track.words[1]).toEqual({ word: 'world', start_frame: 18, end_frame: 30 });
  });

  it('passes language and model_size when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ words: [] }),
    });

    await transcribe('/data/shared/run-123/voiceover.mp3', { language: 'pt', modelSize: 'medium' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.language).toBe('pt');
    expect(body.model_size).toBe('medium');
  });

  it('uses VIDEO_MERGER_URL env var when set', async () => {
    process.env.VIDEO_MERGER_URL = 'http://custom-host:9000';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ words: [] }),
    });

    await transcribe('/data/shared/run-123/voiceover.mp3');

    expect(mockFetch.mock.calls[0][0]).toBe('http://custom-host:9000/transcribe/words');
  });

  it('detects pauses between words', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        words: [
          { word: 'Hello', start: 0.0, end: 0.5 },
          { word: 'world', start: 1.0, end: 1.5 }, // 0.5 s gap → pause
        ],
      }),
    });

    const track = await transcribe('/data/shared/run-123/voiceover.mp3', { fps: 30 });

    expect(track.pauses).toHaveLength(1);
    expect(track.pauses![0].start_frame).toBe(15);
    expect(track.pauses![0].duration_frames).toBe(15);
  });

  it('does not record short gaps as pauses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        words: [
          { word: 'one', start: 0.0, end: 0.3 },
          { word: 'two', start: 0.5, end: 0.8 }, // 0.2 s gap — below 0.3 threshold
        ],
      }),
    });

    const track = await transcribe('/data/shared/run-123/voiceover.mp3', { fps: 30 });
    expect(track.pauses).toHaveLength(0);
  });

  it('throws when edit-videos returns a non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'MP3 file not found: /data/shared/missing.mp3',
      statusText: 'Not Found',
    });

    await expect(
      transcribe('/data/shared/missing.mp3'),
    ).rejects.toThrow('[transcribe] edit-videos /transcribe/words returned 404');
  });

  it('handles empty words array gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ words: [] }),
    });

    const track = await transcribe('/data/shared/run-123/voiceover.mp3');
    expect(track.words).toHaveLength(0);
    expect(track.pauses).toHaveLength(0);
  });
});
