import { execFile } from 'child_process';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { renderHybridFfmpeg } from '../../src/renderer/ffmpegHybrid';
import { validateFinalRender } from '../../src/renderer/finalValidation';
import { TimelineLayout, TimelineManifest, TimelineVideoClip } from '../../src/timeline';

const execFileAsync = promisify(execFile);
const FPS = 30;
const SCENE_FRAMES = 60;
const TRANSITION_FRAMES = 15;
const TEST_TIMEOUT_MS = 120000;

interface RenderFixture {
  name: string;
  width: number;
  height: number;
  durationFrames: number;
  video: TimelineVideoClip[];
  transitions?: TimelineManifest['transitions'];
}

const layouts: TimelineLayout[] = [
  {
    id: 'layout:sequential',
    kind: 'sequential',
    regions: [{ id: 'main', x: 0, y: 0, width: 1, height: 1, z_index: 0 }],
  },
  {
    id: 'layout:picture_in_picture',
    kind: 'picture_in_picture',
    regions: [
      { id: 'main', x: 0, y: 0, width: 1, height: 1, z_index: 0 },
      { id: 'pip', x: 0.62, y: 0.62, width: 0.32, height: 0.28, z_index: 1 },
    ],
  },
  {
    id: 'layout:split_vertical',
    kind: 'split_vertical',
    regions: [
      { id: 'left', x: 0, y: 0, width: 0.5, height: 1, z_index: 0 },
      { id: 'right', x: 0.5, y: 0, width: 0.5, height: 1, z_index: 0 },
    ],
  },
];

const fixtures: RenderFixture[] = [
  {
    name: '16:9 sequential render with a transition',
    width: 640,
    height: 360,
    durationFrames: SCENE_FRAMES * 2,
    video: [
      videoClip('scene:0:video', 'asset:clip-red-30.mp4', 0, 0, 'layout:sequential', 'main'),
      videoClip(
        'scene:1:video',
        'asset:clip-blue-32.mp4',
        1,
        SCENE_FRAMES,
        'layout:sequential',
        'main',
      ),
    ],
    transitions: [{
      id: 'transition:0:soft_cut',
      from_clip_id: 'scene:0:video',
      to_clip_id: 'scene:1:video',
      type: 'soft_cut',
      duration_frames: TRANSITION_FRAMES,
      offset_frame: SCENE_FRAMES - TRANSITION_FRAMES,
    }],
  },
  {
    name: '9:16 picture-in-picture render with mixed 16fps and 24fps sources',
    width: 360,
    height: 640,
    durationFrames: SCENE_FRAMES,
    video: [
      videoClip('scene:0:main', 'asset:clip-green-16.mp4', 0, 0, 'layout:picture_in_picture', 'main'),
      videoClip('scene:0:pip', 'asset:clip-blue-24.mp4', 0, 0, 'layout:picture_in_picture', 'pip'),
    ],
  },
  {
    name: '1:1 split render with simultaneous 30fps and 32fps videos',
    width: 480,
    height: 480,
    durationFrames: SCENE_FRAMES,
    video: [
      videoClip('scene:0:left', 'asset:clip-red-30.mp4', 0, 0, 'layout:split_vertical', 'left'),
      videoClip('scene:0:right', 'asset:clip-blue-32.mp4', 0, 0, 'layout:split_vertical', 'right'),
    ],
  },
];

describe('Integration: hybrid FFmpeg render fixtures', () => {
  let workDir: string;

  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'tabario-hybrid-render-'));
    await Promise.all([
      createVideoFixture('clip-red-30.mp4', 30, 'red'),
      createVideoFixture('clip-green-16.mp4', 16, 'green'),
      createVideoFixture('clip-blue-24.mp4', 24, 'blue'),
      createVideoFixture('clip-blue-32.mp4', 32, 'blue'),
      createAudioFixture('voiceover.wav'),
    ]);
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true });
    }
  });

  it.each(fixtures)('$name', async (fixture) => {
    const outputPath = join(workDir, `${slug(fixture.name)}.mp4`);
    const reportPath = join(workDir, `${slug(fixture.name)}.validation.json`);
    const timeline = timelineFor(fixture);

    await renderHybridFfmpeg({
      timeline,
      inputDir: workDir,
      outputPath,
    });

    const report = await validateFinalRender({
      outputPath,
      reportPath,
      expected: {
        width: fixture.width,
        height: fixture.height,
        fps: FPS,
        durationSeconds: fixture.durationFrames / FPS,
        requireAudio: true,
      },
      durationToleranceSeconds: 0.25,
      blackFrameRatioThreshold: 0.5,
    });

    expect(report.ok).toBe(true);
    expect(report.probe.hasVideo).toBe(true);
    expect(report.probe.hasAudio).toBe(true);
    expect(report.probe.width).toBe(fixture.width);
    expect(report.probe.height).toBe(fixture.height);
    expect(report.blackFrames.ratio).toBeLessThan(0.5);
  }, TEST_TIMEOUT_MS);

  function createVideoFixture(filename: string, fps: number, color: string): Promise<unknown> {
    return execFileAsync('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-f', 'lavfi',
      '-i', `color=c=${color}:s=320x240:d=3:r=${fps}`,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-r', String(fps),
      '-y',
      join(workDir, filename),
    ]);
  }

  function createAudioFixture(filename: string): Promise<unknown> {
    return execFileAsync('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-f', 'lavfi',
      '-i', 'sine=frequency=880:duration=4:sample_rate=48000',
      '-ac', '1',
      '-y',
      join(workDir, filename),
    ]);
  }
});

function videoClip(
  id: string,
  assetId: string,
  sceneIndex: number,
  startFrame: number,
  layoutId: string,
  regionId: string,
): TimelineVideoClip {
  return {
    id,
    asset_id: assetId,
    scene_index: sceneIndex,
    start_frame: startFrame,
    duration_frames: SCENE_FRAMES,
    source_in_frame: 0,
    layout_id: layoutId,
    region_id: regionId,
  };
}

function timelineFor(fixture: RenderFixture): TimelineManifest {
  return {
    schema: 'timeline.v1',
    source_schema: 'integration-fixture',
    run_id: slug(fixture.name),
    client_id: 'integration-test-client',
    platform: 'integration',
    fps: FPS,
    width: fixture.width,
    height: fixture.height,
    duration_frames: fixture.durationFrames,
    assets: [
      { id: 'asset:clip-red-30.mp4', filename: 'clip-red-30.mp4', kind: 'video', role: 'source' },
      { id: 'asset:clip-green-16.mp4', filename: 'clip-green-16.mp4', kind: 'video', role: 'source' },
      { id: 'asset:clip-blue-24.mp4', filename: 'clip-blue-24.mp4', kind: 'video', role: 'source' },
      { id: 'asset:clip-blue-32.mp4', filename: 'clip-blue-32.mp4', kind: 'video', role: 'source' },
      { id: 'asset:voiceover.wav', filename: 'voiceover.wav', kind: 'audio', role: 'voiceover' },
    ],
    layouts,
    tracks: {
      video: fixture.video,
      audio: [{
        id: 'audio:voiceover',
        asset_id: 'asset:voiceover.wav',
        start_frame: 0,
        duration_frames: fixture.durationFrames,
        source_in_frame: 0,
      }],
      graphics: [],
    },
    transitions: fixture.transitions ?? [],
    outputs: [{
      id: 'final',
      filename: 'composed.mp4',
      container: 'mp4',
      video_codec: 'h264',
      audio_codec: 'aac',
      pixel_format: 'yuv420p',
    }],
  };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
