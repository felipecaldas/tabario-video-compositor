import { join, basename } from 'path';
import { hydrateBrandProfile } from './brand/hydrator';
import { generateManifest } from './manifest/generator';
import { renderComposition } from './renderer/renderWorker';
import { applyPostProcessing, ensureH264, probeFps } from './postprocess/ffmpeg';
import { transcribe } from './asr/transcribe';
import { ComposeJob, HandoffPayload, Brief, BriefScene, ManifestScene, PlatformBriefModel, SceneBriefInput, VisualDirection } from './types';

const DATA_SHARED_BASE = process.env.DATA_SHARED_BASE ?? '/data/shared';

type JobUpdate = Partial<Pick<ComposeJob, 'status' | 'manifest' | 'final_video_path' | 'error'>>;

/**
 * Resolution map: legacy short keys → (width, height) for 9:16 portrait.
 * For 16:9 the values are swapped; for 1:1 the short side is used for both.
 */
const RESOLUTION_MAP: Record<string, { width: number; height: number }> = {
  '480p': { width: 480, height: 854 },
  '720p': { width: 720, height: 1280 },
  '1080p': { width: 1080, height: 1920 },
};

const WXH_PATTERN = /^(\d{2,5})x(\d{2,5})$/i;

function validFps(value: unknown): number | null {
  const fps = typeof value === 'string' ? Number(value) : value;
  return typeof fps === 'number' && Number.isFinite(fps) && fps > 0 ? Math.round(fps) : null;
}

export async function resolveTargetFps(payload: HandoffPayload): Promise<number> {
  const requested = validFps(payload.target_fps);
  if (requested) return requested;

  const envFps = validFps(process.env.VIDEO_COMPOSITOR_TARGET_FPS);
  if (envFps) return envFps;

  for (const clipPath of payload.clip_paths) {
    const probed = await probeFps(clipPath);
    if (probed) return probed;
  }

  return 30;
}

function scaleFrames(value: number, fromFps: number, toFps: number): number {
  return Math.max(1, Math.round((value * toFps) / fromFps));
}

export function enforceManifestFps(
  manifest: Awaited<ReturnType<typeof generateManifest>>,
  targetFps: number,
): Awaited<ReturnType<typeof generateManifest>> {
  if (manifest.fps === targetFps) {
    return { ...manifest, fps: targetFps };
  }

  const sourceFps = manifest.fps;
  return {
    ...manifest,
    fps: targetFps,
    duration_frames: scaleFrames(manifest.duration_frames, sourceFps, targetFps),
    scenes: manifest.scenes.map((scene) => ({
      ...scene,
      duration_frames: scaleFrames(scene.duration_frames, sourceFps, targetFps),
    })),
    transitions: manifest.transitions.map((transition) => ({
      ...transition,
      duration_frames: scaleFrames(transition.duration_frames, sourceFps, targetFps),
    })),
    overlays: manifest.overlays.map((overlay) => ({
      ...overlay,
      start_frame: Math.max(0, Math.round((overlay.start_frame * targetFps) / sourceFps)),
      duration_frames: scaleFrames(overlay.duration_frames, sourceFps, targetFps),
    })),
    closing: {
      ...manifest.closing,
      start_frame: Math.max(0, Math.round((manifest.closing.start_frame * targetFps) / sourceFps)),
      duration_frames: scaleFrames(manifest.closing.duration_frames, sourceFps, targetFps),
    },
  };
}

/**
 * Derive canonical (width, height) from video_format + target_resolution.
 * Accepts both legacy short keys (`480p`/`720p`/`1080p`) and explicit
 * `WxH` strings (e.g. `1080x1920`, `720x1280`).  When the input is WxH
 * the `video_format` override is ignored because the caller has already
 * expressed both dimensions.  Unknown inputs fall back to 720p portrait
 * with a console warning so the silent-fallback bug cannot recur.
 */
