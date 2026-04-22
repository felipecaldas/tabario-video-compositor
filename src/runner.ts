import { join, basename } from 'path';
import { hydrateBrandProfile } from './brand/hydrator';
import { generateManifest } from './manifest/generator';
import { renderComposition } from './renderer/renderWorker';
import { applyPostProcessing } from './postprocess/ffmpeg';
import { ComposeJob, HandoffPayload, Brief, BriefScene, PlatformBriefModel, SceneBriefInput, VisualDirection } from './types';

const DATA_SHARED_BASE = process.env.DATA_SHARED_BASE ?? '/data/shared';

type JobUpdate = Partial<Pick<ComposeJob, 'status' | 'manifest' | 'final_video_path' | 'error'>>;

/** Resolution map: target_resolution string → (width, height) for 9:16 base. */
const RESOLUTION_MAP: Record<string, { width: number; height: number }> = {
  '480p': { width: 270, height: 480 },
  '720p': { width: 405, height: 720 },
  '1080p': { width: 608, height: 1080 },
};

/** Canonical (width, height) derived from video_format + target_resolution. */
function resolveCanonicalDimensions(
  videoFormat: string,
  targetResolution: string,
): { width: number; height: number } {
  const base = RESOLUTION_MAP[targetResolution] ?? RESOLUTION_MAP['720p'];
  if (videoFormat === '16:9') {
    return { width: base.height, height: base.width };
  }
  if (videoFormat === '1:1') {
    const side = Math.round((base.width + base.height) / 2);
    return { width: side, height: side };
  }
  return { width: base.width, height: base.height };
}

/**
 * Flatten the active PlatformBriefModel out of the top-level Brief so the
 * manifest generator sees a simple brief with top-level `scenes` array.
 *
 * The edit-videos Brief carries nested `platform_briefs`.  The compositor's
 * prompt expects `brief.scenes` at the top level.  We merge the active
 * platform brief's fields into a flat object.
 */
function flattenActivePlatformBrief(brief: Brief, platform: string): Brief {
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
    description: s.visual_description ?? s.spoken_line ?? '',
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

    let manifest = await generateManifest({
      run_id: payload.run_id,
      client_id: payload.client_id,
      platform: payload.platform,
      brief: flatBrief,
      brand_profile: brandProfile,
      clip_filenames: clipFilenames,
      voiceover_filename: voiceoverFilename,
    });

    // ── Step 4: Enforce video_format + target_resolution overrides ──────────
    const { width, height } = resolveCanonicalDimensions(
      payload.video_format,
      payload.target_resolution ?? '720p',
    );
    console.log(
      `[runner] Overriding manifest dimensions: ${manifest.width}x${manifest.height} → ${width}x${height} ` +
      `(format=${payload.video_format}, resolution=${payload.target_resolution ?? '720p'})`,
    );
    manifest = { ...manifest, width, height };

    onUpdate({ status: 'rendering', manifest });

    // ── Step 5: Remotion render ────────────────────────────────────────────
    console.log(`[runner] Starting Remotion render for run_id=${payload.run_id}`);
    await renderComposition({
      manifest,
      outputPath: composedRaw,
      brandProfile,
      onProgress: (pct) => console.log(`[runner] Render ${pct}%`),
    });

    // ── Step 6: FFmpeg post-pass ───────────────────────────────────────────
    onUpdate({ status: 'post_processing' });
    console.log(`[runner] Running FFmpeg post-processing for run_id=${payload.run_id}`);
    await applyPostProcessing({
      inputPath: composedRaw,
      outputPath: composedFinal,
      audioTargets: brandProfile.audio_targets,
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
