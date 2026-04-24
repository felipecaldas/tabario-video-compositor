/**
 * Unit tests for runComposeJob in src/runner.ts.  Mocks every downstream
 * collaborator so we can drive the orchestrator through its happy path,
 * scene-mapping logic, dimension overrides, onUpdate sequence, and
 * error paths without invoking Supabase, OpenAI, ffmpeg or Remotion.
 */

jest.mock('../../src/brand/hydrator', () => ({
  hydrateBrandProfile: jest.fn(),
}));
jest.mock('../../src/manifest/generator', () => ({
  generateManifest: jest.fn(),
}));
jest.mock('../../src/renderer/renderWorker', () => ({
  renderComposition: jest.fn(),
}));
jest.mock('../../src/postprocess/ffmpeg', () => ({
  applyPostProcessing: jest.fn(),
  ensureH264: jest.fn(),
}));

import { runComposeJob } from '../../src/runner';
import { hydrateBrandProfile } from '../../src/brand/hydrator';
import { generateManifest } from '../../src/manifest/generator';
import { renderComposition } from '../../src/renderer/renderWorker';
import { applyPostProcessing, ensureH264 } from '../../src/postprocess/ffmpeg';
import {
  BrandProfile,
  ComposeJob,
  CompositionManifest,
  HandoffPayload,
} from '../../src/types';

const mockHydrate = hydrateBrandProfile as unknown as jest.Mock;
const mockGenerate = generateManifest as unknown as jest.Mock;
const mockRender = renderComposition as unknown as jest.Mock;
const mockPost = applyPostProcessing as unknown as jest.Mock;
const mockH264 = ensureH264 as unknown as jest.Mock;

function makeJob(): ComposeJob {
  return {
    id: 'job-1',
    run_id: 'run-abc',
    client_id: 'client-1',
    status: 'pending',
    created_at: new Date(),
    updated_at: new Date(),
  } as unknown as ComposeJob;
}

function makePayload(overrides: Partial<HandoffPayload> = {}): HandoffPayload {
  return {
    run_id: 'run-abc',
    client_id: 'client-1',
    brief: { hook: 'x', platform_briefs: [] },
    platform: 'TikTok',
    voiceover_path: '/data/shared/run-abc/voiceover.mp3',
    clip_paths: [
      '/data/shared/run-abc/clip_000.mp4',
      '/data/shared/run-abc/clip_001.mp4',
    ],
    video_format: '9:16',
    target_resolution: '720p',
    user_access_token: 'jwt-token',
    ...overrides,
  };
}

function makeBrand(): BrandProfile {
  return {
    id: 'bp-1',
    client_id: 'client-1',
    audio_targets: { voiceover_lufs: -16, music_ducking_db: -12 },
  };
}

function makeManifest(): CompositionManifest {
  return {
    schema: 'compose.v1',
    client_id: 'client-1',
    run_id: 'run-abc',
    platform: 'tiktok',
    fps: 30,
    width: 1080,
    height: 1920,
    duration_frames: 90,
    scenes: [
      {
        index: 0,
        clip_filename: 'clip_000.mp4',
        duration_frames: 60,
        layout: 'fullscreen',
      },
      {
        index: 1,
        clip_filename: 'clip_001.mp4',
        duration_frames: 30,
        layout: 'fullscreen',
      },
    ],
    transitions: [],
    overlays: [],
    audio_track: {
      voiceover_filename: 'voiceover.mp3',
      lufs_target: -16,
      music_ducking_db: -12,
    },
    closing: {
      component: 'end_card',
      cta: { text: 'Go' },
      show_logo: true,
      start_frame: 60,
      duration_frames: 30,
    },
  };
}

