import { readdirSync, existsSync, readFileSync, statSync, unlinkSync } from 'fs';
import { basename, join } from 'path';
import {
  CompositionManifest, BrandProfile, TransitionType, Brief,
  LayoutType, TalkingHeadLayout,
} from '../types';
import { transcribe } from '../asr/transcribe';
import { CompositionManifestSchema } from '../manifest/schema';
import { renderComposition } from '../renderer/renderWorker';
import { ensureH264, probeDurationSeconds, probeFps } from '../postprocess/ffmpeg';
import { hydrateBrandProfile, BrandProfileNotFoundError } from '../brand/hydrator';
import { generateManifest } from '../manifest/generator';
import { TemplateRegistry } from '../templates/registry';
import { StyleRegistry, DEFAULT_STYLE_ID } from '../styles/registry';
import { SceneSlot, SceneRole, DefaultTransition } from '../templates/schema';
import { buildTimelineManifest } from '../timeline';
import { renderGraphicsPlates } from '../renderer/graphicsPlates';
import { renderHybridFfmpeg } from '../renderer/ffmpegHybrid';
import { resolveRendererSelector } from '../runner';
import { generateSlotFilledManifest } from '../manifest/slotFiller';

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

function summarizeClipNames(clips: ClipMeta[]): string {
  return clips.length > 0 ? clips.map((clip) => clip.filename).join(', ') : '(none)';
}

function summarizeManifest(manifest: CompositionManifest): string {
  return [
    `run_id=${manifest.run_id}`,
    `schema=${manifest.schema}`,
    `scenes=${manifest.scenes?.length ?? 0}`,
    `transitions=${manifest.transitions?.length ?? 0}`,
    `overlays=${manifest.overlays?.length ?? 0}`,
    `duration=${manifest.duration_frames}`,
    `fps=${manifest.fps}`,
    `size=${manifest.width}x${manifest.height}`,
  ].join(', ');
}

export interface ClipMeta {
  filename: string;
  index: number;
}

