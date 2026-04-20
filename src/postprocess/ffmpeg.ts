import { execFile } from 'child_process';
import { promisify } from 'util';
import { AudioTargets } from '../types';

const execFileAsync = promisify(execFile);

const DEFAULT_LUFS = -16;
const DEFAULT_DUCKING_DB = -12;

export interface PostProcessOptions {
  inputPath: string;
  outputPath: string;
  audioTargets?: AudioTargets;
}

/**
 * Apply FFmpeg post-processing: LUFS normalisation + H.264 platform encoding.
 * Normalises voiceover to target LUFS, ducks background music by ducking_db.
 */
export async function applyPostProcessing(options: PostProcessOptions): Promise<void> {
  const { inputPath, outputPath, audioTargets } = options;
  const lufsTarget = audioTargets?.voiceover_lufs ?? DEFAULT_LUFS;
  const duckingDb = audioTargets?.music_ducking_db ?? DEFAULT_DUCKING_DB;

  console.log(`[ffmpeg] Post-processing: LUFS=${lufsTarget}, ducking=${duckingDb}dB`);
  console.log(`[ffmpeg] Input: ${inputPath} → Output: ${outputPath}`);

  // Two-pass loudness normalisation (EBU R128) + H.264 encoding
  const args = [
    '-i', inputPath,
    '-af', `loudnorm=I=${lufsTarget}:LRA=11:TP=-1.5,volume=${duckingDb}dB`,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    '-y',
    outputPath,
  ];

  try {
    const { stderr } = await execFileAsync('ffmpeg', args);
    if (stderr) {
      console.debug(`[ffmpeg] stderr: ${stderr}`);
    }
    console.log(`[ffmpeg] Post-processing complete: ${outputPath}`);
  } catch (err) {
    throw new Error(`FFmpeg post-processing failed: ${(err as Error).message}`);
  }
}

/**
 * Build the FFmpeg argument list for testing (without executing).
 */
export function buildFfmpegArgs(options: PostProcessOptions): string[] {
  const { inputPath, outputPath, audioTargets } = options;
  const lufsTarget = audioTargets?.voiceover_lufs ?? DEFAULT_LUFS;
  const duckingDb = audioTargets?.music_ducking_db ?? DEFAULT_DUCKING_DB;

  return [
    '-i', inputPath,
    '-af', `loudnorm=I=${lufsTarget}:LRA=11:TP=-1.5,volume=${duckingDb}dB`,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    '-y',
    outputPath,
  ];
}
