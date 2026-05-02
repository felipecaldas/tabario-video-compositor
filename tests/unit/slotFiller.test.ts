import { validateSlotFilling } from '../../src/manifest/slotFiller';
import { CompositionManifest } from '../../src/types';
import { UseCaseTemplate } from '../../src/templates/schema';

const makeMinimalManifest = (
  overrides: Partial<CompositionManifest> = {},
): CompositionManifest => ({
  schema: 'compose.v2',
  style_id: 'tiktok_bold',
  use_case: 'ad',
  client_id: 'client-1',
  run_id: 'run-1',
  platform: 'tiktok',
  fps: 30,
  width: 1080,
  height: 1920,
  duration_frames: 390,
  scenes: [
    {
      index: 0,
      clip_filename: '000_ComfyUI_00001_.mp4',
      duration_frames: 45,
      layout: 'fullscreen',
      scene_overlays: [
        {
          component: 'kinetic_title',
          text: 'SAVE 10 HOURS NOW',
          props: { color: '#FFFFFF' },
        },
      ],
    },
    {
      index: 1,
      clip_filename: '001_ComfyUI_00002_.mp4',
      duration_frames: 75,
      layout: 'fullscreen',
    },
    {
      index: 2,
      clip_filename: '002_ComfyUI_00003_.mp4',
      duration_frames: 60,
      layout: 'fullscreen',
      scene_overlays: [
        {
          component: 'stagger_title',
          text: 'Tabario Pro',
          props: { color: '#FFFFFF' },
        },
      ],
    },
    {
      index: 3,
      clip_filename: '003_ComfyUI_00004_.mp4',
      duration_frames: 45,
      layout: 'fullscreen',
    },
    {
      index: 4,
      clip_filename: '004_ComfyUI_00005_.mp4',
      duration_frames: 45,
      layout: 'fullscreen',
    },
    {
      index: 5,
      clip_filename: '005_ComfyUI_00006_.mp4',
      duration_frames: 30,
      layout: 'fullscreen',
      scene_overlays: [
        {
          component: 'kinetic_title',
          text: 'DOWNLOAD NOW',
          props: { color: '#FFFFFF' },
        },
      ],
    },
  ],
  transitions: [
    { between: [0, 1], type: 'scale_push', duration_frames: 12 },
    { between: [1, 2], type: 'color_wipe', duration_frames: 12, accent_color: '#FFC107' },
    { between: [2, 3], type: 'slide_push', duration_frames: 12, direction: 'left' },
    { between: [3, 4], type: 'soft_cut', duration_frames: 10 },
    { between: [4, 5], type: 'zoom_blur', duration_frames: 12 },
  ],
  overlays: [
    {
      component: 'metric_callout',
      scene_index: 3,
      start_frame: 0,
      duration_frames: 45,
      props: { metric: '10K+', label: 'Trusted by thousands', color: '#FFFFFF' },
    },
  ],
  audio_track: { voiceover_filename: 'voiceover.mp3', lufs_target: -16, music_ducking_db: -12 },
  closing: {
    component: 'end_card',
    cta: { text: 'Shop Now', url: 'https://tabario.com', show_qr: false },
    show_logo: true,
    start_frame: 300,
    duration_frames: 90,
  },
  ...overrides,
});

const makeAdTemplate = (): UseCaseTemplate => ({
  id: 'ad',
  name: 'Ad',
  description: 'Performance ad',
  scene_blueprint: [
    {
      role: 'hook',
      duration_target_s: [1, 2],
      required_layout: 'flexible',
      required_overlay: { component: 'kinetic_title', copy_role: 'hook_headline' },
      cardinality: 'one',
    },
    {
      role: 'problem',
      duration_target_s: [2, 3],
      required_layout: 'b_roll',
      cardinality: 'one',
    },
    {
      role: 'solution',
      duration_target_s: [3, 5],
      required_layout: 'product_shot',
      required_overlay: { component: 'stagger_title', copy_role: 'product_name' },
      cardinality: 'one',
    },
    {
      role: 'proof',
      duration_target_s: [2, 3],
      required_layout: 'flexible',
      required_overlay: { component: 'metric_callout', copy_role: 'proof_metric' },
      cardinality: 'one_to_many',
    },
    {
      role: 'outcome',
      duration_target_s: [2, 4],
      required_layout: 'flexible',
      cardinality: 'one',
    },
    {
      role: 'cta',
      duration_target_s: [2, 3],
      required_layout: 'product_shot',
      required_overlay: { component: 'kinetic_title', copy_role: 'cta_text' },
      cardinality: 'one',
    },
  ],
  required_assets: [
    { role: 'product_clip', type: 'clip', required: true },
    { role: 'voiceover', type: 'voiceover', required: true },
  ],
  closing: {
    component: 'end_card',
    duration_s: 3,
    cta_role: 'purchase_or_learn_more',
  },
});

describe('validateSlotFilling', () => {
  it('returns no issues for a correctly filled ad manifest', () => {
    const manifest = makeMinimalManifest();
    const template = makeAdTemplate();
    const issues = validateSlotFilling(manifest, template);
    expect(issues).toEqual([]);
  });

  it('detects missing closing when template requires it', () => {
    const manifest = makeMinimalManifest({ closing: undefined });
    const template = makeAdTemplate();
    const issues = validateSlotFilling(manifest, template);
    expect(issues).toContain('Template requires closing but manifest has no closing section');
  });

  it('detects closing when template has none', () => {
    const manifest = makeMinimalManifest();
    const template = { ...makeAdTemplate(), closing: undefined };
    const issues = validateSlotFilling(manifest, template);
    expect(issues).toContain('Template has no closing but manifest includes one');
  });

  it('detects use_case mismatch', () => {
    const manifest = makeMinimalManifest({ use_case: 'how_to' });
    const template = makeAdTemplate();
    const issues = validateSlotFilling(manifest, template);
    expect(issues.some((i) => i.includes('use_case mismatch'))).toBe(true);
  });

  it('detects missing overlay for required slot with required_overlay', () => {
    const manifest = makeMinimalManifest();
    // Remove the kinetic_title overlay from scene 0
    manifest.scenes[0] = { ...manifest.scenes[0], scene_overlays: [] };
    // Also clear overlays array
    manifest.overlays = [];
    const template = makeAdTemplate();
    const issues = validateSlotFilling(manifest, template);
    // hook requires kinetic_title, proof requires metric_callout
    expect(issues.length).toBeGreaterThan(0);
  });

  it('detects invalid style_id', () => {
    const manifest = makeMinimalManifest({ style_id: 'not_a_real_style' });
    const template = makeAdTemplate();
    const issues = validateSlotFilling(manifest, template);
    expect(issues).toContain('Invalid style_id: not_a_real_style');
  });

  it('accepts a valid style_id that differs from template id', () => {
    // style_id is not the template id (which is 'ad'), but it's a valid style
    const manifest = makeMinimalManifest({ style_id: 'tiktok_bold' });
    const template = makeAdTemplate();
    const issues = validateSlotFilling(manifest, template);
    expect(issues.filter((i) => i.includes('style_id'))).toEqual([]);
  });

  it('returns no issues for a template without closing', () => {
    const manifest = makeMinimalManifest({ closing: undefined });
    const template = { ...makeAdTemplate(), closing: undefined };
    const issues = validateSlotFilling(manifest, template);
    // It will flag use_case mismatch but that's not related to closing
    expect(issues.filter((i) => i.includes('closing'))).toEqual([]);
  });
});
