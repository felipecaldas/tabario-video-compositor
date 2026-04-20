import { buildFfmpegArgs } from '../../src/postprocess/ffmpeg';

describe('buildFfmpegArgs', () => {
  it('uses default LUFS and ducking when no audioTargets provided', () => {
    const args = buildFfmpegArgs({ inputPath: '/in.mp4', outputPath: '/out.mp4' });
    expect(args).toContain('-16');
    expect(args).toContain('-12');
    expect(args[args.indexOf('-i') + 1]).toBe('/in.mp4');
    expect(args[args.length - 1]).toBe('/out.mp4');
  });

  it('uses audioTargets values when provided', () => {
    const args = buildFfmpegArgs({
      inputPath: '/in.mp4',
      outputPath: '/out.mp4',
      audioTargets: { voiceover_lufs: -14, music_ducking_db: -10 },
    });
    expect(args).toContain('-14');
    expect(args).toContain('-10');
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
