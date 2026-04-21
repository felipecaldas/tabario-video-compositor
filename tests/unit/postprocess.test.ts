import { buildFfmpegArgs } from '../../src/postprocess/ffmpeg';

describe('buildFfmpegArgs', () => {
  it('uses default LUFS and ducking when no audioTargets provided', () => {
    const args = buildFfmpegArgs({ inputPath: '/in.mp4', outputPath: '/out.mp4' });
    const afFilter = args[args.indexOf('-af') + 1];
    expect(afFilter).toContain('I=-16');
    expect(afFilter).toContain('volume=-12dB');
    expect(args[args.indexOf('-i') + 1]).toBe('/in.mp4');
    expect(args[args.length - 1]).toBe('/out.mp4');
  });

  it('uses audioTargets values when provided', () => {
    const args = buildFfmpegArgs({
      inputPath: '/in.mp4',
      outputPath: '/out.mp4',
      audioTargets: { voiceover_lufs: -14, music_ducking_db: -10 },
    });
    const afFilter = args[args.indexOf('-af') + 1];
    expect(afFilter).toContain('I=-14');
    expect(afFilter).toContain('volume=-10dB');
  });

  it('includes H.264 codec and faststart flags', () => {
    const args = buildFfmpegArgs({ inputPath: '/in.mp4', outputPath: '/out.mp4' });
    expect(args).toContain('libx264');
    expect(args).toContain('+faststart');
  });

  it('includes -y overwrite flag', () => {
    const args = buildFfmpegArgs({ inputPath: '/in.mp4', outputPath: '/out.mp4' });
    expect(args).toContain('-y');
  });
});
