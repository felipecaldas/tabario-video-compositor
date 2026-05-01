import { normalizeAdManifest } from '../../src/manifest/adEngagement';
import { BrandProfile, Brief, CompositionManifest } from '../../src/types';

function makeBrand(): BrandProfile {
  return {
    id: 'bp-1',
    client_id: 'client-1',
    brand_colors: { accent: '#FF5500' },
    cta_defaults: { show_qr: true },
  };
}

function makeBrief(): Brief {
  return {
    hook: 'Stop wasting hours',
    call_to_action: 'Learn more',
    platform_briefs: [],
  };
}

function makeManifest(sceneCount = 6): CompositionManifest {
  return {
    schema: 'compose.v2',
    client_id: 'client-1',
    run_id: 'run-1',
    platform: 'tiktok',
    fps: 30,
    width: 1080,
    height: 1920,
    duration_frames: 540,
    use_case: 'ad',
    scenes: Array.from({ length: sceneCount }, (_, index) => ({
      index,
      clip_filename: `clip-${index}.mp4`,
      duration_frames: 90,
      layout: 'fullscreen' as const,
      scene_overlays: index === 3
        ? [{ component: 'caption_bar' as const, text: '10,000+ customers' }]
        : undefined,
    })),
    transitions: [],
    overlays: [],
    audio_track: {
      voiceover_filename: 'voiceover.mp3',
      lufs_target: -16,
      music_ducking_db: -12,
    },
    closing: {
      component: 'end_card',
      cta: { text: 'Learn more' },
      show_logo: true,
      start_frame: 450,
      duration_frames: 90,
    },
  };
}

describe('normalizeAdManifest', () => {
  it('caps scene durations, enforces transitions, and makes CTA imperative', () => {
    const result = normalizeAdManifest(makeManifest(), makeBrief(), makeBrand());

    expect(result.manifest.transitions.map((transition) => transition.type)).toEqual([
      'scale_push',
      'color_wipe',
      'slide_push',
      'soft_cut',
      'zoom_blur',
    ]);
    expect(result.manifest.transitions[1].accent_color).toBe('#FF5500');
    expect(result.manifest.scenes[0].duration_frames).toBe(45);
    expect(result.manifest.scenes[1].duration_frames).toBe(90);
    expect(result.manifest.scenes[3].duration_frames).toBe(75);
    expect(result.manifest.overlays.some((overlay) => overlay.component === 'metric_callout')).toBe(true);
    expect(result.manifest.closing?.cta.text).toBe('Shop Now');
    expect(result.report.cta_text).toBe('Shop Now');
  });

  it('removes outcome overlays and adds a CTA kinetic title', () => {
    const manifest = makeManifest();
    manifest.overlays = [
      {
        component: 'motion_badge',
        scene_index: 4,
        start_frame: 360,
        duration_frames: 90,
        props: { text: 'should disappear' },
      },
    ];

    const result = normalizeAdManifest(manifest, makeBrief(), makeBrand());

    expect(result.manifest.overlays.some((overlay) => overlay.scene_index === 4)).toBe(false);
    expect(
      result.manifest.overlays.find((overlay) => overlay.scene_index === 5 && overlay.component === 'kinetic_title'),
    ).toBeDefined();
  });

  it('passes through non-ad manifests unchanged', () => {
    const manifest = { ...makeManifest(), use_case: 'thought_leadership' };
    const result = normalizeAdManifest(manifest, makeBrief(), makeBrand());

    expect(result.manifest).toBe(manifest);
    expect(result.report.normalized).toBe(false);
  });
});
