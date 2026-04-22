import { CompositionManifestSchema, TextOverlaySchema } from '../../src/manifest/schema';

describe('TextOverlaySchema', () => {
  it('parses valid kinetic_title overlay', () => {
    const overlay = {
      component: 'kinetic_title' as const,
      text: 'PROBLEM',
      props: { color: '#FF6B6B', size: 96 }
    };
    const result = TextOverlaySchema.safeParse(overlay);
    expect(result.success).toBe(true);
  });

  it('parses valid stagger_title overlay', () => {
    const overlay = {
      component: 'stagger_title' as const,
      text: 'The Solution',
      props: { color: '#FFFFFF' }
    };
    const result = TextOverlaySchema.safeParse(overlay);
    expect(result.success).toBe(true);
  });

  it('parses valid caption_bar overlay', () => {
    const overlay = {
      component: 'caption_bar' as const,
      text: 'Subtitle text here'
    };
    const result = TextOverlaySchema.safeParse(overlay);
    expect(result.success).toBe(true);
  });

  it('parses overlay without props', () => {
    const overlay = {
      component: 'kinetic_title' as const,
      text: 'Simple Text'
    };
    const result = TextOverlaySchema.safeParse(overlay);
    expect(result.success).toBe(true);
  });

  it('rejects invalid component type', () => {
    const overlay = {
      component: 'invalid_component',
      text: 'Test'
    };
    const result = TextOverlaySchema.safeParse(overlay);
    expect(result.success).toBe(false);
  });

  it('rejects missing text field', () => {
    const overlay = {
      component: 'kinetic_title' as const
    };
    const result = TextOverlaySchema.safeParse(overlay);
    expect(result.success).toBe(false);
  });
});

describe('CompositionManifestSchema - scene_overlays', () => {
  const manifestWithSceneOverlays = {
    schema: 'compose.v1' as const,
    client_id: 'client-1',
    run_id: 'run-1',
    platform: 'linkedin',
    fps: 30,
    width: 720,
    height: 1280,
    duration_frames: 90,
    scenes: [
      {
        index: 0,
        clip_filename: 'video_000.mp4',
        duration_frames: 90,
        layout: 'fullscreen' as const,
        scene_overlays: [
          { component: 'kinetic_title' as const, text: 'PROBLEM', props: { color: '#FF0000' } }
        ]
      }
    ],
    transitions: [],
    overlays: [],
    audio_track: {
      voiceover_filename: 'voiceover.mp3',
      lufs_target: -16,
      music_ducking_db: -12,
    },
    closing: {
      component: 'end_card' as const,
      cta: { text: 'Try it' },
      show_logo: true,
      start_frame: 90,
      duration_frames: 30,
    },
  };

  it('parses manifest with scene_overlays', () => {
    const result = CompositionManifestSchema.safeParse(manifestWithSceneOverlays);
    expect(result.success).toBe(true);
  });

  it('parses manifest with multiple scene_overlays', () => {
    const manifest = {
      ...manifestWithSceneOverlays,
      scenes: [
        {
          ...manifestWithSceneOverlays.scenes[0],
          scene_overlays: [
            { component: 'kinetic_title' as const, text: 'Title 1' },
            { component: 'caption_bar' as const, text: 'Caption' }
          ]
        }
      ]
    };
    const result = CompositionManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });
});

describe('CompositionManifestSchema - typographic scenes', () => {
  const typographicManifest = {
    schema: 'compose.v1' as const,
    client_id: 'client-1',
    run_id: 'run-1',
    platform: 'instagram',
    fps: 30,
    width: 1080,
    height: 1920,
    duration_frames: 60,
    scenes: [
      {
        index: 0,
        clip_filename: undefined, // Typographic scene - no video
        duration_frames: 60,
        layout: 'fullscreen' as const,
        scene_overlays: [
          { component: 'stagger_title' as const, text: 'The moment everything changes.' }
        ]
      }
    ],
    transitions: [],
    overlays: [],
    audio_track: {
      voiceover_filename: 'voiceover.mp3',
      lufs_target: -16,
      music_ducking_db: -12,
    },
    closing: {
      component: 'end_card' as const,
      cta: { text: 'Learn more' },
      show_logo: true,
      start_frame: 60,
      duration_frames: 30,
    },
  };

  it('parses manifest with optional clip_filename (typographic scene)', () => {
    const result = CompositionManifestSchema.safeParse(typographicManifest);
    expect(result.success).toBe(true);
  });

  it('parses manifest without clip_filename field', () => {
    const manifest = {
      ...typographicManifest,
      scenes: [
        {
          index: 0,
          duration_frames: 60,
          layout: 'fullscreen' as const,
          scene_overlays: [
            { component: 'stagger_title' as const, text: 'Pure typographic' }
          ]
        }
      ]
    };
    const result = CompositionManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });

  it('still accepts manifest with clip_filename', () => {
    const manifest = {
      ...typographicManifest,
      scenes: [
        {
          index: 0,
          clip_filename: 'video_000.mp4',
          duration_frames: 60,
          layout: 'fullscreen' as const
        }
      ]
    };
    const result = CompositionManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });
});

describe('CompositionManifestSchema - typographic_background component', () => {
  it('accepts typographic_background in overlays', () => {
    const manifest = {
      schema: 'compose.v1' as const,
      client_id: 'client-1',
      run_id: 'run-1',
      platform: 'tiktok',
      fps: 30,
      width: 1080,
      height: 1920,
      duration_frames: 90,
      scenes: [
        { index: 0, clip_filename: 'video_000.mp4', duration_frames: 90, layout: 'fullscreen' as const }
      ],
      transitions: [],
      overlays: [
        {
          component: 'typographic_background' as const,
          scene_index: 0,
          start_frame: 0,
          duration_frames: 90,
          props: { text: 'Background Text', color: '#FF0000' }
        }
      ],
      audio_track: {
        voiceover_filename: 'voiceover.mp3',
        lufs_target: -16,
        music_ducking_db: -12,
      },
      closing: {
        component: 'end_card' as const,
        cta: { text: 'CTA' },
        show_logo: true,
        start_frame: 90,
        duration_frames: 30,
      },
    };
    const result = CompositionManifestSchema.safeParse(manifest);
    expect(result.success).toBe(true);
  });
});