export function scanRunDirectory(
  runId: string,
  basePath?: string,
): { clips: ClipMeta[]; hasVoiceover: boolean; voiceoverFilename?: string } {
  const dir = join(basePath ?? DATA_SHARED_BASE, runId);
  if (!existsSync(dir)) {
    throw new Error(`run_id directory not found: ${dir}`);
  }

  const files = readdirSync(dir);
  const clips: ClipMeta[] = files
    .filter((f) =>
      /^(\d{3})_ComfyUI_\d+_\.mp4$/i.test(f) ||
      /^(video|talking_head)_\d+\.(mp4|webm)$/i.test(f)
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

  const voiceoverFilename = files.find((f) => f === 'voiceover.mp3' || f === 'voiceover.wav');
  const hasVoiceover = Boolean(voiceoverFilename);

  return { clips, hasVoiceover, voiceoverFilename };
}

export type AspectRatio = '9:16' | '16:9' | '1:1';

export function buildStubManifest(
  clips: ClipMeta[],
  platform: string,
  runId: string,
  clientId: string,
  fps: number = 24,
  aspectRatio?: AspectRatio,
  voiceoverFilename: string = 'voiceover.mp3',
): CompositionManifest {
  let width: number;
  let height: number;

  if (aspectRatio === '9:16') {
    width = 1080; height = 1920;
  } else if (aspectRatio === '16:9') {
    width = 1920; height = 1080;
  } else if (aspectRatio === '1:1') {
    width = 1080; height = 1080;
  } else {
    const isVertical = platform === 'tiktok' || platform === 'instagram' || platform === 'yt_shorts';
    const is11 = platform === 'x_square';
    width = is11 ? 1080 : isVertical ? 1080 : 1920;
    height = is11 ? 1080 : isVertical ? 1920 : 1080;
  }

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
      voiceover_filename: voiceoverFilename,
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

function mapRequiredLayout(required: SceneSlot['required_layout']): LayoutType {
  return required === 'split' ? 'split_horizontal' : 'fullscreen';
}

function mapTalkingHeadLayout(required: SceneSlot['required_layout']): TalkingHeadLayout | undefined {
  if (required === 'talking_head_full') return 'full';
  if (required === 'talking_head_pip') return 'pip_bottom_right';
  return undefined;
}

function allocateClipsToSlots(
  slots: SceneSlot[],
  clipCount: number,
): Array<{ slot: SceneSlot; count: number }> {
  const oneCount = slots.filter((s) => s.cardinality === 'one').length;
  const manyCount = slots.filter((s) => s.cardinality === 'one_to_many').length;
  const extra = Math.max(0, clipCount - oneCount - manyCount);
  const baseExtra = manyCount > 0 ? Math.floor(extra / manyCount) : 0;
  const remainder = manyCount > 0 ? extra % manyCount : 0;

  let manyIdx = 0;
  return slots.map((slot) => {
    if (slot.cardinality === 'one') return { slot, count: 1 };
    const bonus = manyIdx < remainder ? 1 : 0;
    manyIdx++;
    return { slot, count: 1 + baseExtra + bonus };
  });
}

export function buildTemplateManifest(
  templateId: string,
  clips: ClipMeta[],
  platform: string,
  runId: string,
  clientId: string,
  fps: number = 24,
  aspectRatio?: AspectRatio,
  voiceoverFilename: string = 'voiceover.mp3',
): CompositionManifest {
  const template = TemplateRegistry.resolve(templateId);

  let width: number;
  let height: number;
  if (aspectRatio === '9:16') { width = 1080; height = 1920; }
  else if (aspectRatio === '16:9') { width = 1920; height = 1080; }
  else if (aspectRatio === '1:1') { width = 1080; height = 1080; }
  else {
    const isVertical = platform === 'tiktok' || platform === 'instagram' || platform === 'yt_shorts';
    const is11 = platform === 'x_square';
    width = is11 ? 1080 : isVertical ? 1080 : 1920;
    height = is11 ? 1080 : isVertical ? 1920 : 1080;
  }

  const allocations = allocateClipsToSlots(template.scene_blueprint, clips.length);

  const scenes: CompositionManifest['scenes'] = [];
  const overlays: CompositionManifest['overlays'] = [];
  // Track the role for each scene index so transitions can be looked up.
  const sceneRoles: SceneRole[] = [];
  let sceneIdx = 0;
  let clipCursor = 0;
  let accFrame = 0;

  for (const { slot, count } of allocations) {
    const [minS, maxS] = slot.duration_target_s;
    const durationFrames = Math.round(((minS + maxS) / 2) * fps);
    const grade = template.default_grade_per_role?.[slot.role];

    for (let i = 0; i < count; i++) {
      const clip = clips[clipCursor % clips.length];
      clipCursor++;

      const talkingHeadLayout = mapTalkingHeadLayout(slot.required_layout);

      const scene: CompositionManifest['scenes'][number] = {
        index: sceneIdx,
        clip_filename: clip.filename,
        duration_frames: durationFrames,
        layout: mapRequiredLayout(slot.required_layout),
        ...(talkingHeadLayout ? { talking_head_layout: talkingHeadLayout } : {}),
        ...(grade ? { grade } : {}),
      };

      // Overlays are omitted in stub/template mode — no real copy exists yet.
      // The overlay animation components require actual text; placeholder strings
      // like "[hook_headline]" render on screen and look broken.

      scenes.push(scene);
      sceneRoles.push(slot.role);
      accFrame += durationFrames;
      sceneIdx++;
    }
  }

  // Build transitions: use default_transitions from template when available,
  // falling back to soft_cut for any boundary not explicitly prescribed.
  const defaultTransitions: DefaultTransition[] = template.default_transitions ?? [];

  function resolveTransition(fromRole: SceneRole, toRole: SceneRole): {
    type: TransitionType; direction?: string; accent_color?: string;
  } {
    const match = defaultTransitions.find(
      (t) => t.from_role === fromRole && t.to_role === toRole,
    );
    if (match) {
      return {
        type: match.type as TransitionType,
        ...(match.direction ? { direction: match.direction } : {}),
        ...(match.accent_color ? { accent_color: match.accent_color } : {}),
      };
    }
    return { type: 'soft_cut' as TransitionType };
  }

  const transitions = scenes.slice(0, -1).map((_, i) => {
    const { type, direction, accent_color } = resolveTransition(sceneRoles[i], sceneRoles[i + 1]);
    return {
      between: [i, i + 1] as [number, number],
      type,
      duration_frames: 15,
      ...(direction ? { direction: direction as 'left' | 'right' | 'up' | 'down' } : {}),
      ...(accent_color ? { accent_color } : {}),
    };
  });

  const closingDuration = template.closing ? fps * 3 : 0;

  const raw = {
    schema: 'compose.v2' as const,
    style_id: 'corporate_clean',
    use_case: template.id,
    client_id: clientId,
    run_id: runId,
    platform,
    fps,
    width,
    height,
    duration_frames: accFrame + closingDuration,
    scenes,
    transitions,
    overlays,
    audio_track: {
      voiceover_filename: voiceoverFilename,
      lufs_target: -16,
      music_ducking_db: -12,
    },
    ...(template.closing
      ? {
        closing: {
          component: 'end_card' as const,
          cta: {
            text: template.closing.cta_role.replace(/_/g, ' '),
            url: 'https://tabario.com',
            show_qr: false,
          },
          show_logo: true,
          start_frame: accFrame,
          duration_frames: closingDuration,
        },
      }
      : {}),
  };

  const result = CompositionManifestSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`buildTemplateManifest produced invalid manifest: ${result.error.message}`);
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

async function resolveTestTargetFps(
  clips: ClipMeta[],
  runDir: string,
  requested?: number,
): Promise<number> {
  if (requested !== undefined) return requested;

  const envFps = Number(process.env.VIDEO_COMPOSITOR_TARGET_FPS);
  if (Number.isFinite(envFps) && envFps > 0) return Math.round(envFps);

  for (const clip of clips) {
    if (isImageFile(clip.filename)) continue;
    const probed = await probeFps(join(runDir, clip.filename));
    if (probed) return probed;
  }

  return 30;
}

export async function runTestRender(options: TestRenderOptions): Promise<{ outputPath: string; durationMs: number }> {
  const { runId, clientId, platform = 'tiktok', overrides, basePath } = options;

  const runDir = join(basePath ?? DATA_SHARED_BASE, runId);
  const { clips, hasVoiceover, voiceoverFilename } = scanRunDirectory(runId, basePath);
  const targetFps = await resolveTestTargetFps(clips, runDir, options.targetFps);

  console.log(
    `[testRender] Run scan: run_id=${runId}, runDir=${runDir}, clips=${clips.length}, ` +
      `hasVoiceover=${hasVoiceover}, voiceover=${voiceoverFilename ?? '(missing)'}, ` +
      `clipFiles=[${summarizeClipNames(clips)}]`,
  );
  console.log(`[testRender] Target FPS resolved: ${targetFps}`);

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
    manifest = buildStubManifest(clips, platform, runId, clientId ?? 'test', targetFps, undefined, voiceoverFilename);
  }

  if (overrides) {
    manifest = applyOverrides(manifest, overrides);
  }

  manifest = await extendManifestToVoiceover(manifest, runDir);

  const outputPath = join(runDir, 'test_render.mp4');
  const manifestSource = options.manifest ? 'provided' : options.cachedManifest ? 'cached' : 'stub';
  console.log(
    `[testRender] Manifest source=${manifestSource}, platform=${platform}, client_id=${clientId ?? 'test'}, ` +
      `overrides=${Boolean(overrides)}`,
  );
  console.log(`[testRender] Final manifest summary: ${summarizeManifest(manifest)}, outputPath=${outputPath}`);

  cleanupStaleRenderArtifacts(runDir, outputPath);
  const start = Date.now();
  await renderWithSelectedRenderer({
    manifest,
    outputPath,
    publicDir: runDir,
    brandProfile: TEST_BRAND_PROFILE,
  });
  const durationMs = Date.now() - start;

  return { outputPath, durationMs };
}

export type ManifestMode = 'stub' | 'llm' | 'template';

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

function isImageFile(filename: string): boolean {
  return /\.(png|jpg|jpeg|webp|gif|avif)$/i.test(filename);
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
      if (isImageFile(clip.filename)) {
        normalized[clip.filename] = inputPath;
        return;
      }
      const normalizedPath = await ensureH264(inputPath, targetFps);
      normalized[clip.filename] = normalizedPath;
    }),
  );
  return normalized;
}

