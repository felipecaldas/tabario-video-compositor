/**
 * Unit tests for src/renderer/renderWorker.ts — mocks @remotion/bundler
 * and @remotion/renderer so we can exercise the orchestration without
 * running Remotion's own renderer (which requires Chromium).
 */

jest.mock('@remotion/bundler', () => ({
  bundle: jest.fn(),
}));

jest.mock('@remotion/renderer', () => ({
  selectComposition: jest.fn(),
  renderMedia: jest.fn(),
}));

import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { renderComposition } from '../../src/renderer/renderWorker';
import { BrandProfile, CompositionManifest } from '../../src/types';

const mockBundle = bundle as unknown as jest.Mock;
const mockSelect = selectComposition as unknown as jest.Mock;
const mockRender = renderMedia as unknown as jest.Mock;

function makeManifest(): CompositionManifest {
  return {
    schema: 'compose.v1',
    client_id: 'client-1',
    run_id: 'run-abc',
    platform: 'tiktok',
    fps: 30,
    width: 720,
    height: 1280,
    duration_frames: 90,
    scenes: [],
    transitions: [],
    overlays: [],
    audio_track: {
      voiceover_filename: 'v.mp3',
      lufs_target: -16,
      music_ducking_db: -12,
    },
    closing: {
      component: 'end_card',
      cta: { text: 'Go' },
      show_logo: true,
      start_frame: 60,
      duration_frames: 30,
    },
  };
}

function makeBrand(): BrandProfile {
  return { id: 'bp-1', client_id: 'client-1' };
}

describe('renderComposition', () => {
  beforeEach(() => {
    mockBundle.mockReset().mockResolvedValue('file:///bundle-url');
    mockSelect.mockReset().mockResolvedValue({ id: 'TabarioComposition', fps: 30 });
    mockRender.mockReset().mockResolvedValue(undefined);
  });

  it('bundles, selects the composition, then renders in order', async () => {
    const order: string[] = [];
    mockBundle.mockImplementationOnce(async () => {
      order.push('bundle');
      return 'file:///bundle-url';
    });
    mockSelect.mockImplementationOnce(async () => {
      order.push('select');
      return { id: 'TabarioComposition', fps: 30 };
    });
    mockRender.mockImplementationOnce(async () => {
      order.push('render');
    });

    await renderComposition({
      manifest: makeManifest(),
      outputPath: '/tmp/out.mp4',
    });

    expect(order).toEqual(['bundle', 'select', 'render']);
  });

  it('forwards publicDir to bundler when provided', async () => {
    await renderComposition({
      manifest: makeManifest(),
      outputPath: '/tmp/out.mp4',
      publicDir: '/data/shared/run-abc',
    });
    expect(mockBundle).toHaveBeenCalledWith(
      expect.objectContaining({ publicDir: '/data/shared/run-abc' }),
    );
  });

  it('omits publicDir from bundler options when not provided', async () => {
    await renderComposition({
      manifest: makeManifest(),
      outputPath: '/tmp/out.mp4',
    });
    const firstArg = mockBundle.mock.calls[0][0];
    expect(Object.prototype.hasOwnProperty.call(firstArg, 'publicDir')).toBe(false);
  });

  it('merges brandProfile into inputProps when provided', async () => {
    const brand = makeBrand();
    await renderComposition({
      manifest: makeManifest(),
      outputPath: '/tmp/out.mp4',
      brandProfile: brand,
    });
    const selectCall = mockSelect.mock.calls[0][0];
    expect(selectCall.inputProps.brandProfile).toEqual(brand);
    const renderCall = mockRender.mock.calls[0][0];
    expect(renderCall.inputProps.brandProfile).toEqual(brand);
  });

  it('does not set a brandProfile key when not provided', async () => {
    await renderComposition({
      manifest: makeManifest(),
      outputPath: '/tmp/out.mp4',
    });
    const selectCall = mockSelect.mock.calls[0][0];
    expect(selectCall.inputProps.brandProfile).toBeUndefined();
  });

  it('passes manifest run_id / platform through as inputProps', async () => {
    const m = makeManifest();
    await renderComposition({ manifest: m, outputPath: '/tmp/out.mp4' });
    const selectCall = mockSelect.mock.calls[0][0];
    expect(selectCall.inputProps.run_id).toBe('run-abc');
    expect(selectCall.inputProps.platform).toBe('tiktok');
  });

  it('selects the TabarioComposition composition id', async () => {
    await renderComposition({ manifest: makeManifest(), outputPath: '/tmp/out.mp4' });
    expect(mockSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'TabarioComposition' }),
    );
  });

  it('passes the outputPath and h264 codec to renderMedia', async () => {
    await renderComposition({ manifest: makeManifest(), outputPath: '/tmp/out.mp4' });
    expect(mockRender).toHaveBeenCalledWith(
      expect.objectContaining({
        outputLocation: '/tmp/out.mp4',
        codec: 'h264',
      }),
    );
  });

  it('invokes onProgress with rounded percentages from renderMedia', async () => {
    const progressValues: number[] = [];
    mockRender.mockImplementationOnce(async (opts: { onProgress: (p: { progress: number }) => void }) => {
      opts.onProgress({ progress: 0 });
      opts.onProgress({ progress: 0.333 });
      opts.onProgress({ progress: 1 });
    });
    await renderComposition({
      manifest: makeManifest(),
      outputPath: '/tmp/out.mp4',
      onProgress: (p) => progressValues.push(p),
    });
    expect(progressValues).toEqual([0, 33, 100]);
  });

  it('tolerates missing onProgress callback', async () => {
    mockRender.mockImplementationOnce(async (opts: { onProgress: (p: { progress: number }) => void }) => {
      // Should not throw even though no onProgress was passed to renderComposition
      opts.onProgress({ progress: 0.5 });
    });
    await expect(
      renderComposition({ manifest: makeManifest(), outputPath: '/tmp/out.mp4' }),
    ).resolves.toBeUndefined();
  });

  it('uses headless chromium options', async () => {
    await renderComposition({ manifest: makeManifest(), outputPath: '/tmp/out.mp4' });
    const opts = mockRender.mock.calls[0][0];
    expect(opts.chromiumOptions.headless).toBe(true);
  });

  it('propagates bundler errors unchanged', async () => {
    mockBundle.mockReset().mockRejectedValueOnce(new Error('bundle exploded'));
    await expect(
      renderComposition({ manifest: makeManifest(), outputPath: '/tmp/out.mp4' }),
    ).rejects.toThrow('bundle exploded');
  });

  it('propagates renderMedia errors unchanged', async () => {
    mockRender.mockReset().mockRejectedValueOnce(new Error('render exploded'));
    await expect(
      renderComposition({ manifest: makeManifest(), outputPath: '/tmp/out.mp4' }),
    ).rejects.toThrow('render exploded');
  });
});
