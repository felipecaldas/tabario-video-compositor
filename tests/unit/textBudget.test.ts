import { CompositionManifestSchema } from '../../src/manifest/schema';

const BASE_MANIFEST = {
  schema: 'compose.v1' as const,
  client_id: 'client-1',
  run_id: 'run-1',
  platform: 'tiktok',
  fps: 30,
  width: 1080,
  height: 1920,
  duration_frames: 300,
  transitions: [],
  overlays: [],
  audio_track: { voiceover_filename: 'voiceover.mp3', lufs_target: -16, music_ducking_db: -12 },
  closing: {
    component: 'end_card' as const,
    cta: { text: 'Try Tabario', show_qr: false },
    show_logo: true,
    start_frame: 210,
    duration_frames: 90,
  },
};

describe('image_text_density schema field', () => {
  it('accepts valid density values on a scene', () => {
    for (const density of ['none', 'low', 'medium', 'high'] as const) {
      const manifest = {
        ...BASE_MANIFEST,
        scenes: [{
          index: 0,
          clip_filename: 'image_000.png',
          duration_frames: 120,
          layout: 'fullscreen' as const,
          image_text_density: density,
        }],
      };
      expect(CompositionManifestSchema.safeParse(manifest).success).toBe(true);
    }
  });

  it('rejects invalid density values', () => {
    const manifest = {
      ...BASE_MANIFEST,
      scenes: [{
        index: 0,
        clip_filename: 'image_000.png',
        duration_frames: 120,
        layout: 'fullscreen' as const,
        image_text_density: 'extreme',
      }],
    };
    expect(CompositionManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it('is optional — scene without density still validates', () => {
    const manifest = {
      ...BASE_MANIFEST,
      scenes: [{
        index: 0,
        clip_filename: 'video_000.mp4',
        duration_frames: 120,
        layout: 'fullscreen' as const,
      }],
    };
    expect(CompositionManifestSchema.safeParse(manifest).success).toBe(true);
  });
});

describe('motion field schema', () => {
  it('accepts ken_burns and static', () => {
    for (const motion of ['ken_burns', 'static'] as const) {
      const manifest = {
        ...BASE_MANIFEST,
        scenes: [{
          index: 0, clip_filename: 'image_000.png', duration_frames: 120,
          layout: 'fullscreen' as const, motion,
        }],
      };
      expect(CompositionManifestSchema.safeParse(manifest).success).toBe(true);
    }
  });
});

describe('talking_head_layout field schema', () => {
  it('accepts full, sidebar, pip_bottom_right', () => {
    for (const layout of ['full', 'sidebar', 'pip_bottom_right'] as const) {
      const manifest = {
        ...BASE_MANIFEST,
        scenes: [{
          index: 0, clip_filename: 'talking_head_000.mp4', duration_frames: 120,
          layout: 'fullscreen' as const, talking_head_layout: layout,
        }],
      };
      expect(CompositionManifestSchema.safeParse(manifest).success).toBe(true);
    }
  });
});

describe('new transition types', () => {
  const sceneBase = [{
    index: 0, clip_filename: 'video_000.mp4', duration_frames: 150, layout: 'fullscreen' as const,
  }, {
    index: 1, clip_filename: 'video_001.mp4', duration_frames: 150, layout: 'fullscreen' as const,
  }];

  it('accepts slide_push with direction', () => {
    const manifest = {
      ...BASE_MANIFEST,
      scenes: sceneBase,
      transitions: [{ between: [0, 1] as [number, number], type: 'slide_push' as const, duration_frames: 15, direction: 'right' as const }],
    };
    expect(CompositionManifestSchema.safeParse(manifest).success).toBe(true);
  });

  it('accepts zoom_blur', () => {
    const manifest = {
      ...BASE_MANIFEST,
      scenes: sceneBase,
      transitions: [{ between: [0, 1] as [number, number], type: 'zoom_blur' as const, duration_frames: 20 }],
    };
    expect(CompositionManifestSchema.safeParse(manifest).success).toBe(true);
  });

  it('accepts deprecated slide alias', () => {
    const manifest = {
      ...BASE_MANIFEST,
      scenes: sceneBase,
      transitions: [{ between: [0, 1] as [number, number], type: 'slide' as const, duration_frames: 15 }],
    };
    expect(CompositionManifestSchema.safeParse(manifest).success).toBe(true);
  });

  it('still rejects invalid transition types', () => {
    const manifest = {
      ...BASE_MANIFEST,
      scenes: sceneBase,
      transitions: [{ between: [0, 1], type: 'dissolve', duration_frames: 15 }],
    };
    expect(CompositionManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it('accepts brand_accent_line and motion_badge as overlay components', () => {
    const manifest = {
      ...BASE_MANIFEST,
      scenes: sceneBase,
      overlays: [
        { component: 'brand_accent_line' as const, scene_index: 0, start_frame: 0, duration_frames: 60, props: {} },
        { component: 'motion_badge' as const, scene_index: 1, start_frame: 150, duration_frames: 45, props: { text: '10x ROI' } },
      ],
    };
    expect(CompositionManifestSchema.safeParse(manifest).success).toBe(true);
  });
});
