import { buildStubManifest, buildTemplateManifest, applyOverrides, ClipMeta } from '../../src/services/testRenderService';
import { CompositionManifestSchema } from '../../src/manifest/schema';

const makeClips = (n: number, ext = 'mp4'): ClipMeta[] =>
  Array.from({ length: n }, (_, i) => ({ filename: `video_${String(i).padStart(3, '0')}.${ext}`, index: i }));

describe('buildStubManifest', () => {
  it('produces a schema-valid manifest for 1 clip', () => {
    const clips = makeClips(1);
    const manifest = buildStubManifest(clips, 'tiktok', 'run-1', 'client-1');
    expect(CompositionManifestSchema.safeParse(manifest).success).toBe(true);
  });

  it('produces a schema-valid manifest for 3 clips', () => {
    const clips = makeClips(3);
    const manifest = buildStubManifest(clips, 'tiktok', 'run-1', 'client-1');
    expect(CompositionManifestSchema.safeParse(manifest).success).toBe(true);
    expect(manifest.scenes).toHaveLength(3);
    expect(manifest.transitions).toHaveLength(2);
  });

  it('produces a schema-valid manifest for 6 clips', () => {
    const clips = makeClips(6);
    const manifest = buildStubManifest(clips, 'tiktok', 'run-1', 'client-1');
    expect(CompositionManifestSchema.safeParse(manifest).success).toBe(true);
    expect(manifest.scenes).toHaveLength(6);
    expect(manifest.transitions).toHaveLength(5);
  });

  it('uses 9:16 dimensions for tiktok', () => {
    const manifest = buildStubManifest(makeClips(1), 'tiktok', 'run-1', 'client-1');
    expect(manifest.width).toBe(1080);
    expect(manifest.height).toBe(1920);
  });

  it('uses 16:9 dimensions for non-vertical platforms', () => {
    const manifest = buildStubManifest(makeClips(1), 'youtube', 'run-1', 'client-1');
    expect(manifest.width).toBe(1920);
    expect(manifest.height).toBe(1080);
  });

  it('uses 1:1 dimensions for x_square', () => {
    const manifest = buildStubManifest(makeClips(1), 'x_square', 'run-1', 'client-1');
    expect(manifest.width).toBe(1080);
    expect(manifest.height).toBe(1080);
  });

  it('total duration = scenes + closing', () => {
    const clips = makeClips(3);
    const manifest = buildStubManifest(clips, 'tiktok', 'run-1', 'client-1');
    const sceneDuration = manifest.scenes.reduce((s, sc) => s + sc.duration_frames, 0);
    expect(manifest.duration_frames).toBe(sceneDuration + manifest.closing.duration_frames);
    expect(manifest.closing.start_frame).toBe(sceneDuration);
  });
});

