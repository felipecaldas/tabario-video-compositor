import { execFile } from 'child_process';
import { promisify } from 'util';
import { AudioTargets } from '../types';

const execFileAsync = promisify(execFile);

const DEFAULT_LUFS = -16;

export interface PostProcessOptions {
  inputPath: string;
  outputPath: string;
  audioTargets?: AudioTargets;
}

/**
 * Apply FFmpeg post-processing: LUFS normalisation + H.264 platform encoding.
 *
 * The post-pass loudness-normalises the already-mixed audio (voiceover +
 * optional music) to the target LUFS.  Music ducking is applied upstream
 * in the Remotion composition via `<Audio volume>` so the final mix is
 * already balanced; this pass therefore applies ONLY loudnorm and does
 * not attenuate the whole mix.
 */
export async function applyPostProcessing(options: PostProcessOptions): Promise<void> {
  const { inputPath, outputPath, audioTargets } = options;
  const lufsTarget = audioTargets?.voiceover_lufs ?? DEFAULT_LUFS;

  console.log(`[ffmpeg] Post-processing: LUFS=${lufsTarget}`);
  console.log(`[ffmpeg] Input: ${inputPath} → Output: ${outputPath}`);

  const args = buildFfmpegArgs(options);

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
 * Probe the video codec of a file using ffprobe.
 * Returns the codec name (e.g. "h264", "hevc") or null on failure.
 */
async function probeVideoCodec(filePath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Probe the frame rate of a video file using ffprobe.
 * Returns the FPS as an integer (e.g. 32 from "32000/1000") or null on failure.
 */
async function probeFps(filePath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=avg_frame_rate',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    const raw = stdout.trim();
    if (!raw) return null;

    // Handle rational format like "32000/1000" → 32
    if (raw.includes('/')) {
      const [num, den] = raw.split('/').map(Number);
      if (den && !isNaN(num) && !isNaN(den)) {
        return Math.round(num / den);
      }
    }

    // Handle decimal format like "32.0" or "30.0"
    const parsed = parseFloat(raw);
    return isNaN(parsed) ? null : Math.round(parsed);
  } catch {
    return null;
  }
}

/**
 * Transcode a video clip to H.264 in-place if it is not already H.264.
 * Remotion/Chrome requires H.264 video; ComfyUI WAN models produce H.265.
 * If targetFps is provided and differs from source FPS, also normalizes frame rate.
 * Returns the path to the H.264-compatible file (may be the original or a new file).
 */
export async function ensureH264(inputPath: string, targetFps?: number): Promise<string> {
  const codec = await probeVideoCodec(inputPath);
  const fps = await probeFps(inputPath);
  const needsFpsConversion = targetFps !== undefined && fps !== null && fps !== targetFps;

  console.log(`[ffmpeg] ensureH264: ${inputPath} → codec=${codec ?? 'unknown'}, fps=${fps ?? 'unknown'}, targetFps=${targetFps ?? 'none'}, needsConversion=${needsFpsConversion}`);

  if (codec === 'h264' && !needsFpsConversion) {
    console.log(`[ffmpeg] Clip already H.264 at ${fps}fps, skipping transcode: ${inputPath}`);
    return inputPath;
  }

  console.log(`[ffmpeg] Transcoding clip from ${codec ?? 'unknown'} → H.264${needsFpsConversion ? ` (normalizing ${fps}fps → ${targetFps}fps)` : ''}: ${inputPath}`);
  const outputPath = inputPath.replace(/(\.[^.]+)$/, '_h264$1');

  const args = [
    '-i', inputPath,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    // Force an I-frame at t=0 and every 30 frames so Remotion can seek
    // to the first frame without a decoder stall (the stutter/freeze bug).
    '-force_key_frames', 'expr:gte(t,0)',
    '-g', '30',
    '-keyint_min', '1',
  ];
  if (needsFpsConversion) {
    args.push('-r', String(targetFps));
  }
  args.push('-c:a', 'copy', '-movflags', '+faststart', '-y', outputPath);

  await execFileAsync('ffmpeg', args);

  console.log(`[ffmpeg] Transcode complete: ${outputPath}`);
  return outputPath;
}

/**
 * Build the FFmpeg argument list for `applyPostProcessing`.  Exported
 * separately so unit tests can assert the exact flags without executing
 * FFmpeg.  Applies loudnorm (EBU R128) to the mixed track and re-encodes
 * the video to H.264 with faststart for web delivery.
 */
export function buildFfmpegArgs(options: PostProcessOptions): string[] {
  const { inputPath, outputPath, audioTargets } = options;
  const lufsTarget = audioTargets?.voiceover_lufs ?? DEFAULT_LUFS;

  return [
    '-i', inputPath,
    '-af', `loudnorm=I=${lufsTarget}:LRA=11:TP=-1.5`,
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