function manifestClipFilename(
  originalFilename: string,
  normalizedPaths: Record<string, string>,
): string {
  const normalized = normalizedPaths[originalFilename];
  if (!normalized) return originalFilename;
  const normalizedBasename = normalized.split('/').pop() ?? normalized.split('\\').pop() ?? normalized;
  return normalizedBasename;
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
        ? manifestClipFilename(scene.clip_filename, normalizedPaths)
        : undefined,
    })),
  };
}

async function extendManifestToVoiceover(
  manifest: CompositionManifest,
  runDir: string,
): Promise<CompositionManifest> {
  const voiceoverFilename = manifest.audio_track.voiceover_filename;
  if (!voiceoverFilename) {
    return manifest;
  }

  const voiceoverDurationSeconds = await probeDurationSeconds(join(runDir, voiceoverFilename));
  if (!voiceoverDurationSeconds) {
    return manifest;
  }

  const requiredDurationFrames = Math.ceil(voiceoverDurationSeconds * manifest.fps);
  if (requiredDurationFrames <= manifest.duration_frames) {
    return manifest;
  }

  const extensionFrames = requiredDurationFrames - manifest.duration_frames;
  console.log(
    `[testRender] Extending manifest to cover voiceover: ` +
      `voiceover=${voiceoverFilename}, voiceoverFrames=${requiredDurationFrames}, ` +
      `manifestFrames=${manifest.duration_frames}, extensionFrames=${extensionFrames}`,
  );

  return manifest.closing
    ? {
      ...manifest,
      duration_frames: requiredDurationFrames,
      closing: {
        ...manifest.closing,
        duration_frames: manifest.closing.duration_frames + extensionFrames,
      },
    }
    : {
      ...manifest,
      duration_frames: requiredDurationFrames,
    };
}