describe('runComposeJob', () => {
  beforeEach(() => {
    mockHydrate.mockReset().mockResolvedValue(makeBrand());
    mockGenerate.mockReset().mockResolvedValue(makeManifest());
    // Default: ensureH264 is a no-op (returns the path untouched)
    mockH264.mockReset().mockImplementation(async (p: string) => p);
    mockRender.mockReset().mockResolvedValue(undefined);
    mockPost.mockReset().mockResolvedValue(undefined);
  });

  it('completes the happy path and reports final_video_path', async () => {
    const job = makeJob();
    const updates: Array<Record<string, unknown>> = [];
    await runComposeJob(job, makePayload(), (u) => updates.push(u));

    const statuses = updates.map((u) => u.status).filter(Boolean);
    expect(statuses).toEqual([
      'hydrating',
      'generating_manifest',
      'transcoding',
      'rendering',
      'post_processing',
      'done',
    ]);
    // path.join uses OS-native separators — assert on basename + run_id only
    const finalPath = updates[updates.length - 1].final_video_path as string;
    expect(finalPath).toMatch(/composed\.mp4$/);
    expect(finalPath).toContain('run-abc');
  });

  it('calls every downstream collaborator exactly once', async () => {
    await runComposeJob(makeJob(), makePayload(), () => {});
    expect(mockHydrate).toHaveBeenCalledTimes(1);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockH264).toHaveBeenCalledTimes(2); // one per clip
    expect(mockRender).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('hydrates the brand profile with client_id and user_access_token', async () => {
    await runComposeJob(makeJob(), makePayload(), () => {});
    expect(mockHydrate).toHaveBeenCalledWith('client-1', 'jwt-token');
  });

  it('forwards clip + voiceover basenames into the manifest generator', async () => {
    await runComposeJob(makeJob(), makePayload(), () => {});
    const input = mockGenerate.mock.calls[0][0];
    expect(input.clip_filenames).toEqual(['clip_000.mp4', 'clip_001.mp4']);
    expect(input.voiceover_filename).toBe('voiceover.mp3');
    expect(input.run_id).toBe('run-abc');
    expect(input.client_id).toBe('client-1');
    expect(input.platform).toBe('TikTok');
  });

  it('overrides manifest width/height from video_format + target_resolution (9:16/720p)', async () => {
    await runComposeJob(makeJob(), makePayload(), () => {});
    const renderCall = mockRender.mock.calls[0][0];
    expect(renderCall.manifest.width).toBe(720);
    expect(renderCall.manifest.height).toBe(1280);
  });

  it('overrides manifest width/height from video_format 16:9', async () => {
    await runComposeJob(
      makeJob(),
      makePayload({ video_format: '16:9' }),
      () => {},
    );
    const renderCall = mockRender.mock.calls[0][0];
    expect(renderCall.manifest.width).toBe(1280);
    expect(renderCall.manifest.height).toBe(720);
  });

  it('defaults target_resolution to 720p when not supplied', async () => {
    await runComposeJob(
      makeJob(),
      makePayload({ target_resolution: undefined as unknown as string }),
      () => {},
    );
    const renderCall = mockRender.mock.calls[0][0];
    expect(renderCall.manifest.width).toBe(720);
    expect(renderCall.manifest.height).toBe(1280);
  });

  it('rewrites scene clip_filename to the transcoded H.264 filename', async () => {
    mockH264.mockImplementation(async (p: string) => p.replace(/\.mp4$/, '_h264.mp4'));
    await runComposeJob(makeJob(), makePayload(), () => {});
    const renderCall = mockRender.mock.calls[0][0];
    expect(renderCall.manifest.scenes[0].clip_filename).toBe('clip_000_h264.mp4');
    expect(renderCall.manifest.scenes[1].clip_filename).toBe('clip_001_h264.mp4');
  });

  it('preserves typographic scenes (undefined clip_filename) unchanged', async () => {
    mockH264.mockImplementation(async (p: string) => p.replace(/\.mp4$/, '_h264.mp4'));
    const manifestWithTypo = makeManifest();
    manifestWithTypo.scenes = [
      {
        index: 0,
        // No clip_filename — typographic scene
        duration_frames: 60,
        layout: 'fullscreen',
        scene_overlays: [{ component: 'stagger_title', text: 'hello' }],
      },
      manifestWithTypo.scenes[1],
    ];
    mockGenerate.mockResolvedValue(manifestWithTypo);

    await runComposeJob(makeJob(), makePayload(), () => {});
    const renderCall = mockRender.mock.calls[0][0];
    expect(renderCall.manifest.scenes[0].clip_filename).toBeUndefined();
    expect(renderCall.manifest.scenes[1].clip_filename).toBe('clip_001_h264.mp4');
  });

  it('passes runDir as publicDir to the renderer', async () => {
    await runComposeJob(makeJob(), makePayload(), () => {});
    const renderCall = mockRender.mock.calls[0][0];
    expect(renderCall.publicDir).toContain('run-abc');
    expect(renderCall.outputPath).toMatch(/composed_raw\.mp4$/);
  });

  it('passes brand audio_targets into applyPostProcessing', async () => {
    await runComposeJob(makeJob(), makePayload(), () => {});
    const [postArg] = mockPost.mock.calls[0];
    expect(postArg.audioTargets).toEqual({
      voiceover_lufs: -16,
      music_ducking_db: -12,
    });
    expect(postArg.outputPath).toMatch(/composed\.mp4$/);
    expect(postArg.inputPath).toMatch(/composed_raw\.mp4$/);
  });

  it('emits a "rendering" update that includes the final manifest', async () => {
    const updates: Array<Record<string, unknown>> = [];
    await runComposeJob(makeJob(), makePayload(), (u) => updates.push(u));
    const renderingUpdate = updates.find((u) => u.status === 'rendering');
    expect(renderingUpdate?.manifest).toBeDefined();
    expect((renderingUpdate?.manifest as CompositionManifest).width).toBe(720);
  });

  it('reports failed + rethrows when hydrateBrandProfile fails', async () => {
    mockHydrate.mockRejectedValueOnce(new Error('rls denied'));
    const updates: Array<Record<string, unknown>> = [];
    await expect(
      runComposeJob(makeJob(), makePayload(), (u) => updates.push(u)),
    ).rejects.toThrow('rls denied');
    const last = updates[updates.length - 1];
    expect(last.status).toBe('failed');
    expect(last.error).toBe('rls denied');
    // Downstream should not have been called
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockRender).not.toHaveBeenCalled();
  });

  it('reports failed + rethrows when generateManifest fails', async () => {
    mockGenerate.mockRejectedValueOnce(new Error('llm unavailable'));
    const updates: Array<Record<string, unknown>> = [];
    await expect(
      runComposeJob(makeJob(), makePayload(), (u) => updates.push(u)),
    ).rejects.toThrow('llm unavailable');
    expect(updates[updates.length - 1].status).toBe('failed');
    expect(mockRender).not.toHaveBeenCalled();
  });

  it('reports failed + rethrows when renderComposition fails', async () => {
    mockRender.mockRejectedValueOnce(new Error('chromium crashed'));
    const updates: Array<Record<string, unknown>> = [];
    await expect(
      runComposeJob(makeJob(), makePayload(), (u) => updates.push(u)),
    ).rejects.toThrow('chromium crashed');
    expect(updates[updates.length - 1].status).toBe('failed');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('reports failed + rethrows when applyPostProcessing fails', async () => {
    mockPost.mockRejectedValueOnce(new Error('ffmpeg oom'));
    const updates: Array<Record<string, unknown>> = [];
    await expect(
      runComposeJob(makeJob(), makePayload(), (u) => updates.push(u)),
    ).rejects.toThrow('ffmpeg oom');
    expect(updates[updates.length - 1].status).toBe('failed');
    // The "done" update was never emitted because post failed first
    expect(updates.find((u) => u.status === 'done')).toBeUndefined();
  });

  it('runs ensureH264 over each clip_path in parallel', async () => {
    const calls: string[] = [];
    mockH264.mockImplementation(async (p: string) => {
      calls.push(p);
      return p;
    });
    await runComposeJob(makeJob(), makePayload(), () => {});
    expect(calls).toEqual([
      '/data/shared/run-abc/clip_000.mp4',
      '/data/shared/run-abc/clip_001.mp4',
    ]);
  });
});
