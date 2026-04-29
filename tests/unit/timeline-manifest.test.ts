import { buildTimelineManifest } from '../../src/timeline/fromComposition';
import { TimelineManifestSchema } from '../../src/timeline/schema';
import { TemplateRegistry } from '../../src/templates/registry';
import { SceneSlot } from '../../src/templates/schema';
import { buildHybridFfmpegArgs } from '../../src/renderer/ffmpegHybrid';
import { CompositionManifest, LayoutType, TalkingHeadLayout } from '../../src/types';

function baseManifest(overrides: Partial<CompositionManifest> = {}): CompositionManifest {
  return {
    schema: 'compose.v2',
    client_id: 'client-1',
    run_id: 'run-1',
    platform: 'tiktok',
    fps: 30,
    width: 1080,
    height: 1920,
    duration_frames: 300,
    scenes: [
      { index: 0, clip_filename: 'clip-0.mp4', duration_frames: 150, layout: 'fullscreen' },
      { index: 1, clip_filename: 'clip-1.mp4', duration_frames: 150, layout: 'fullscreen' },
    ],
    transitions: [
      { between: [0, 1], type: 'soft_cut', duration_frames: 15 },
    ],
    overlays: [
      {
        component: 'caption_bar',
        scene_index: 0,
        start_frame: 0,
        duration_frames: 60,
        props: { text: 'Caption' },
      },
    ],
    audio_track: {
      voiceover_filename: 'voiceover.mp3',
      lufs_target: -16,
      music_ducking_db: -12,
    },
    closing: {
      component: 'end_card',
      cta: { text: 'Try Tabario' },
      show_logo: true,
      start_frame: 240,
      duration_frames: 60,
    },
    ...overrides,
  };
}

function sceneLayoutForSlot(slot: SceneSlot): {
  layout: LayoutType;
  talking_head_layout?: TalkingHeadLayout;
} {
  switch (slot.required_layout) {
    case 'talking_head_full':
      return { layout: 'fullscreen', talking_head_layout: 'full' };
    case 'talking_head_pip':
      return { layout: 'fullscreen', talking_head_layout: 'pip_bottom_right' };
    case 'split':
      return { layout: 'split_horizontal' };
    case 'b_roll':
    case 'product_shot':
    case 'flexible':
      return { layout: 'fullscreen' };
  }
}

function manifestForTemplate(templateId: string): CompositionManifest {
  const template = TemplateRegistry.resolve(templateId);
  const fps = 30;
  let cursor = 0;
  const scenes = template.scene_blueprint.map((slot, index) => {
    const durationFrames = Math.round(slot.duration_target_s[0] * fps);
    cursor += durationFrames;
    return {
      index,
      clip_filename: `clip-${index}.mp4`,
      duration_frames: durationFrames,
      ...sceneLayoutForSlot(slot),
      scene_overlays: slot.required_overlay
        ? [{
          component: slot.required_overlay.component as 'kinetic_title',
          text: `${slot.role} copy`,
        }]
        : undefined,
    };
  });

  return baseManifest({
    use_case: templateId,
    fps,
    duration_frames: cursor + Math.round(template.closing.duration_s * fps),
    scenes,
    transitions: [],
    overlays: [],
    closing: {
      component: 'end_card',
      cta: { text: template.closing.cta_role },
      show_logo: true,
      start_frame: cursor,
      duration_frames: Math.round(template.closing.duration_s * fps),
    },
  });
}

