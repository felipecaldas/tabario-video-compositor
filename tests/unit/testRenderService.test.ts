import { buildStubManifest, applyOverrides, ClipMeta } from '../../src/services/testRenderService';
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
