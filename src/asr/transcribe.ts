import { createReadStream } from 'fs';
import OpenAI from 'openai';
import { CaptionTrack, CaptionWord, PauseMarker } from '../types';

/** Gaps between words larger than this threshold are recorded as pause markers. */
const PAUSE_THRESHOLD_S = 0.3;

export interface TranscribeOptions {
  /** Frame rate used to convert timestamps to frame numbers. Defaults to 30. */
  fps?: number;
}

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY must be set for ASR transcription');
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

/**
 * Transcribe an audio file using Whisper and return a frame-accurate CaptionTrack.
 * Requires OPENAI_API_KEY in the environment.
 */
export async function transcribe(audioPath: string, opts: TranscribeOptions = {}): Promise<CaptionTrack> {
  const fps = opts.fps ?? 30;

  const response = await getClient().audio.transcriptions.create({
    file: createReadStream(audioPath),
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['word'],
  });

  // The SDK types verbose_json as Transcription; cast to access word timestamps.
  const rawWords: WhisperWord[] = (response as unknown as { words?: WhisperWord[] }).words ?? [];

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
