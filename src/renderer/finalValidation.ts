import { execFile } from 'child_process';
import { writeFile } from 'fs/promises';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const DEFAULT_DURATION_TOLERANCE_SECONDS = 1;
const DEFAULT_BLACK_FRAME_RATIO_THRESHOLD = 0.95;

export interface FinalRenderValidationOptions {
  outputPath: string;
  reportPath: string;
  expected: {
    width: number;
    height: number;
    fps: number;
    durationSeconds: number;
    requireAudio: boolean;
  };
  durationToleranceSeconds?: number;
  blackFrameRatioThreshold?: number;
}

export interface FinalRenderValidationReport {
  ok: boolean;
  outputPath: string;
  checkedAt: string;
  expected: FinalRenderValidationOptions['expected'];
  probe: {
    hasVideo: boolean;
    hasAudio: boolean;
    width?: number;
    height?: number;
    fps?: number;
    durationSeconds?: number;
  };
  blackFrames: {
    durationSeconds: number;
    ratio: number;
    threshold: number;
  };
  failures: string[];
}

interface FfprobeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  duration?: string;
}

interface FfprobePayload {
  streams?: FfprobeStream[];
  format?: {
    duration?: string;
  };
}

export async function validateFinalRender(
  options: FinalRenderValidationOptions,
): Promise<FinalRenderValidationReport> {
  const tolerance = options.durationToleranceSeconds ?? DEFAULT_DURATION_TOLERANCE_SECONDS;
  const blackThreshold = options.blackFrameRatioThreshold ?? DEFAULT_BLACK_FRAME_RATIO_THRESHOLD;
  const probe = await probeRender(options.outputPath);
  const blackDuration = await detectBlackFrameDuration(options.outputPath);
  const durationSeconds = probe.durationSeconds ?? options.expected.durationSeconds;
  const blackRatio = durationSeconds > 0 ? blackDuration / durationSeconds : 1;
  const failures = collectFailures(options, probe, blackRatio, tolerance, blackThreshold);
  const report: FinalRenderValidationReport = {
    ok: failures.length === 0,
    outputPath: options.outputPath,
    checkedAt: new Date().toISOString(),
    expected: options.expected,
    probe,
    blackFrames: {
      durationSeconds: blackDuration,
      ratio: blackRatio,
      threshold: blackThreshold,
    },
    failures,
  };

  await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (!report.ok) {
    throw new Error(`Final render validation failed: ${failures.join('; ')}`);
  }

  return report;
}

async function probeRender(outputPath: string): Promise<FinalRenderValidationReport['probe']> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_streams',
    '-show_format',
    '-of', 'json',
    outputPath,
  ]);
  const payload = JSON.parse(String(stdout)) as FfprobePayload;
  const streams = payload.streams ?? [];
  const video = streams.find((stream) => stream.codec_type === 'video');
  const audio = streams.find((stream) => stream.codec_type === 'audio');
  const durationSeconds = parseFiniteNumber(video?.duration)
    ?? parseFiniteNumber(payload.format?.duration);

  return {
    hasVideo: Boolean(video),
    hasAudio: Boolean(audio),
    width: video?.width,
    height: video?.height,
    fps: parseFps(video?.avg_frame_rate) ?? parseFps(video?.r_frame_rate),
    durationSeconds,
  };
}

async function detectBlackFrameDuration(outputPath: string): Promise<number> {
  try {
    const { stderr } = await execFileAsync('ffmpeg', [
      '-hide_banner',
      '-i', outputPath,
      '-vf', 'blackdetect=d=0.1:pix_th=0.1',
      '-an',
      '-f', 'null',
      '-',
    ]);

    return sumBlackDetectDurations(String(stderr));
  } catch (err) {
    const stderr = (err as { stderr?: string | Buffer }).stderr;
    if (stderr) {
      return sumBlackDetectDurations(String(stderr));
    }
    throw err;
  }
}

function collectFailures(
  options: FinalRenderValidationOptions,
  probe: FinalRenderValidationReport['probe'],
  blackRatio: number,
  durationToleranceSeconds: number,
  blackFrameRatioThreshold: number,
): string[] {
  const failures: string[] = [];

  if (!probe.hasVideo) {
    failures.push('missing video stream');
  }
  if (options.expected.requireAudio && !probe.hasAudio) {
    failures.push('missing audio stream');
  }
  if (probe.width !== undefined && probe.width !== options.expected.width) {
    failures.push(`width ${probe.width} != expected ${options.expected.width}`);
  }
  if (probe.height !== undefined && probe.height !== options.expected.height) {
    failures.push(`height ${probe.height} != expected ${options.expected.height}`);
  }
  if (probe.fps !== undefined && Math.abs(probe.fps - options.expected.fps) > 0.01) {
    failures.push(`fps ${probe.fps} != expected ${options.expected.fps}`);
  }
  if (
    probe.durationSeconds !== undefined
    && Math.abs(probe.durationSeconds - options.expected.durationSeconds) > durationToleranceSeconds
  ) {
    failures.push(
      `duration ${probe.durationSeconds}s outside ${durationToleranceSeconds}s tolerance of expected ${options.expected.durationSeconds}s`,
    );
  }
  if (blackRatio >= blackFrameRatioThreshold) {
    failures.push(`black-frame ratio ${blackRatio.toFixed(3)} >= threshold ${blackFrameRatioThreshold}`);
  }

  return failures;
}

function parseFps(value: string | undefined): number | undefined {
  if (!value || value === '0/0') {
    return undefined;
  }
  if (value.includes('/')) {
    const [numerator, denominator] = value.split('/').map(Number);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return undefined;
    }
    return numerator / denominator;
  }

  return parseFiniteNumber(value);
}

function parseFiniteNumber(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sumBlackDetectDurations(stderr: string): number {
  const matches = stderr.matchAll(/black_duration:([0-9.]+)/g);
  return [...matches].reduce((sum, match) => sum + Number(match[1]), 0);
}
