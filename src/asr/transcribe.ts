import { CaptionTrack, CaptionWord, PauseMarker } from '../types';

/** Gaps between words larger than this threshold are recorded as pause markers. */
const PAUSE_THRESHOLD_S = 0.3;

export interface TranscribeOptions {
  /** Frame rate used to convert timestamps to frame numbers. Defaults to 30. */
  fps?: number;
  /** Language hint passed to Whisper (e.g. 'en', 'pt'). Omit for auto-detection. */
  language?: string;
  /** Whisper model size. Defaults to 'small'. */
  modelSize?: string;
}

interface RawWord {
  word: string;
  start: number;
  end: number;
}

interface WordTranscriptionResponse {
  words: RawWord[];
  detected_language?: string;
  confidence?: number;
}

/**
 * Transcribe an audio file using the edit-videos faster-whisper service and
 * return a frame-accurate CaptionTrack.
 *
 * The audio file must be accessible at a /data/shared path inside the
 * edit-videos container. Calls POST /transcribe/words on VIDEO_MERGER_URL.
 */
export async function transcribe(audioPath: string, opts: TranscribeOptions = {}): Promise<CaptionTrack> {
  const fps = opts.fps ?? 30;
  const baseUrl = (process.env.VIDEO_MERGER_URL ?? 'http://video-merger:8000').replace(/\/$/, '');

  const body: Record<string, string> = { mp3_path: audioPath };
  if (opts.language) body.language = opts.language;
  if (opts.modelSize) body.model_size = opts.modelSize;

  const res = await fetch(`${baseUrl}/transcribe/words`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`[transcribe] edit-videos /transcribe/words returned ${res.status}: ${detail}`);
  }

  const data: WordTranscriptionResponse = await res.json() as WordTranscriptionResponse;
  const rawWords: RawWord[] = data.words ?? [];

  const words: CaptionWord[] = rawWords.map((w) => ({
    word: w.word.trim(),
    start_frame: Math.round(w.start * fps),
    end_frame: Math.round(w.end * fps),
  }));

  const pauses: PauseMarker[] = [];
  for (let i = 1; i < rawWords.length; i++) {
    const gap = rawWords[i].start - rawWords[i - 1].end;
    if (gap >= PAUSE_THRESHOLD_S) {
      pauses.push({
        start_frame: Math.round(rawWords[i - 1].end * fps),
        duration_frames: Math.round(gap * fps),
      });
    }
  }

  return { words, pauses };
}
