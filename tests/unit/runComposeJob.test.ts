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
jest.mock('../../src/renderer/finalValidation', () => ({
  validateFinalRender: jest.fn(),
}));
jest.mock('../../src/renderer/ffmpegHybrid', () => ({
  renderHybridFfmpeg: jest.fn(),
}));
jest.mock('../../src/renderer/graphicsPlates', () => ({
  renderGraphicsPlates: jest.fn(),
}));
jest.mock('../../src/postprocess/ffmpeg', () => ({
  applyPostProcessing: jest.fn(),
  ensureH264: jest.fn(),
  probeFps: jest.fn(),
}));
jest.mock('../../src/asr/transcribe', () => ({
  transcribe: jest.fn(),
}));
jest.mock('../../src/timeline', () => ({
  buildTimelineManifest: jest.fn(),
}));

import { resolveRendererSelector, runComposeJob } from '../../src/runner';
import { hydrateBrandProfile } from '../../src/brand/hydrator';
import { generateManifest } from '../../src/manifest/generator';
import { renderComposition } from '../../src/renderer/renderWorker';
import { validateFinalRender } from '../../src/renderer/finalValidation';
import { renderHybridFfmpeg } from '../../src/renderer/ffmpegHybrid';
import { renderGraphicsPlates } from '../../src/renderer/graphicsPlates';
import { applyPostProcessing, ensureH264 } from '../../src/postprocess/ffmpeg';
import { probeFps } from '../../src/postprocess/ffmpeg';
import { transcribe } from '../../src/asr/transcribe';
import { buildTimelineManifest } from '../../src/timeline';
import {
  BrandProfile,
  ComposeJob,
  CompositionManifest,
  HandoffPayload,
} from '../../src/types';

