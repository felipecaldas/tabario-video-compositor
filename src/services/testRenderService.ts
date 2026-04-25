import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { CompositionManifest, BrandProfile, TransitionType } from '../types';
import { CompositionManifestSchema } from '../manifest/schema';
import { renderComposition } from '../renderer/renderWorker';

const DATA_SHARED = process.env.DATA_SHARED_DIR ?? '/data/shared';

export const TEST_BRAND_PROFILE: BrandProfile = {
  id: 'test',
  client_id: 'test',
  brand_colors: { primary: '#1A3B5D', accent: '#FFC107', secondary: '#4CAF50' },
  heading_font_url: undefined,
  body_font_url: undefined,
  motion_style: {
    energy: 'medium',
    pace: 'medium',
    transition_preference: ['soft_cut', 'slide_push'],
  },
  audio_targets: { voiceover_lufs: -16, music_ducking_db: -12 },
  cta_defaults: { url: 'https://tabario.com', show_qr: false, logo_position: 'bottom-right' },
};

export interface ClipMeta {
  filename: string;
  index: number;
}

export function scanRunDirectory(runId: string): { clips: ClipMeta[]; hasVoiceover: boolean } {
  const dir = join(DATA_SHARED, runId);
  if (!existsSync(dir)) {
    throw new Error(`run_id directory not found: ${dir}`);
  }

  const files = readdirSync(dir);
  const clips: ClipMeta[] = files
    .filter((f) => /^(video|image|talking_head)_\d+\.(mp4|webm|png|jpg|jpeg|webp)$/i.test(f))
    .map((filename) => {
      const match = filename.match(/_(\d+)\./);
      return { filename, index: match ? parseInt(match[1], 10) : 0 };
    })
    .sort((a, b) => a.index - b.index);

  const hasVoiceover = files.some((f) => f === 'voiceover.mp3' || f === 'voiceover.wav');

  return { clips, hasVoiceover };
}

export function buildStubManifest(
  clips: ClipMeta[],
  platform: string,
  runId: string,
  clientId: string,
): CompositionManifest {
  const isVertical = platform === 'tiktok' || platform === 'instagram' || platform === 'yt_shorts';
  const is11 = platform === 'x_square';
  const width = is11 ? 1080 : isVertical ? 1080 : 1920;
  const height = is11 ? 1080 : isVertical ? 1920 : 1080;
  const fps = 30;
  const sceneDurationFrames = fps * 4;

  const scenes = clips.map((clip, i) => ({
    index: i,
    clip_filename: clip.filename,
    duration_frames: sceneDurationFrames,
    layout: 'fullscreen' as const,
  }));

  const totalSceneDuration = scenes.reduce((sum, s) => sum + s.duration_frames, 0);
  const closingDuration = fps * 3;
  const totalDuration = totalSceneDuration + closingDuration;

  const transitions = scenes
    .slice(0, -1)
    .map((_, i) => ({
      between: [i, i + 1] as [number, number],
      type: 'soft_cut' as TransitionType,
      duration_frames: 15,
    }));

  const raw = {
    schema: 'compose.v1' as const,
    client_id: clientId,
    run_id: runId,
    platform,
    fps,
    width,
    height,
    duration_frames: totalDuration,
    scenes,
    transitions,
    overlays: [],
    audio_track: {
      voiceover_filename: 'voiceover.mp3',
      lufs_target: -16,
      music_ducking_db: -12,
    },
    closing: {
      component: 'end_card' as const,
      cta: { text: 'Learn more', url: 'https://tabario.com', show_qr: false },
      show_logo: true,
      start_frame: totalSceneDuration,
      duration_frames: closingDuration,
    },
  };

  const result = CompositionManifestSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`buildStubManifest produced invalid manifest: ${result.error.message}`);
  }
  return result.data as unknown as CompositionManifest;
}

export interface ManifestOverrides {
  transition?: TransitionType;
  talking_head_layout?: 'full' | 'sidebar' | 'pip_bottom_right';
  image_text_density?: 'none' | 'low' | 'medium' | 'high';
  motion?: 'ken_burns' | 'static';
}

export function applyOverrides(
  manifest: CompositionManifest,
  overrides: ManifestOverrides,
): CompositionManifest {
  const patched = { ...manifest };

  if (overrides.transition) {
    patched.transitions = patched.transitions.map((t) => ({
      ...t,
      type: overrides.transition!,
    }));
  }

  if (overrides.talking_head_layout || overrides.image_text_density || overrides.motion) {
    patched.scenes = patched.scenes.map((s) => ({
      ...s,
      ...(overrides.talking_head_layout ? { talking_head_layout: overrides.talking_head_layout } : {}),
      ...(overrides.image_text_density ? { image_text_density: overrides.image_text_density } : {}),
      ...(overrides.motion ? { motion: overrides.motion } : {}),
    }));
  }

  return patched;
}

export interface TestRenderOptions {
  runId: string;
  clientId?: string;
  platform?: string;
  manifest?: CompositionManifest;
  overrides?: ManifestOverrides;
  cachedManifest?: CompositionManifest;
}

export async function runTestRender(options: TestRenderOptions): Promise<{ outputPath: string; durationMs: number }> {
  const { runId, clientId, platform = 'tiktok', overrides } = options;

  const { clips, hasVoiceover } = scanRunDirectory(runId);

  if (clips.length === 0) {
    throw new Error(`No clip files found in run directory for run_id: ${runId}`);
  }

  if (!hasVoiceover) {
    throw new Error(`No voiceover.mp3 found in run directory for run_id: ${runId}`);
  }

  // Resolve manifest: explicit > cached > stub
  let manifest: CompositionManifest;
  if (options.manifest) {
    manifest = options.manifest;
  } else if (options.cachedManifest) {
    manifest = options.cachedManifest;
  } else {
    manifest = buildStubManifest(clips, platform, runId, clientId ?? 'test');
  }

  if (overrides) {
    manifest = applyOverrides(manifest, overrides);
  }

  const outputPath = join(DATA_SHARED, runId, 'test_render.mp4');
  const publicDir = join(DATA_SHARED, runId);

  const start = Date.now();
  await renderComposition({
    manifest,
    outputPath,
    publicDir,
    brandProfile: TEST_BRAND_PROFILE,
  });
  const durationMs = Date.now() - start;

  return { outputPath, durationMs };
}