async function renderWithSelectedRenderer(options: {
  manifest: CompositionManifest;
  outputPath: string;
  publicDir: string;
  brandProfile: BrandProfile;
  onProgress?: (pct: number) => void;
}): Promise<void> {
  const renderer = resolveRendererSelector();
  console.log(`[testRender] Selected renderer: ${renderer}`);

  if (renderer === 'ffmpeg_hybrid') {
    const availableClipFilenames = options.manifest.scenes
      .map((scene) => scene.clip_filename)
      .filter((filename): filename is string => Boolean(filename));
    const timeline = buildTimelineManifest(options.manifest, {
      availableClipFilenames,
      outputFilename: basename(options.outputPath),
    });
    console.log(
      `[testRender] Hybrid timeline summary: assets=${timeline.assets.length}, ` +
        `videoClips=${timeline.tracks.video.length}, audioClips=${timeline.tracks.audio.length}, ` +
        `graphicsClips=${timeline.tracks.graphics.length}, transitions=${timeline.transitions.length}`,
    );

    const graphicsPlates = await renderGraphicsPlates({
      timeline,
      outputDir: options.publicDir,
      publicDir: options.publicDir,
      brandProfile: options.brandProfile,
      onProgress: (plate, progress) => {
        console.log(`[testRender] Graphics plate ${plate.id} ${progress}%`);
      },
    });
    console.log(`[testRender] Hybrid graphics plates: count=${graphicsPlates.length}`);

    await renderHybridFfmpeg({
      timeline,
      inputDir: options.publicDir,
      outputPath: options.outputPath,
      graphicsPlates: graphicsPlates.map((plate) => ({
        clipId: plate.clipId,
        filename: plate.filename,
      })),
    });
    return;
  }

  await renderComposition({
    manifest: options.manifest,
    outputPath: options.outputPath,
    publicDir: options.publicDir,
    brandProfile: options.brandProfile,
    onProgress: options.onProgress,
  });
}