describe('TimelineManifest', () => {
  it('builds a renderer-neutral timeline from the current CompositionManifest', () => {
    const timeline = buildTimelineManifest(baseManifest(), {
      availableClipFilenames: ['clip-0.mp4', 'clip-1.mp4'],
    });

    expect(timeline.schema).toBe('timeline.v1');
    expect(timeline.source_schema).toBe('compose.v2');
    expect(timeline.style_id).toBeUndefined();
    expect(timeline.tracks.video).toHaveLength(2);
    expect(timeline.tracks.video[0]).toMatchObject({
      id: 'scene:0:video',
      asset_id: 'asset:clip-0.mp4',
      start_frame: 0,
      duration_frames: 150,
      layout_id: 'layout:sequential',
    });
    expect(timeline.tracks.video[1].start_frame).toBe(150);
    expect(timeline.tracks.audio[0].asset_id).toBe('asset:voiceover.mp3');
    expect(timeline.tracks.graphics.map((clip) => clip.component)).toEqual(['caption_bar', 'end_card']);
    expect(timeline.outputs[0].filename).toBe('composed.mp4');
  });

  it('preserves style, use-case, scene overlays, music, and caption timing data', () => {
    const timeline = buildTimelineManifest(baseManifest({
      style_id: 'corporate_clean',
      use_case: 'talking_head',
      scenes: [
        {
          index: 0,
          clip_filename: 'clip-0.mp4',
          duration_frames: 300,
          layout: 'fullscreen',
          scene_overlays: [{ component: 'kinetic_title', text: 'Hook' }],
        },
      ],
      transitions: [],
      audio_track: {
        voiceover_filename: 'voiceover.mp3',
        music_source: { url: 'music.mp3' },
        lufs_target: -16,
        music_ducking_db: -12,
      },
      caption_track: {
        words: [{ word: 'Hello', start_frame: 0, end_frame: 12 }],
      },
    }));

    expect(timeline.style_id).toBe('corporate_clean');
    expect(timeline.use_case).toBe('talking_head');
    expect(timeline.tracks.audio.map((clip) => clip.id)).toEqual(['audio:voiceover', 'audio:music']);
    expect(timeline.tracks.audio[1]).toMatchObject({ asset_id: 'asset:music.mp3', gain_db: -12 });
    expect(timeline.tracks.graphics.map((clip) => clip.component)).toEqual([
      'kinetic_title',
      'caption_bar',
      'end_card',
    ]);
    expect(timeline.captions?.words).toEqual([{ word: 'Hello', start_frame: 0, end_frame: 12 }]);
  });

  it('includes all supported layout families for FFmpeg graph generation', () => {
    const timeline = buildTimelineManifest(baseManifest());
    const kinds = timeline.layouts.map((layout) => layout.kind);

    expect(kinds).toEqual(expect.arrayContaining([
      'fullscreen',
      'sequential',
      'picture_in_picture',
      'split_horizontal',
      'split_vertical',
      'talking_head_full',
      'talking_head_sidebar',
      'talking_head_pip',
    ]));
  });

  it('builds valid timeline manifests and FFmpeg graphs for all 5 use-case templates', () => {
    TemplateRegistry.list().forEach((template) => {
      const manifest = manifestForTemplate(template.id);
      const timeline = buildTimelineManifest(manifest, {
        availableClipFilenames: manifest.scenes.map((scene) => scene.clip_filename!),
      });
      const result = TimelineManifestSchema.safeParse(timeline);
      const args = buildHybridFfmpegArgs({
        timeline,
        inputDir: '/runs/run-1',
        outputPath: '/runs/run-1/composed.mp4',
      });
      const filter = args[args.indexOf('-filter_complex') + 1];

      expect(result.success).toBe(true);
      expect(timeline.use_case).toBe(template.id);
      expect(timeline.tracks.video).toHaveLength(template.scene_blueprint.length);
      expect(timeline.tracks.graphics.some((clip) => clip.component === 'end_card')).toBe(true);
      expect(filter).toContain(`color=c=black:s=${timeline.width}x${timeline.height}`);
      expect(args).toEqual(expect.arrayContaining(['-map', '[basev]']));
    });
  });

  it('maps PIP, split, and talking-head scenes to concrete layout refs', () => {
    const timeline = buildTimelineManifest(baseManifest({
      scenes: [
        { index: 0, clip_filename: 'clip-0.mp4', duration_frames: 75, layout: 'picture_in_picture' },
        { index: 1, clip_filename: 'clip-1.mp4', duration_frames: 75, layout: 'split_horizontal' },
        { index: 2, clip_filename: 'clip-2.mp4', duration_frames: 75, layout: 'split_vertical' },
        {
          index: 3,
          clip_filename: 'clip-3.mp4',
          duration_frames: 75,
          layout: 'fullscreen',
          talking_head_layout: 'sidebar',
        },
      ],
      duration_frames: 300,
      transitions: [],
    }));

    expect(timeline.tracks.video.map((clip) => clip.layout_id)).toEqual([
      'layout:picture_in_picture',
      'layout:split_horizontal',
      'layout:split_vertical',
      'layout:talking_head_sidebar',
    ]);
  });

  it('rejects missing source clips before timeline construction completes', () => {
    expect(() => buildTimelineManifest(baseManifest(), {
      availableClipFilenames: ['clip-0.mp4'],
    })).toThrow('TimelineManifest missing clips: clip-1.mp4');
  });

  it('reports bad asset references with a useful path and message', () => {
    const timeline = buildTimelineManifest(baseManifest());
    const invalid = {
      ...timeline,
      tracks: {
        ...timeline.tracks,
        video: [
          {
            ...timeline.tracks.video[0],
            asset_id: 'asset:missing.mp4',
          },
        ],
      },
    };

    const result = TimelineManifestSchema.safeParse(invalid);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['tracks', 'video', 0, 'asset_id']);
      expect(result.error.issues[0].message).toContain('references missing video asset');
    }
  });

  it('reports bad timing when a clip exceeds the output duration', () => {
    const timeline = buildTimelineManifest(baseManifest());
    const invalid = {
      ...timeline,
      tracks: {
        ...timeline.tracks,
        video: [
          {
            ...timeline.tracks.video[0],
            start_frame: 290,
            duration_frames: 30,
          },
        ],
      },
    };

    const result = TimelineManifestSchema.safeParse(invalid);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['tracks', 'video', 0, 'duration_frames']);
      expect(result.error.issues[0].message).toContain('exceeds timeline duration');
    }
  });

  it('reports invalid layout references', () => {
    const timeline = buildTimelineManifest(baseManifest());
    const invalid = {
      ...timeline,
      tracks: {
        ...timeline.tracks,
        video: [
          {
            ...timeline.tracks.video[0],
            layout_id: 'layout:missing',
          },
        ],
      },
    };

    const result = TimelineManifestSchema.safeParse(invalid);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['tracks', 'video', 0, 'layout_id']);
      expect(result.error.issues[0].message).toContain('references missing layout');
    }
  });

  it('reports duplicate asset ids', () => {
    const timeline = buildTimelineManifest(baseManifest());
    const result = TimelineManifestSchema.safeParse({
      ...timeline,
      assets: [timeline.assets[0], timeline.assets[0]],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['assets']);
      expect(result.error.issues[0].message).toContain('asset ids must be unique');
    }
  });

  it('keeps transitions frame-accurate at scene boundaries', () => {
    const timeline = buildTimelineManifest(baseManifest({
      transitions: [
        { between: [0, 1], type: 'slide_push', duration_frames: 12, direction: 'left' },
      ],
    }));

    expect(timeline.transitions[0]).toMatchObject({
      from_clip_id: 'scene:0:video',
      to_clip_id: 'scene:1:video',
      type: 'slide_push',
      duration_frames: 12,
      offset_frame: 138,
      direction: 'left',
    });
  });
});
