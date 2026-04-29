jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

import { execFile } from 'child_process';
import { buildHybridFfmpegArgs, renderHybridFfmpeg } from '../../src/renderer/ffmpegHybrid';
import { TimelineManifest } from '../../src/timeline';

const mockExecFile = execFile as unknown as jest.Mock;

function timeline(overrides: Partial<TimelineManifest> = {}): TimelineManifest {
  return {
    schema: 'timeline.v1',
    source_schema: 'compose.v2',
    run_id: 'run-1',
    client_id: 'client-1',
    platform: 'tiktok',
    fps: 30,
    width: 720,
    height: 1280,
    duration_frames: 180,
    assets: [
      { id: 'asset:clip-0.mp4', filename: 'clip-0.mp4', kind: 'video', role: 'source' },
      { id: 'asset:clip-1.mp4', filename: 'clip-1.mp4', kind: 'video', role: 'source' },
      { id: 'asset:voiceover.mp3', filename: 'voiceover.mp3', kind: 'audio', role: 'voiceover' },
      { id: 'asset:music.mp3', filename: 'music.mp3', kind: 'audio', role: 'music' },
    ],
    layouts: [
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
        id: 'layout:split_horizontal',
        kind: 'split_horizontal',
        regions: [
          { id: 'top', x: 0, y: 0, width: 1, height: 0.5, z_index: 0 },
          { id: 'bottom', x: 0, y: 0.5, width: 1, height: 0.5, z_index: 0 },
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
      {
        id: 'layout:talking_head_sidebar',
        kind: 'talking_head_sidebar',
        regions: [
          { id: 'presenter', x: 0, y: 0, width: 0.38, height: 1, z_index: 1 },
          { id: 'supporting', x: 0.38, y: 0, width: 0.62, height: 1, z_index: 0 },
        ],
      },
      {
        id: 'layout:talking_head_pip',
        kind: 'talking_head_pip',
        regions: [
          { id: 'supporting', x: 0, y: 0, width: 1, height: 1, z_index: 0 },
          { id: 'presenter', x: 0.62, y: 0.62, width: 0.32, height: 0.28, z_index: 1 },
        ],
      },
      {
        id: 'layout:talking_head_full',
        kind: 'talking_head_full',
        regions: [{ id: 'main', x: 0, y: 0, width: 1, height: 1, z_index: 0 }],
      },
    ],
    tracks: {
      video: [
        {
          id: 'scene:0:video',
          asset_id: 'asset:clip-0.mp4',
          scene_index: 0,
          start_frame: 0,
          duration_frames: 90,
          source_in_frame: 0,
          layout_id: 'layout:sequential',
          region_id: 'main',
        },
        {
          id: 'scene:1:video',
          asset_id: 'asset:clip-1.mp4',
          scene_index: 1,
          start_frame: 90,
          duration_frames: 90,
          source_in_frame: 15,
          layout_id: 'layout:sequential',
          region_id: 'main',
        },
      ],
      audio: [
        {
          id: 'audio:voiceover',
          asset_id: 'asset:voiceover.mp3',
          start_frame: 0,
          duration_frames: 180,
          source_in_frame: 0,
        },
        {
          id: 'audio:music',
          asset_id: 'asset:music.mp3',
          start_frame: 30,
          duration_frames: 120,
          source_in_frame: 0,
          gain_db: -12,
        },
      ],
      graphics: [],
    },
    transitions: [],
    outputs: [
      {
        id: 'final',
        filename: 'composed.mp4',
        container: 'mp4',
        video_codec: 'h264',
        audio_codec: 'aac',
        pixel_format: 'yuv420p',
      },
    ],
    ...overrides,
  };
}

describe('buildHybridFfmpegArgs', () => {
  it('builds deterministic inputs and a sequential video concat graph', () => {
    const args = buildHybridFfmpegArgs({
      timeline: timeline(),
      inputDir: '/runs/run-1',
      outputPath: '/runs/run-1/composed.mp4',
    });

    expect(args.slice(0, 8)).toEqual([
      '-i', '/runs/run-1/clip-0.mp4',
      '-i', '/runs/run-1/clip-1.mp4',
      '-i', '/runs/run-1/voiceover.mp3',
      '-i', '/runs/run-1/music.mp3',
    ]);

    const filter = args[args.indexOf('-filter_complex') + 1];
    expect(filter).toContain('color=c=black:s=720x1280:d=3:r=30,format=yuv420p[scene0base]');
    expect(filter).toContain('[0:v]trim=start=0:duration=3');
    expect(filter).toContain('[1:v]trim=start=0.5:duration=3');
    expect(filter).toContain('scale=720:1280:force_original_aspect_ratio=increase');
    expect(filter).toContain('[scene0base][scene0v0]overlay=x=0:y=0:eof_action=pass[scene0]');
    expect(filter).toContain('[scene0][scene1]concat=n=2:v=1:a=0[basev]');
  });

  it('mixes delayed audio clips and applies music gain', () => {
    const args = buildHybridFfmpegArgs({
      timeline: timeline(),
      inputDir: '/runs/run-1',
      outputPath: '/runs/run-1/composed.mp4',
    });
    const filter = args[args.indexOf('-filter_complex') + 1];

    expect(filter).toContain('[2:a]atrim=start=0:duration=6,asetpts=PTS-STARTPTS,adelay=0:all=1[a0]');
    expect(filter).toContain('[3:a]atrim=start=0:duration=4,asetpts=PTS-STARTPTS,adelay=1000:all=1,volume=-12dB[a1]');
    expect(filter).toContain('[a0][a1]amix=inputs=2:duration=longest:dropout_transition=0,loudnorm=I=-16:LRA=11:TP=-1.5[mixeda]');
    expect(args).toEqual(expect.arrayContaining(['-map', '[mixeda]', '-c:a', 'aac']));
  });

  it('omits audio mapping when the timeline has no audio track', () => {
    const args = buildHybridFfmpegArgs({
      timeline: timeline({
        tracks: { ...timeline().tracks, audio: [] },
      }),
      inputDir: '/runs/run-1',
      outputPath: '/runs/run-1/composed.mp4',
    });

    expect(args).toContain('-an');
    expect(args).not.toContain('[mixeda]');
  });

  it('composites rendered graphics plates over the FFmpeg base video', () => {
    const args = buildHybridFfmpegArgs({
      timeline: timeline({
        tracks: {
          ...timeline().tracks,
          graphics: [{
            id: 'scene:0:graphics:kinetic_title:0',
            component: 'kinetic_title',
            scene_index: 0,
            start_frame: 30,
            duration_frames: 45,
            props: { text: 'Hook' },
            render_mode: 'transparent_plate',
          }],
        },
      }),
      inputDir: '/runs/run-1',
      outputPath: '/runs/run-1/composed.mp4',
      graphicsPlates: [{
        clipId: 'scene:0:graphics:kinetic_title:0',
        filename: 'scene-0-graphics-kinetic-title-0.mov',
      }],
    });
    const filter = args[args.indexOf('-filter_complex') + 1];

    expect(args.slice(0, 10)).toEqual([
      '-i', '/runs/run-1/clip-0.mp4',
      '-i', '/runs/run-1/clip-1.mp4',
      '-i', '/runs/run-1/voiceover.mp3',
      '-i', '/runs/run-1/music.mp3',
      '-i', '/runs/run-1/scene-0-graphics-kinetic-title-0.mov',
    ]);
    expect(filter).toContain('[4:v]setpts=PTS-STARTPTS+1/TB,format=rgba[plate0]');
    expect(filter).toContain("[basev][plate0]overlay=x=0:y=0:eof_action=pass:enable='between(t,1,2.5)'[compositedv]");
    expect(args).toEqual(expect.arrayContaining(['-map', '[compositedv]']));
  });

  it('composites caption plates over the full timeline duration', () => {
    const args = buildHybridFfmpegArgs({
      timeline: timeline({
        captions: {
          words: [{ word: 'Hello', start_frame: 0, end_frame: 15 }],
        },
      }),
      inputDir: '/runs/run-1',
      outputPath: '/runs/run-1/composed.mp4',
      graphicsPlates: [{
        clipId: 'caption_track',
        filename: 'caption-track.mov',
      }],
    });
    const filter = args[args.indexOf('-filter_complex') + 1];

    expect(filter).toContain('[4:v]setpts=PTS-STARTPTS+0/TB,format=rgba[plate0]');
    expect(filter).toContain("enable='between(t,0,6)'[compositedv]");
  });

  it('keeps absolute asset filenames unchanged', () => {
    const args = buildHybridFfmpegArgs({
      timeline: timeline({
        assets: [
          { id: 'asset:clip-0.mp4', filename: '/external/clip-0.mp4', kind: 'video' },
          { id: 'asset:clip-1.mp4', filename: 'clip-1.mp4', kind: 'video' },
          { id: 'asset:voiceover.mp3', filename: 'voiceover.mp3', kind: 'audio' },
          { id: 'asset:music.mp3', filename: 'music.mp3', kind: 'audio' },
        ],
      }),
      inputDir: '/runs/run-1',
      outputPath: '/runs/run-1/composed.mp4',
    });

    expect(args[args.indexOf('-i') + 1]).toBe('/external/clip-0.mp4');
  });

  it('renders picture-in-picture with the overlay clip above the main clip', () => {
    const args = buildHybridFfmpegArgs({
      timeline: timeline({
        tracks: {
          ...timeline().tracks,
          video: [
            {
              ...timeline().tracks.video[0],
              layout_id: 'layout:picture_in_picture',
              region_id: 'main',
            },
            {
              ...timeline().tracks.video[1],
              start_frame: 0,
              source_in_frame: 0,
              layout_id: 'layout:picture_in_picture',
              region_id: 'pip',
            },
          ],
        },
      }),
      inputDir: '/runs/run-1',
      outputPath: '/runs/run-1/composed.mp4',
    });
    const filter = args[args.indexOf('-filter_complex') + 1];

    expect(filter).toContain('[0:v]trim=start=0:duration=3,setpts=PTS-STARTPTS,fps=30,scale=720:1280');
    expect(filter).toContain('[1:v]trim=start=0:duration=3,setpts=PTS-STARTPTS,fps=30,scale=230:358');
    expect(filter).toContain('[scene0base][scene0v0]overlay=x=0:y=0:eof_action=pass[scene0tmp0]');
    expect(filter).toContain('[scene0tmp0][scene0v1]overlay=x=446:y=794:eof_action=pass[scene0]');
  });

  it('renders split-vertical layouts by scaling each simultaneous clip to its assigned region', () => {
    const args = buildHybridFfmpegArgs({
      timeline: timeline({
        tracks: {
          ...timeline().tracks,
          video: [
            {
              ...timeline().tracks.video[0],
              layout_id: 'layout:split_vertical',
              region_id: 'left',
            },
            {
              ...timeline().tracks.video[1],
              start_frame: 0,
              source_in_frame: 0,
              layout_id: 'layout:split_vertical',
              region_id: 'right',
            },
          ],
        },
      }),
      inputDir: '/runs/run-1',
      outputPath: '/runs/run-1/composed.mp4',
    });
    const filter = args[args.indexOf('-filter_complex') + 1];

    expect(filter).toContain('scale=360:1280:force_original_aspect_ratio=increase');
    expect(filter).toContain('[scene0base][scene0v0]overlay=x=0:y=0:eof_action=pass[scene0tmp0]');
    expect(filter).toContain('[scene0tmp0][scene0v1]overlay=x=360:y=0:eof_action=pass[scene0]');
  });

  it('renders split-horizontal layouts by scaling each simultaneous clip to its assigned region', () => {
    const args = buildHybridFfmpegArgs({
      timeline: timeline({
        tracks: {
          ...timeline().tracks,
          video: [
            {
              ...timeline().tracks.video[0],
              layout_id: 'layout:split_horizontal',
              region_id: 'top',
            },
            {
              ...timeline().tracks.video[1],
              start_frame: 0,
              source_in_frame: 0,
              layout_id: 'layout:split_horizontal',
              region_id: 'bottom',
            },
          ],
        },
      }),
      inputDir: '/runs/run-1',
      outputPath: '/runs/run-1/composed.mp4',
    });
    const filter = args[args.indexOf('-filter_complex') + 1];

    expect(filter).toContain('scale=720:640:force_original_aspect_ratio=increase');
    expect(filter).toContain('[scene0base][scene0v0]overlay=x=0:y=0:eof_action=pass[scene0tmp0]');
    expect(filter).toContain('[scene0tmp0][scene0v1]overlay=x=0:y=640:eof_action=pass[scene0]');
  });

  it('renders talking-head full scenes as fullscreen regions', () => {
    const args = buildHybridFfmpegArgs({
      timeline: timeline({
        tracks: {
          ...timeline().tracks,
          video: [
            {
              ...timeline().tracks.video[0],
              layout_id: 'layout:talking_head_full',
              region_id: 'main',
            },
          ],
        },
      }),
      inputDir: '/runs/run-1',
      outputPath: '/runs/run-1/composed.mp4',
    });
    const filter = args[args.indexOf('-filter_complex') + 1];

    expect(filter).toContain('scale=720:1280:force_original_aspect_ratio=increase');
    expect(filter).toContain('[scene0base][scene0v0]overlay=x=0:y=0:eof_action=pass[scene0]');
  });

  it('renders talking-head sidebar regions from the timeline layout', () => {
    const args = buildHybridFfmpegArgs({
      timeline: timeline({
        tracks: {
          ...timeline().tracks,
          video: [
            {
              ...timeline().tracks.video[0],
              layout_id: 'layout:talking_head_sidebar',
              region_id: 'supporting',
            },
            {
              ...timeline().tracks.video[1],
              start_frame: 0,
              source_in_frame: 0,
              layout_id: 'layout:talking_head_sidebar',
              region_id: 'presenter',
            },
          ],
        },
      }),
      inputDir: '/runs/run-1',
      outputPath: '/runs/run-1/composed.mp4',
    });
    const filter = args[args.indexOf('-filter_complex') + 1];

    expect(filter).toContain('scale=446:1280:force_original_aspect_ratio=increase');
    expect(filter).toContain('scale=274:1280:force_original_aspect_ratio=increase');
    expect(filter).toContain('[scene0base][scene0v0]overlay=x=274:y=0:eof_action=pass[scene0tmp0]');
    expect(filter).toContain('[scene0tmp0][scene0v1]overlay=x=0:y=0:eof_action=pass[scene0]');
  });

  it('renders talking-head PIP regions from the timeline layout', () => {
    const args = buildHybridFfmpegArgs({
      timeline: timeline({
        tracks: {
          ...timeline().tracks,
          video: [
            {
              ...timeline().tracks.video[0],
              layout_id: 'layout:talking_head_pip',
              region_id: 'supporting',
            },
            {
              ...timeline().tracks.video[1],
              start_frame: 0,
              source_in_frame: 0,
              layout_id: 'layout:talking_head_pip',
              region_id: 'presenter',
            },
          ],
        },
      }),
      inputDir: '/runs/run-1',
      outputPath: '/runs/run-1/composed.mp4',
    });
    const filter = args[args.indexOf('-filter_complex') + 1];

    expect(filter).toContain('[scene0base][scene0v0]overlay=x=0:y=0:eof_action=pass[scene0tmp0]');
    expect(filter).toContain('[scene0tmp0][scene0v1]overlay=x=446:y=794:eof_action=pass[scene0]');
  });

  it('maps soft_cut transitions to frame-accurate xfade before stitching', () => {
    const args = buildHybridFfmpegArgs({
      timeline: timeline({
        transitions: [{
          id: 'transition:0:soft_cut',
          from_clip_id: 'scene:0:video',
          to_clip_id: 'scene:1:video',
          type: 'soft_cut',
          duration_frames: 15,
          offset_frame: 75,
        }],
      }),
      inputDir: '/runs/run-1',
      outputPath: '/runs/run-1/composed.mp4',
    });
    const filter = args[args.indexOf('-filter_complex') + 1];

    expect(filter).toContain('[scene1]tpad=stop_mode=clone:stop_duration=0.5[scene1pad]');
    expect(filter).toContain('[scene0][scene1pad]xfade=transition=fade:duration=0.5:offset=2.5[stitched1]');
    expect(filter).toContain('[stitched1]copy[basev]');
    expect(filter).not.toContain('[scene0][scene1]concat=n=2:v=1:a=0[basev]');
  });

  const transitionCases: Array<{
    type: TimelineManifest['transitions'][number]['type'];
    direction?: TimelineManifest['transitions'][number]['direction'];
    expectedXfade: string;
  }> = [
    { type: 'slide_push', direction: 'left', expectedXfade: 'slideleft' },
    { type: 'slide_push', direction: 'right', expectedXfade: 'slideright' },
    { type: 'slide_push', direction: 'up', expectedXfade: 'slideup' },
    { type: 'slide_push', direction: 'down', expectedXfade: 'slidedown' },
    { type: 'slide', expectedXfade: 'slideleft' },
    { type: 'color_wipe', expectedXfade: 'wipeleft' },
    { type: 'scale_push', expectedXfade: 'zoomin' },
    { type: 'zoom_blur', expectedXfade: 'hblur' },
  ];

  transitionCases.forEach(({ type, direction, expectedXfade }) => {
    it(`maps ${type} transitions to ${expectedXfade}`, () => {
      const args = buildHybridFfmpegArgs({
        timeline: timeline({
          transitions: [{
            id: `transition:0:${type}`,
            from_clip_id: 'scene:0:video',
            to_clip_id: 'scene:1:video',
            type,
            duration_frames: 15,
            offset_frame: 75,
            ...(direction ? { direction } : {}),
          }],
        }),
        inputDir: '/runs/run-1',
        outputPath: '/runs/run-1/composed.mp4',
      });
      const filter = args[args.indexOf('-filter_complex') + 1];

      expect(filter).toContain(`[scene1]tpad=stop_mode=clone:stop_duration=0.5[scene1pad]`);
      expect(filter).toContain(`xfade=transition=${expectedXfade}:duration=0.5:offset=2.5[stitched1]`);
    });
  });

  it('keeps chained transition offsets frame-accurate after earlier overlap windows', () => {
    const args = buildHybridFfmpegArgs({
      timeline: timeline({
        duration_frames: 270,
        assets: [
          ...timeline().assets,
          { id: 'asset:clip-2.mp4', filename: 'clip-2.mp4', kind: 'video', role: 'source' },
        ],
        tracks: {
          ...timeline().tracks,
          video: [
            ...timeline().tracks.video,
            {
              id: 'scene:2:video',
              asset_id: 'asset:clip-2.mp4',
              scene_index: 2,
              start_frame: 180,
              duration_frames: 90,
              source_in_frame: 0,
              layout_id: 'layout:sequential',
              region_id: 'main',
            },
          ],
          audio: [],
        },
        transitions: [
          {
            id: 'transition:0:soft_cut',
            from_clip_id: 'scene:0:video',
            to_clip_id: 'scene:1:video',
            type: 'soft_cut',
            duration_frames: 15,
            offset_frame: 75,
          },
          {
            id: 'transition:1:slide_push',
            from_clip_id: 'scene:1:video',
            to_clip_id: 'scene:2:video',
            type: 'slide_push',
            duration_frames: 15,
            offset_frame: 165,
            direction: 'left',
          },
        ],
      }),
      inputDir: '/runs/run-1',
      outputPath: '/runs/run-1/composed.mp4',
    });
    const filter = args[args.indexOf('-filter_complex') + 1];

    expect(filter).toContain('[scene1]tpad=stop_mode=clone:stop_duration=0.5[scene1pad]');
    expect(filter).toContain('[scene0][scene1pad]xfade=transition=fade:duration=0.5:offset=2.5[stitched1]');
    expect(filter).toContain('[scene2]tpad=stop_mode=clone:stop_duration=0.5[scene2pad]');
    expect(filter).toContain('[stitched1][scene2pad]xfade=transition=slideleft:duration=0.5:offset=5.5[stitched2]');
    expect(filter).toContain('[stitched2]copy[basev]');
  });

  it('pads the final base video to the declared timeline duration', () => {
    const args = buildHybridFfmpegArgs({
      timeline: timeline({
        duration_frames: 210,
        transitions: [{
          id: 'transition:0:soft_cut',
          from_clip_id: 'scene:0:video',
          to_clip_id: 'scene:1:video',
          type: 'soft_cut',
          duration_frames: 15,
          offset_frame: 75,
        }],
      }),
      inputDir: '/runs/run-1',
      outputPath: '/runs/run-1/composed.mp4',
    });
    const filter = args[args.indexOf('-filter_complex') + 1];

    expect(filter).toContain('[stitched1]tpad=stop_mode=clone:stop_duration=1[basev]');
  });
});

describe('renderHybridFfmpeg', () => {
  beforeEach(() => {
    mockExecFile.mockReset();
  });

  it('executes ffmpeg with the generated argument list', async () => {
    mockExecFile.mockImplementationOnce(
      (_cmd: string, _args: string[], cb: (err: Error | null, res: { stdout: string; stderr: string }) => void) => {
        cb(null, { stdout: '', stderr: '' });
      },
    );

    await renderHybridFfmpeg({
      timeline: timeline(),
      inputDir: '/runs/run-1',
      outputPath: '/runs/run-1/composed.mp4',
    });

    expect(mockExecFile).toHaveBeenCalledTimes(1);
    expect(mockExecFile.mock.calls[0][0]).toBe('ffmpeg');
    expect(mockExecFile.mock.calls[0][1]).toContain('-filter_complex');
  });

  it('wraps ffmpeg execution failures', async () => {
    mockExecFile.mockImplementationOnce(
      (_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
        cb(new Error('exit code 1'));
      },
    );

    await expect(renderHybridFfmpeg({
      timeline: timeline(),
      inputDir: '/runs/run-1',
      outputPath: '/runs/run-1/composed.mp4',
    })).rejects.toThrow(/Hybrid FFmpeg render failed.*exit code 1/);
  });
});