export interface RunTestRenderOptions {
  runId: string;
  clientId?: string;
  basePath?: string;
  platform?: string;
  aspectRatio?: AspectRatio;
  manifestMode: ManifestMode;
  manifest?: CompositionManifest;
  brandProfile?: BrandProfile;
  targetFps?: number;
  /** Use a UseCaseTemplate to build the stub manifest instead of the flat layout. */
  templateType?: string;
  /** When true, transcribe the voiceover and attach a caption_track to the manifest. */
  generateCaptions?: boolean;
  /** EditStyle id — used when manifest_mode is 'template'. */
  styleId?: string;
}

export async function runTestRenderFromRun(
  options: RunTestRenderOptions,
): Promise<{ outputPath: string; durationMs: number }> {
  const {
    runId,
    clientId,
    basePath,
    platform = 'tiktok',
    aspectRatio,
    manifestMode,
    manifest: providedManifest,
    brandProfile: providedBrandProfile,
    targetFps,
    templateType,
    generateCaptions,
    styleId,
  } = options;

  const runDir = join(basePath ?? DATA_SHARED_BASE, runId);
  const { clips, hasVoiceover, voiceoverFilename } = scanRunDirectory(runId, basePath);
  const effectiveTargetFps = await resolveTestTargetFps(clips, runDir, targetFps);

  console.log(
    `[testRender] Run scan: run_id=${runId}, runDir=${runDir}, clips=${clips.length}, ` +
      `hasVoiceover=${hasVoiceover}, voiceover=${voiceoverFilename ?? '(missing)'}, ` +
      `clipFiles=[${summarizeClipNames(clips)}]`,
  );
  console.log(`[testRender] Target FPS resolved: ${effectiveTargetFps}`);

  if (clips.length === 0) {
    throw new Error(`No clip files found in run directory for run_id: ${runId}`);
  }
  if (!hasVoiceover) {
    throw new Error(`No voiceover.mp3 found in run directory for run_id: ${runId}`);
  }

  // Normalize clips to target FPS + H.264
  console.log(`[testRender] Normalizing ${clips.length} clips to ${effectiveTargetFps}fps in ${runDir}`);
  const normalizedPaths = await normalizeClips(clips, runDir, effectiveTargetFps);
  console.log(
    `[testRender] Normalized clips: ${Object.entries(normalizedPaths)
      .map(([original, normalized]) => `${original}->${basename(normalized)}`)
      .join(', ')}`,
  );

  // Resolve manifest based on mode
  let manifest: CompositionManifest;
  let effectiveBrandProfile = providedBrandProfile ?? TEST_BRAND_PROFILE;

  if (providedManifest) {
    manifest = providedManifest;
  } else if (manifestMode === 'llm') {
    const runDirData = loadRunDirManifest(runDir);
    const effectiveClientId = clientId ?? runDirData.client_id;
    if (providedBrandProfile) {
      effectiveBrandProfile = providedBrandProfile;
    } else {
      try {
        effectiveBrandProfile = await hydrateBrandProfile(effectiveClientId, '');
      } catch (err) {
        if (err instanceof BrandProfileNotFoundError) {
          console.warn(`[testRender] No brand profile found for client_id=${effectiveClientId}, falling back to TEST_BRAND_PROFILE`);
          effectiveBrandProfile = TEST_BRAND_PROFILE;
        } else {
          throw err;
        }
      }
    }
    const clipFilenames = clips.map((c) => c.filename);
    const resolvedVoiceoverFilename = voiceoverFilename ?? 'voiceover.mp3';
    manifest = await generateManifest({
      run_id: runId,
      client_id: effectiveClientId,
      platform,
      brief: runDirData.brief,
      brand_profile: effectiveBrandProfile,
      clip_filenames: clipFilenames,
      voiceover_filename: resolvedVoiceoverFilename,
      target_fps: effectiveTargetFps,
    });
  } else if (manifestMode === 'template') {
    // Slot-filling LLM mode: generate manifest by filling a UseCaseTemplate
    const effectiveTemplateType = templateType ?? 'talking_head';
    if (!TemplateRegistry.isValid(effectiveTemplateType)) {
      throw new Error(
        `Invalid template_type for slot-filling: ${effectiveTemplateType}. ` +
        `Available: ${TemplateRegistry.list().map((t) => t.id).join(', ')}`,
      );
    }
    const effectiveStyleId = styleId ?? DEFAULT_STYLE_ID;
    if (!StyleRegistry.isValid(effectiveStyleId)) {
      throw new Error(
        `Invalid style_id for slot-filling: ${effectiveStyleId}. ` +
        `Available: ${StyleRegistry.list().map((s) => s.id).join(', ')}`,
      );
    }

    const runDirData = loadRunDirManifest(runDir);
    const effectiveClientId = clientId ?? runDirData.client_id;
    if (providedBrandProfile) {
      effectiveBrandProfile = providedBrandProfile;
    } else {
      try {
        effectiveBrandProfile = await hydrateBrandProfile(effectiveClientId, '');
      } catch (err) {
        if (err instanceof BrandProfileNotFoundError) {
          console.warn(`[testRender] No brand profile found for client_id=${effectiveClientId}, falling back to TEST_BRAND_PROFILE`);
          effectiveBrandProfile = TEST_BRAND_PROFILE;
        } else {
          throw err;
        }
      }
    }

    const clipFilenames = clips.map((c) => c.filename);
    const resolvedVoiceoverFilename = voiceoverFilename ?? 'voiceover.mp3';
    console.log(
      `[testRender] Generating slot-filled manifest: template=${effectiveTemplateType}, style=${effectiveStyleId}`,
    );
    manifest = await generateSlotFilledManifest({
      run_id: runId,
      client_id: effectiveClientId,
      platform,
      brief: runDirData.brief,
      brand_profile: effectiveBrandProfile,
      clip_filenames: clipFilenames,
      voiceover_filename: resolvedVoiceoverFilename,
      target_fps: effectiveTargetFps,
      use_case: effectiveTemplateType,
      style_id: effectiveStyleId,
    });
  } else if (templateType) {
    manifest = buildTemplateManifest(
      templateType,
      clips,
      platform,
      runId,
      providedBrandProfile?.client_id ?? clientId ?? 'test',
      effectiveTargetFps,
      aspectRatio,
      voiceoverFilename,
    );
  } else {
    manifest = buildStubManifest(
      clips,
      platform,
      runId,
      providedBrandProfile?.client_id ?? 'test',
      effectiveTargetFps,
      aspectRatio,
      voiceoverFilename,
    );
  }

  // Attach word-level captions when requested
  if (generateCaptions && voiceoverFilename) {
    const voiceoverPath = join(runDir, voiceoverFilename);
    try {
      console.log(`[testRender] Transcribing voiceover for run_id=${runId} (fps=${manifest.fps})`);
      const captionTrack = await transcribe(voiceoverPath, { fps: manifest.fps });
      manifest = { ...manifest, caption_track: captionTrack };
      console.log(`[testRender] Caption track attached: ${captionTrack.words.length} words`);
    } catch (err) {
      console.warn(
        `[testRender] Voiceover transcription failed for run_id=${runId}; continuing without captions: ${(err as Error).message}`,
      );
    }
  }

  // Patch manifest to use normalized clip filenames (relative paths only for staticFile)
  manifest = buildManifestWithNormalizedClips(manifest, normalizedPaths);

  // Override FPS and dimensions to target values (LLM may have set different values)
  let width = manifest.width;
  let height = manifest.height;
  if (aspectRatio === '9:16') { width = 1080; height = 1920; }
  else if (aspectRatio === '16:9') { width = 1920; height = 1080; }
  else if (aspectRatio === '1:1') { width = 1080; height = 1080; }
  manifest = { ...manifest, fps: effectiveTargetFps, width, height };
  manifest = await extendManifestToVoiceover(manifest, runDir);

  const outputPath = join(runDir, 'test_render.mp4');
  const manifestSource = providedManifest
    ? 'provided'
    : manifestMode === 'llm'
      ? 'llm'
      : manifestMode === 'template'
        ? `template:${templateType ?? 'talking_head'}`
        : templateType
          ? `template:${templateType}`
          : 'stub';
  console.log(
    `[testRender] Manifest source=${manifestSource}, platform=${platform}, aspectRatio=${aspectRatio ?? '(auto)'}, ` +
      `client_id=${clientId ?? '(from run manifest)'}, brandProfileClientId=${effectiveBrandProfile.client_id}`,
  );
  console.log(`[testRender] Final manifest summary: ${summarizeManifest(manifest)}, outputPath=${outputPath}`);
  // Remotion's `bundle({ publicDir })` enumerates the directory and copies
  // every file into its webpack public folder. Stale render artifacts (the
  // previous final mp4, partial graphics plates, ...) break that copy with
  // ENOENT when something deletes/recreates them concurrently. Strip them
  // before bundling so only inputs remain in publicDir.
  cleanupStaleRenderArtifacts(runDir, outputPath);
  const start = Date.now();
  await renderWithSelectedRenderer({
    manifest,
    outputPath,
    publicDir: runDir,
    brandProfile: effectiveBrandProfile,
  });
  const durationMs = Date.now() - start;
  const outputBytes = existsSync(outputPath) ? statSync(outputPath).size : 0;

  console.log(`[testRender] Render complete: ${outputPath} (${durationMs}ms, ${outputBytes} bytes)`);
  return { outputPath, durationMs };
}

/**
 * Remove output artifacts produced by previous renders from the run directory.
 * The Remotion bundler treats `publicDir` as a static-asset source and copies
 * every entry; a stale `test_render.mp4` or `*-track.mov` plate that gets
 * touched during the copy raises ENOENT and aborts the render.
 */
function cleanupStaleRenderArtifacts(runDir: string, outputPath: string): void {
  const removed: string[] = [];
  const tryRemove = (filePath: string): void => {
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath);
        removed.push(basename(filePath));
      } catch (err) {
        console.warn(
          `[testRender] cleanupStaleRenderArtifacts: failed to remove ${filePath}: ` +
            `${(err as Error).message}`,
        );
      }
    }
  };
  tryRemove(outputPath);
  // Plates produced by previous test runs.
  for (const entry of readdirSync(runDir)) {
    if (entry === basename(outputPath)) continue;
    if (
      entry === 'caption-track.mov' ||
      entry.startsWith('graphics-') && entry.endsWith('.mov')
    ) {
      tryRemove(join(runDir, entry));
    }
  }
  if (removed.length > 0) {
    console.log(`[testRender] Removed stale render artifacts: ${removed.join(', ')}`);
  }
}
