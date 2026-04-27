import { readdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { CompositionManifest, BrandProfile, TransitionType, Brief } from '../types';
import { CompositionManifestSchema } from '../manifest/schema';
import { renderComposition } from '../renderer/renderWorker';
import { ensureH264 } from '../postprocess/ffmpeg';
import { hydrateBrandProfile } from '../brand/hydrator';
import { generateManifest } from '../manifest/generator';

const DATA_SHARED_BASE = process.env.DATA_SHARED_BASE ?? '/data/shared';

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

export function scanRunDirectory(runId: string, basePath?: string): { clips: ClipMeta[]; hasVoiceover: boolean } {
  const dir = join(basePath ?? DATA_SHARED_BASE, runId);
  if (!existsSync(dir)) {
    throw new Error(`run_id directory not found: ${dir}`);
  }

  const files = readdirSync(dir);
  const clips: ClipMeta[] = files
    .filter((f) =>
      /^(\d{3})_ComfyUI_\d+_\.mp4$/i.test(f) ||
      /^(video|image|talking_head)_\d+\.(mp4|webm|png|jpg|jpeg|webp)$/i.test(f)
    )
    .map((filename) => {
      const comfMatch = filename.match(/^(\d{3})_ComfyUI_\d+_\.mp4$/i);
      const numMatch = filename.match(/_(\d+)\./);
      return {
        filename,
        index: comfMatch ? parseInt(comfMatch[1], 10) : numMatch ? parseInt(numMatch[1], 10) : 0,
      };
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
  fps: number = 24,
): CompositionManifest {
  const isVertical = platform === 'tiktok' || platform === 'instagram' || platform === 'yt_shorts';
  const is11 = platform === 'x_square';
  const width = is11 ? 1080 : isVertical ? 1080 : 1920;
  const height = is11 ? 1080 : isVertical ? 1920 : 1080;
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
  basePath?: string;
  targetFps?: number;
}

export async function runTestRender(options: TestRenderOptions): Promise<{ outputPath: string; durationMs: number }> {
  const { runId, clientId, platform = 'tiktok', overrides, basePath, targetFps = 24 } = options;

  const runDir = join(basePath ?? DATA_SHARED_BASE, runId);
  const { clips, hasVoiceover } = scanRunDirectory(runId, basePath);

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
    manifest = buildStubManifest(clips, platform, runId, clientId ?? 'test', targetFps);
  }

  if (overrides) {
    manifest = applyOverrides(manifest, overrides);
  }

  const outputPath = join(runDir, 'test_render.mp4');

  const start = Date.now();
  await renderComposition({
    manifest,
    outputPath,
    publicDir: runDir,
    brandProfile: TEST_BRAND_PROFILE,
  });
  const durationMs = Date.now() - start;

  return { outputPath, durationMs };
}

export type ManifestMode = 'stub' | 'llm';

interface RunDirManifestData {
  brief: Brief;
  client_id: string;
  platform: string;
}

function loadRunDirManifest(runDir: string): RunDirManifestData {
  const manifestPath = join(runDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`manifest.json not found in run directory: ${runDir}`);
  }
  const raw = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  return {
    brief: raw.brief as Brief,
    client_id: raw.client_id as string,
    platform: raw.platform as string,
  };
}

async function normalizeClips(
  clips: ClipMeta[],
  runDir: string,
  targetFps: number,
): Promise<Record<string, string>> {
  const normalized: Record<string, string> = {};
  await Promise.all(
    clips.map(async (clip) => {
      const inputPath = join(runDir, clip.filename);
      const normalizedPath = await ensureH264(inputPath, targetFps);
      normalized[clip.filename] = normalizedPath;
    }),
  );
  return normalized;
}

function buildManifestWithNormalizedClips(
  manifest: CompositionManifest,
  normalizedPaths: Record<string, string>,
): CompositionManifest {
  return {
    ...manifest,
    scenes: manifest.scenes.map((scene) => ({
      ...scene,
      clip_filename: scene.clip_filename
        ? normalizedPaths[scene.clip_filename] ?? scene.clip_filename
        : undefined,
    })),
  };
}

export interface RunTestRenderOptions {
  runId: string;
  basePath?: string;
  platform?: string;
  manifestMode: ManifestMode;
  manifest?: CompositionManifest;
  brandProfile?: BrandProfile;
  targetFps?: number;
}

export async function runTestRenderFromRun(
  options: RunTestRenderOptions,
): Promise<{ outputPath: string; durationMs: number }> {
  const {
    runId,
    basePath,
    platform = 'tiktok',
    manifestMode,
    manifest: providedManifest,
    brandProfile: providedBrandProfile,
    targetFps = 24,
  } = options;

  const runDir = join(basePath ?? DATA_SHARED_BASE, runId);
  const { clips, hasVoiceover } = scanRunDirectory(runId, basePath);

  if (clips.length === 0) {
    throw new Error(`No clip files found in run directory for run_id: ${runId}`);
  }
  if (!hasVoiceover) {
    throw new Error(`No voiceover.mp3 found in run directory for run_id: ${runId}`);
  }

  // Normalize clips to target FPS + H.264
  console.log(`[testRender] Normalizing ${clips.length} clips to ${targetFps}fps in ${runDir}`);
  const normalizedPaths = await normalizeClips(clips, runDir, targetFps);

  // Resolve manifest based on mode
  let manifest: CompositionManifest;
  let effectiveBrandProfile = providedBrandProfile ?? TEST_BRAND_PROFILE;

  if (providedManifest) {
    manifest = providedManifest;
  } else if (manifestMode === 'llm') {
    const { brief, client_id } = loadRunDirManifest(runDir);
    effectiveBrandProfile = providedBrandProfile ?? await hydrateBrandProfile(client_id, '');
    const clipFilenames = clips.map((c) => c.filename);
    const voiceoverFilename = 'voiceover.mp3';
    manifest = await generateManifest({
      run_id: runId,
      client_id,
      platform,
      brief,
      brand_profile: effectiveBrandProfile,
      clip_filenames: clipFilenames,
      voiceover_filename: voiceoverFilename,
    });
  } else {
    manifest = buildStubManifest(clips, platform, runId, providedBrandProfile?.client_id ?? 'test', targetFps);
  }

  // Patch manifest to use normalized clip filenames
  manifest = buildManifestWithNormalizedClips(manifest, normalizedPaths);

  // Override FPS to target (LLM may have set something different)
  manifest = { ...manifest, fps: targetFps };

  const outputPath = join(runDir, 'test_render.mp4');
  const start = Date.now();
  await renderComposition({
    manifest,
    outputPath,
    publicDir: runDir,
    brandProfile: effectiveBrandProfile,
  });
  const durationMs = Date.now() - start;

  console.log(`[testRender] Render complete: ${outputPath} (${durationMs}ms)`);
  return { outputPath, durationMs };
}
