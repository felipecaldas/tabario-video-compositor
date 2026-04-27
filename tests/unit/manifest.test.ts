import { CompositionManifestSchema, TextOverlaySchema } from '../../src/manifest/schema';

const VALID_MANIFEST = {
  schema: 'compose.v1' as const,
  client_id: 'client-1',
  run_id: 'run-1',
  platform: 'tiktok',
  fps: 30,
  width: 1080,
  height: 1920,
  duration_frames: 300,
  scenes: [
    { index: 0, clip_filename: 'video_000.mp4', duration_frames: 150, layout: 'fullscreen' as const },
    { index: 1, clip_filename: 'video_001.mp4', duration_frames: 150, layout: 'fullscreen' as const },
  ],
  transitions: [
    { between: [0, 1] as [number, number], type: 'soft_cut' as const, duration_frames: 15 },
  ],
  overlays: [
    {
      component: 'kinetic_title' as const,
      scene_index: 0,
      start_frame: 0,
      duration_frames: 60,
      props: { text: 'Hook text' },
    },
  ],
  audio_track: {
    voiceover_filename: 'voiceover.mp3',
    lufs_target: -16,
    music_ducking_db: -12,
  },
  closing: {
    component: 'end_card' as const,
    cta: { text: 'Try Tabario', url: 'https://tabario.com', show_qr: false },
    show_logo: true,
    start_frame: 210,
    duration_frames: 90,
  },
};

describe('CompositionManifestSchema', () => {
  it('parses a valid manifest', () => {
    const result = CompositionManifestSchema.safeParse(VALID_MANIFEST);
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields', () => {
    const { client_id, ...withoutClientId } = VALID_MANIFEST;
    const result = CompositionManifestSchema.safeParse(withoutClientId);
    expect(result.success).toBe(false);
  });

  it('rejects invalid transition type', () => {
    const invalid = {
      ...VALID_MANIFEST,
      transitions: [{ between: [0, 1], type: 'dissolve', duration_frames: 15 }],
    };
    const result = CompositionManifestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects empty scenes array', () => {
    const invalid = { ...VALID_MANIFEST, scenes: [] };
    const result = CompositionManifestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects unknown schema literal', () => {
    const invalid = { ...VALID_MANIFEST, schema: 'compose.v0' };
    const result = CompositionManifestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('accepts compose.v2 schema literal', () => {
    const v2 = { ...VALID_MANIFEST, schema: 'compose.v2' as const, style_id: 'tiktok_bold' };
    const result = CompositionManifestSchema.safeParse(v2);
    expect(result.success).toBe(true);
  });

  it('defaults style_id to corporate_clean when omitted', () => {
    const result = CompositionManifestSchema.safeParse(VALID_MANIFEST);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.style_id).toBe('corporate_clean');
    }
  });

  it('accepts optional use_case field', () => {
    const withUseCase = { ...VALID_MANIFEST, use_case: 'ad' };
    const result = CompositionManifestSchema.safeParse(withUseCase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.use_case).toBe('ad');
    }
  });
});
