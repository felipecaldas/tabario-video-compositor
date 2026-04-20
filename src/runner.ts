import { join, basename } from 'path';
import { hydrateBrandProfile } from './brand/hydrator';
import { generateManifest } from './manifest/generator';
import { renderComposition } from './renderer/renderWorker';
import { applyPostProcessing } from './postprocess/ffmpeg';
import { uploadFinalVideo } from './storage/upload';
import { sendCompletionWebhook } from './webhook/emitter';
import { ComposeJob, HandoffPayload } from './types';

const DATA_SHARED_BASE = process.env.DATA_SHARED_BASE ?? '/data/shared';

type JobUpdate = Partial<Pick<ComposeJob, 'status' | 'manifest' | 'output_url' | 'error'>>;

/**
 * Orchestrate the full composition pipeline for a single job.
 * Updates are surfaced via the onUpdate callback so the in-memory job store stays current.
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
    // ── Step 1: Hydrate brand profile ──────────────────────────────────────
    onUpdate({ status: 'hydrating' });
    console.log(`[runner] Hydrating brand profile for client_id=${payload.client_id}`);
    const brandProfile = await hydrateBrandProfile(payload.client_id);

    // ── Step 2: Generate Composition Manifest ──────────────────────────────
    onUpdate({ status: 'generating_manifest' });
    const clipFilenames = payload.clip_paths.map((p) => basename(p));
    const voiceoverFilename = basename(payload.voiceover_path);

    const manifest = await generateManifest({
      run_id: payload.run_id,
      client_id: payload.client_id,
      platform: payload.platform,
      brief: payload.brief,
      brand_profile: brandProfile,
      clip_filenames: clipFilenames,
      voiceover_filename: voiceoverFilename,
    });
    onUpdate({ status: 'rendering', manifest });

    // ── Step 3: Remotion render ────────────────────────────────────────────
    await renderComposition({
      manifest,
      outputPath: composedRaw,
      onProgress: (pct) => console.log(`[runner] Render ${pct}%`),
    });

    // ── Step 4: FFmpeg post-pass ───────────────────────────────────────────
    onUpdate({ status: 'post_processing' });
    await applyPostProcessing({
      inputPath: composedRaw,
      outputPath: composedFinal,
      audioTargets: brandProfile.audio_targets,
    });

    // ── Step 5: Upload to Supabase storage ─────────────────────────────────
    onUpdate({ status: 'uploading' });
    const videoUrl = await uploadFinalVideo(composedFinal, payload.run_id);

    // ── Step 6: Send completion webhook ────────────────────────────────────
    await sendCompletionWebhook({
      run_id: payload.run_id,
      video_idea_id: payload.video_idea_id,
      video_url: videoUrl,
      status: 'completed',
      platform: payload.platform,
      compose_job_id: job.id,
    });

    onUpdate({ status: 'done', output_url: videoUrl });
    console.log(`[runner] Job ${job.id} completed. Video: ${videoUrl}`);
  } catch (err) {
    const message = (err as Error).message;
    console.error(`[runner] Job ${job.id} failed: ${message}`);

    // Best-effort failure webhook
    try {
      await sendCompletionWebhook({
        run_id: payload.run_id,
        video_idea_id: payload.video_idea_id,
        video_url: '',
        status: 'failed',
        error: message,
        platform: payload.platform,
        compose_job_id: job.id,
      });
    } catch (webhookErr) {
      console.error(`[runner] Failed to send failure webhook: ${(webhookErr as Error).message}`);
    }

    onUpdate({ status: 'failed', error: message });
    throw err;
  }
}