describe('buildTemplateManifest', () => {
  const makeClipsN = (n: number): ClipMeta[] =>
    Array.from({ length: n }, (_, i) => ({ filename: `video_${String(i).padStart(3, '0')}.mp4`, index: i }));

  it('throws for unknown template id', () => {
    expect(() => buildTemplateManifest('not_a_template', makeClipsN(3), 'tiktok', 'r', 'c')).toThrow(
      "Unknown template id 'not_a_template'",
    );
  });

  it('produces a Zod-valid manifest for all 5 templates with 6 clips', () => {
    const clips = makeClipsN(6);
    for (const id of ['ad', 'how_to', 'property_tour', 'talking_head', 'thought_leadership']) {
      const manifest = buildTemplateManifest(id, clips, 'tiktok', 'run-1', 'client-1');
      const result = CompositionManifestSchema.safeParse(manifest);
      expect(result.success).toBe(true);
    }
  });

  it('ad blueprint: scene roles in order (hook → problem → solution → proof×N → outcome → cta)', () => {
    // 7 clips: 5 one-slots (hook/problem/solution/outcome/cta) + 2 extra → proof gets 3 scenes
    const manifest = buildTemplateManifest('ad', makeClipsN(7), 'tiktok', 'run-1', 'client-1');
    // Overlays are omitted in stub/template mode — no real copy exists yet
    expect(manifest.scenes[0].scene_overlays).toBeUndefined();
    expect(manifest.scenes[manifest.scenes.length - 1].scene_overlays).toBeUndefined();
    // Total scenes = 5 one-slots + 2 extra-proof = 7
    expect(manifest.scenes).toHaveLength(7);
  });

  it('how_to distributes extra clips across the step (one_to_many) slot', () => {
    // 2 one-slots (intro, recap) + 1 many-slot (step) → 4 clips → step gets 2 scenes
    const manifest = buildTemplateManifest('how_to', makeClipsN(4), 'tiktok', 'run-1', 'client-1');
    expect(manifest.scenes).toHaveLength(4);
    // intro uses fullscreen layout, step uses flexible (fullscreen), recap uses fullscreen
    expect(manifest.scenes[0].layout).toBe('fullscreen');
  });

  it('talking_head scenes use correct talking_head_layout values', () => {
    const manifest = buildTemplateManifest('talking_head', makeClipsN(4), 'tiktok', 'run-1', 'client-1');
    // intro → full, argument (one_to_many) → pip_bottom_right, close → full
    const layouts = manifest.scenes.map((s) => s.talking_head_layout);
    expect(layouts[0]).toBe('full');
    // Middle scenes are argument slots (pip)
    expect(layouts[1]).toBe('pip_bottom_right');
    // Last scene is close → full
    expect(layouts[layouts.length - 1]).toBe('full');
  });

  it('sets use_case field on the manifest', () => {
    const manifest = buildTemplateManifest('ad', makeClipsN(5), 'tiktok', 'run-1', 'client-1');
    expect(manifest.use_case).toBe('ad');
  });

  it('sets schema to compose.v2', () => {
    const manifest = buildTemplateManifest('how_to', makeClipsN(3), 'tiktok', 'run-1', 'client-1');
    expect(manifest.schema).toBe('compose.v2');
  });

  it('total duration = sum of scenes + closing', () => {
    const manifest = buildTemplateManifest('property_tour', makeClipsN(5), 'tiktok', 'run-1', 'client-1');
    const scenesTotal = manifest.scenes.reduce((s, sc) => s + sc.duration_frames, 0);
    expect(manifest.duration_frames).toBe(scenesTotal + manifest.closing.duration_frames);
    expect(manifest.closing.start_frame).toBe(scenesTotal);
  });

  it('works with minimal 1 clip (cycles as needed)', () => {
    for (const id of ['ad', 'how_to', 'property_tour', 'talking_head', 'thought_leadership']) {
      const manifest = buildTemplateManifest(id, makeClipsN(1), 'tiktok', 'run-1', 'client-1');
      expect(CompositionManifestSchema.safeParse(manifest).success).toBe(true);
      expect(manifest.scenes.length).toBeGreaterThan(0);
    }
  });
});

describe('applyOverrides', () => {
  it('patches all transitions when transition override is given', () => {
    const manifest = buildStubManifest(makeClips(3), 'tiktok', 'run-1', 'client-1');
    const patched = applyOverrides(manifest, { transition: 'zoom_blur' });
    expect(patched.transitions.every((t) => t.type === 'zoom_blur')).toBe(true);
  });

  it('patches all scenes when scene overrides are given', () => {
    const manifest = buildStubManifest(makeClips(2), 'tiktok', 'run-1', 'client-1');
    const patched = applyOverrides(manifest, { motion: 'ken_burns', image_text_density: 'high' });
    expect(patched.scenes.every((s) => s.motion === 'ken_burns')).toBe(true);
    expect(patched.scenes.every((s) => s.image_text_density === 'high')).toBe(true);
  });

  it('does not mutate the original manifest', () => {
    const manifest = buildStubManifest(makeClips(2), 'tiktok', 'run-1', 'client-1');
    const original = JSON.parse(JSON.stringify(manifest));
    applyOverrides(manifest, { transition: 'slide_push' });
    expect(manifest).toEqual(original);
  });
});