const mockHydrate = hydrateBrandProfile as unknown as jest.Mock;
const mockGenerate = generateManifest as unknown as jest.Mock;
const mockRender = renderComposition as unknown as jest.Mock;
const mockValidate = validateFinalRender as unknown as jest.Mock;
const mockHybridRender = renderHybridFfmpeg as unknown as jest.Mock;
const mockGraphicsPlates = renderGraphicsPlates as unknown as jest.Mock;
const mockPost = applyPostProcessing as unknown as jest.Mock;
const mockH264 = ensureH264 as unknown as jest.Mock;
const mockProbeFps = probeFps as unknown as jest.Mock;
const mockTranscribe = transcribe as unknown as jest.Mock;
const mockBuildTimeline = buildTimelineManifest as unknown as jest.Mock;

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
    process.env.VIDEO_COMPOSITOR_RENDERER = 'remotion_primary';
    mockHydrate.mockReset().mockResolvedValue(makeBrand());
    mockGenerate.mockReset().mockResolvedValue(makeManifest());
    mockTranscribe.mockReset().mockResolvedValue({ words: [], pauses: [] });
    mockProbeFps.mockReset().mockResolvedValue(32);
    // Default: ensureH264 is a no-op (returns the path untouched)
    mockH264.mockReset().mockImplementation(async (p: string) => p);
    mockRender.mockReset().mockResolvedValue(undefined);
    mockBuildTimeline.mockReset().mockReturnValue({ schema: 'timeline.v1', run_id: 'run-abc' });
    mockGraphicsPlates.mockReset().mockResolvedValue([]);
    mockHybridRender.mockReset().mockResolvedValue(undefined);
    mockPost.mockReset().mockResolvedValue(undefined);
    mockValidate.mockReset().mockResolvedValue({ ok: true });
  });

  it('defaults production to the FFmpeg hybrid renderer', () => {
    expect(resolveRendererSelector({ NODE_ENV: 'production' })).toBe('ffmpeg_hybrid');
  });

  it('defaults non-production to the FFmpeg hybrid renderer', () => {
    expect(resolveRendererSelector({ NODE_ENV: 'test' })).toBe('ffmpeg_hybrid');
  });

  it('honors an explicit renderer selector', () => {
    expect(resolveRendererSelector({ VIDEO_COMPOSITOR_RENDERER: 'ffmpeg_hybrid' })).toBe('ffmpeg_hybrid');
    expect(resolveRendererSelector({ VIDEO_COMPOSITOR_RENDERER: 'remotion_primary' })).toBe('remotion_primary');
  });

  it('rejects unknown renderer selectors', () => {
    expect(() => resolveRendererSelector({ VIDEO_COMPOSITOR_RENDERER: 'remotion' })).toThrow(
      'VIDEO_COMPOSITOR_RENDERER must be "ffmpeg_hybrid" or "remotion_primary"',
    );
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
      'validating',
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
    expect(mockTranscribe).toHaveBeenCalledTimes(1);
    expect(mockH264).toHaveBeenCalledTimes(2); // one per clip
    expect(mockRender).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockValidate).toHaveBeenCalledTimes(1);
  });

  it('uses the FFmpeg hybrid renderer when selected', async () => {
    process.env.VIDEO_COMPOSITOR_RENDERER = 'ffmpeg_hybrid';
    mockGraphicsPlates.mockResolvedValueOnce([
      { id: 'plate:caption_track', clipId: 'caption_track', filename: 'caption-track.mov' },
    ]);

    await runComposeJob(makeJob(), makePayload(), () => {});

    expect(mockBuildTimeline).toHaveBeenCalledWith(
      expect.objectContaining({ run_id: 'run-abc', width: 720, height: 1280 }),
      {
        availableClipFilenames: ['clip_000.mp4', 'clip_001.mp4'],
        outputFilename: 'composed.mp4',
      },
    );
    expect(mockGraphicsPlates).toHaveBeenCalledWith(expect.objectContaining({
      outputDir: expect.stringContaining('run-abc'),
      publicDir: expect.stringContaining('run-abc'),
      brandProfile: expect.objectContaining({ client_id: 'client-1' }),
    }));
    expect(mockHybridRender).toHaveBeenCalledWith(expect.objectContaining({
      timeline: { schema: 'timeline.v1', run_id: 'run-abc' },
      inputDir: expect.stringContaining('run-abc'),
      outputPath: expect.stringMatching(/composed\.mp4$/),
      graphicsPlates: [{ clipId: 'caption_track', filename: 'caption-track.mov' }],
    }));
    expect(mockRender).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
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

  it('forwards use_case into manifest generation and preserves it on the render manifest', async () => {
    await runComposeJob(makeJob(), makePayload({ use_case: 'ad' }), () => {});
    const input = mockGenerate.mock.calls[0][0];
    expect(input.use_case).toBe('ad');
    const renderCall = mockRender.mock.calls[0][0];
    expect(renderCall.manifest.use_case).toBe('ad');
  });

  it('overrides manifest width/height from video_format + target_resolution (9:16/720p)', async () => {
    await runComposeJob(makeJob(), makePayload(), () => {});
    const renderCall = mockRender.mock.calls[0][0];
    expect(renderCall.manifest.width).toBe(720);
    expect(renderCall.manifest.height).toBe(1280);
  });

  it('transcribes the voiceover with manifest fps and attaches caption_track', async () => {
    const captionTrack = {
      words: [{ word: 'Hello', start_frame: 0, end_frame: 12 }],
      pauses: [{ start_frame: 12, duration_frames: 9 }],
    };
    mockTranscribe.mockResolvedValueOnce(captionTrack);

    await runComposeJob(makeJob(), makePayload(), () => {});

    expect(mockTranscribe).toHaveBeenCalledWith(
      '/data/shared/run-abc/voiceover.mp3',
      { fps: 32 },
    );
    const renderCall = mockRender.mock.calls[0][0];
    expect(renderCall.manifest.caption_track).toEqual(captionTrack);
  });

  it('continues without captions when transcription fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockTranscribe.mockRejectedValueOnce(new Error('asr unavailable'));

    await runComposeJob(makeJob(), makePayload(), () => {});

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('continuing without captions: asr unavailable'),
    );
    const renderCall = mockRender.mock.calls[0][0];
    expect(renderCall.manifest.caption_track).toBeUndefined();
    expect(mockRender).toHaveBeenCalledTimes(1);
    warn.mockRestore();
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

  it('validates the final render against manifest output properties and persists a report', async () => {
    await runComposeJob(makeJob(), makePayload(), () => {});
    const [validationArg] = mockValidate.mock.calls[0];
    expect(validationArg.outputPath).toMatch(/composed\.mp4$/);
    expect(validationArg.reportPath).toMatch(/composed\.validation\.json$/);
    expect(validationArg.expected).toEqual({
      width: 720,
      height: 1280,
      fps: 32,
      durationSeconds: 3,
      requireAudio: true,
    });
  });

  it('reports the validation report path when the job completes', async () => {
    const updates: Array<Record<string, unknown>> = [];
    await runComposeJob(makeJob(), makePayload(), (u) => updates.push(u));
    const done = updates[updates.length - 1];
    expect(done.validation_report_path).toMatch(/composed\.validation\.json$/);
    expect(done.engagement_report_path).toMatch(/engagement\.validation\.json$/);
  });

  it('skips transcription when generate_captions is false', async () => {
    await runComposeJob(makeJob(), makePayload({ generate_captions: false }), () => {});
    expect(mockTranscribe).not.toHaveBeenCalled();
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

  it('reports failed + rethrows when final validation fails', async () => {
    mockValidate.mockRejectedValueOnce(new Error('mostly black output'));
    const updates: Array<Record<string, unknown>> = [];
    await expect(
      runComposeJob(makeJob(), makePayload(), (u) => updates.push(u)),
    ).rejects.toThrow('mostly black output');
    expect(updates[updates.length - 1].status).toBe('failed');
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

  it('uses the resolved source clip FPS for manifest generation, normalization, render, and final encode', async () => {
    await runComposeJob(makeJob(), makePayload(), () => {});

    expect(mockGenerate.mock.calls[0][0].target_fps).toBe(32);
    expect(mockH264).toHaveBeenCalledWith('/data/shared/run-abc/clip_000.mp4', 32);
    expect(mockH264).toHaveBeenCalledWith('/data/shared/run-abc/clip_001.mp4', 32);
    expect(mockRender.mock.calls[0][0].manifest.fps).toBe(32);
    expect(mockPost.mock.calls[0][0].targetFps).toBe(32);
  });
});