export function resolveCanonicalDimensions(
  videoFormat: string,
  targetResolution: string,
): { width: number; height: number } {
  const wxh = WXH_PATTERN.exec(targetResolution ?? '');
  if (wxh) {
    return { width: parseInt(wxh[1], 10), height: parseInt(wxh[2], 10) };
  }

  const base = RESOLUTION_MAP[targetResolution];
  if (!base) {
    console.warn(
      `[runner] Unknown target_resolution="${targetResolution}"; defaulting to 720p portrait (720x1280)`,
    );
  }
  const resolved = base ?? RESOLUTION_MAP['720p'];

  if (videoFormat === '16:9') {
    return { width: resolved.height, height: resolved.width };
  }
  if (videoFormat === '1:1') {
    return { width: resolved.width, height: resolved.width };
  }
  return { width: resolved.width, height: resolved.height };
}

/**
 * Flatten the active PlatformBriefModel out of the top-level Brief so the
 * manifest generator sees a simple brief with top-level `scenes` array.
 *
 * The edit-videos Brief carries nested `platform_briefs`.  The compositor's
 * prompt expects `brief.scenes` at the top level.  We merge the active
 * platform brief's fields into a flat object.
 */
export function flattenActivePlatformBrief(brief: Brief, platform: string): Brief {
  const rawPlatformBriefs = (brief as Record<string, unknown>).platform_briefs as
    | PlatformBriefModel[]
    | undefined;

  if (!rawPlatformBriefs || rawPlatformBriefs.length === 0) {
    return brief;
  }

  const active = rawPlatformBriefs.find(
    (pb) => pb.platform.toLowerCase() === platform.toLowerCase(),
  );

  if (!active) {
    console.warn(`[runner] No platform brief found for platform=${platform}; using top-level brief as-is`);
    return brief;
  }

  const flatScenes: BriefScene[] = (active.scenes ?? []).map((s: SceneBriefInput, idx: number) => ({
    index: idx,
    // Prefer visual_description; fall back to spoken_line when the
    // visual description is missing OR empty (|| rather than ?? so empty
    // strings fall through to the spoken line).
    description: (s.visual_description || s.spoken_line) ?? '',
    duration_seconds: s.duration_seconds,
    visual_direction: s.visual_description,
  }));

  // Forward the top-level visual_direction so the LLM sees mood, color_feel,
  // shot_style, and branding_elements when generating the manifest.
  const rawVisualDirection = (brief as Record<string, unknown>).visual_direction as
    | VisualDirection
    | undefined;

  return {
    hook: active.hook ?? brief.hook,
    narrative_structure: brief.narrative_structure,
    title: brief.title,
    tone: active.tone,
    call_to_action: active.call_to_action,
    platform_notes: active.platform_notes,
    aspect_ratio: active.aspect_ratio,
    visual_direction: rawVisualDirection,
    scenes: flatScenes,
  };
}

/**
 * Orchestrate the full composition pipeline for a single job.
 * Updates are surfaced via the onUpdate callback so the in-memory job store stays current.
 *
 * The compositor's responsibility ends at writing `composed.mp4` to `/data/shared/{run_id}/`.
 * Supabase upload and the N8N completion webhook are handled by `edit-videos` after polling
 * `GET /compose/:id` and finding `status=done`.
 */
export async function runComposeJob(
  job: ComposeJob,
  payload: HandoffPayload,
  onUpdate: (update: JobUpdate) => void,
): Promise<void> {
  const runDir = join(DATA_SHARED_BASE, payload.run_id);
  const composedRaw = join(runDir, 'composed_raw.mp4');
  const composedFinal = join(runDir, 'composed.mp4');

  try {
    // ── Step 1: Hydrate brand profile (anon key + user JWT for RLS) ─────────
    onUpdate({ status: 'hydrating' });
    console.log(`[runner] Hydrating brand profile for client_id=${payload.client_id} run_id=${payload.run_id}`);
    const brandProfile = await hydrateBrandProfile(payload.client_id, payload.user_access_token);
    console.log(`[runner] Brand profile hydrated for client_id=${payload.client_id}`);

    // ── Step 2: Flatten active platform brief ──────────────────────────────
    console.log(`[runner] Flattening brief for platform=${payload.platform}`);
    const flatBrief = flattenActivePlatformBrief(payload.brief as Brief, payload.platform);

    // ── Step 3: Generate Composition Manifest ──────────────────────────────
    onUpdate({ status: 'generating_manifest' });
    console.log(`[runner] Generating manifest for run_id=${payload.run_id}`);
    const clipFilenames = payload.clip_paths.map((p) => basename(p));
    const voiceoverFilename = basename(payload.voiceover_path);
    const targetFps = await resolveTargetFps(payload);
    console.log(`[runner] Using target FPS ${targetFps} for run_id=${payload.run_id}`);

    let manifest = await generateManifest({
      run_id: payload.run_id,
      client_id: payload.client_id,
      platform: payload.platform,
      brief: flatBrief,
      brand_profile: brandProfile,
      clip_filenames: clipFilenames,
      voiceover_filename: voiceoverFilename,
      target_fps: targetFps,
    });
    manifest = enforceManifestFps(manifest, targetFps);

    // ── Step 4: Enforce video_format + target_resolution overrides ──────────
    const { width, height } = resolveCanonicalDimensions(
      payload.video_format,
      payload.target_resolution ?? '720p',
    );
    console.log(
      `[runner] Overriding manifest dimensions: ${manifest.width}x${manifest.height} → ${width}x${height} ` +
      `(format=${payload.video_format}, resolution=${payload.target_resolution ?? '720p'})`,
    );
    manifest = { ...manifest, fps: targetFps, width, height };

    // ── Step 4.25: Generate word-level captions when transcription is available
    try {
      console.log(`[runner] Transcribing voiceover for run_id=${payload.run_id} (target FPS: ${manifest.fps})`);
      const captionTrack = await transcribe(payload.voiceover_path, { fps: manifest.fps });
      manifest = { ...manifest, caption_track: captionTrack };
    } catch (err) {
      console.warn(
        `[runner] Voiceover transcription failed for run_id=${payload.run_id}; continuing without captions: ${(err as Error).message}`,
      );
    }

    // ── Step 4.5: Transcode clips to H.264 for browser compatibility ────────
    // ComfyUI WAN models produce H.265/HEVC which Chrome (Remotion) cannot play.
    onUpdate({ status: 'transcoding' });
    console.log(`[runner] Ensuring clips are H.264-compatible for run_id=${payload.run_id} (target FPS: ${manifest.fps})`);
    const h264ClipPaths: string[] = await Promise.all(
      payload.clip_paths.map((p) => ensureH264(p, manifest.fps)),
    );

    // Build filename → h264 filename map so scenes referencing the same
    // original clip are patched regardless of scene ordering, and typographic
    // scenes (no clip_filename) are preserved as-is.
    const origToH264: Record<string, string> = {};
    payload.clip_paths.forEach((orig, i) => {
      origToH264[basename(orig)] = basename(h264ClipPaths[i]);
    });

    manifest = {
      ...manifest,
      scenes: manifest.scenes.map((scene: ManifestScene) => ({
        ...scene,
        clip_filename: scene.clip_filename
          ? (origToH264[scene.clip_filename] ?? scene.clip_filename)
          : undefined,
      })),
    };

    onUpdate({ status: 'rendering', manifest });

    // ── Step 5: Remotion render ────────────────────────────────────────────
    // `publicDir=runDir` exposes the per-run clip directory to the Remotion
    // bundle so `<Video src={staticFile(filename)}>` resolves correctly.
    console.log(`[runner] Starting Remotion render for run_id=${payload.run_id}`);
    await renderComposition({
      manifest,
      outputPath: composedRaw,
      brandProfile,
      publicDir: runDir,
      onProgress: (pct) => console.log(`[runner] Render ${pct}%`),
    });

    // ── Step 6: FFmpeg post-pass ───────────────────────────────────────────
    onUpdate({ status: 'post_processing' });
    console.log(`[runner] Running FFmpeg post-processing for run_id=${payload.run_id}`);
    await applyPostProcessing({
      inputPath: composedRaw,
      outputPath: composedFinal,
      audioTargets: brandProfile.audio_targets,
      targetFps,
    });

    // ── Step 7: Report done — edit-videos polls and handles upload + webhook ─
    onUpdate({ status: 'done', final_video_path: composedFinal });
    console.log(`[runner] Job ${job.id} complete. final_video_path=${composedFinal}`);
  } catch (err) {
    const message = (err as Error).message;
    console.error(`[runner] Job ${job.id} failed: ${message}`);
    onUpdate({ status: 'failed', error: message });
    throw err;
  }
}
