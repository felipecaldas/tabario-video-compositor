jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

import { execFile } from 'child_process';
import { applyPostProcessing, buildFfmpegArgs } from '../../src/postprocess/ffmpeg';

const mockExecFile = execFile as unknown as jest.Mock;

describe('buildFfmpegArgs', () => {
  it('uses default LUFS when no audioTargets provided', () => {
    const args = buildFfmpegArgs({ inputPath: '/in.mp4', outputPath: '/out.mp4' });
    const afFilter = args[args.indexOf('-af') + 1];
    expect(afFilter).toContain('I=-16');
    expect(args[args.indexOf('-i') + 1]).toBe('/in.mp4');
    expect(args[args.length - 1]).toBe('/out.mp4');
  });

  it('uses audioTargets voiceover_lufs when provided', () => {
    const args = buildFfmpegArgs({
      inputPath: '/in.mp4',
      outputPath: '/out.mp4',
      audioTargets: { voiceover_lufs: -14, music_ducking_db: -10 },
    });
    const afFilter = args[args.indexOf('-af') + 1];
    expect(afFilter).toContain('I=-14');
  });

  it('does NOT attenuate the mix with volume= (ducking handled upstream in Remotion)', () => {
    const args = buildFfmpegArgs({
      inputPath: '/in.mp4',
      outputPath: '/out.mp4',
      audioTargets: { voiceover_lufs: -16, music_ducking_db: -10 },
    });
    const afFilter = args[args.indexOf('-af') + 1];
    expect(afFilter).not.toMatch(/volume=.*dB/);
  });

  it('produces EBU R128-compliant loudnorm flags (LRA, TP)', () => {
    const args = buildFfmpegArgs({ inputPath: '/in.mp4', outputPath: '/out.mp4' });
    const afFilter = args[args.indexOf('-af') + 1];
    expect(afFilter).toContain('LRA=11');
    expect(afFilter).toContain('TP=-1.5');
  });

  it('includes H.264 codec and faststart flags', () => {
    const args = buildFfmpegArgs({ inputPath: '/in.mp4', outputPath: '/out.mp4' });
    expect(args).toContain('libx264');
    expect(args).toContain('+faststart');
  });

  it('includes AAC audio codec at 192k', () => {
    const args = buildFfmpegArgs({ inputPath: '/in.mp4', outputPath: '/out.mp4' });
    const aIdx = args.indexOf('-c:a');
    expect(args[aIdx + 1]).toBe('aac');
    const bIdx = args.indexOf('-b:a');
    expect(args[bIdx + 1]).toBe('192k');
  });

  it('includes -y overwrite flag', () => {
    const args = buildFfmpegArgs({ inputPath: '/in.mp4', outputPath: '/out.mp4' });
    expect(args).toContain('-y');
  });
});

describe('applyPostProcessing', () => {
  beforeEach(() => {
    mockExecFile.mockReset();
  });

  function queueExecFile(stderr = ''): void {
    mockExecFile.mockImplementationOnce(
      (_cmd: string, _args: string[], cb: (err: Error | null, res: { stdout: string; stderr: string }) => void) => {
        cb(null, { stdout: '', stderr });
      },
    );
  }

  function queueExecFileError(message: string): void {
    mockExecFile.mockImplementationOnce(
      (_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
        cb(new Error(message));
      },
    );
  }

  it('invokes ffmpeg with the built argument list', async () => {
    queueExecFile();
    await applyPostProcessing({
      inputPath: '/run/raw.mp4',
      outputPath: '/run/final.mp4',
    });
    expect(mockExecFile).toHaveBeenCalledTimes(1);
    const [bin, args] = mockExecFile.mock.calls[0];
    expect(bin).toBe('ffmpeg');
    expect(args).toContain('/run/raw.mp4');
    expect(args).toContain('/run/final.mp4');
    expect(args).toContain('libx264');
  });

  it('passes the configured voiceover_lufs through to the loudnorm filter', async () => {
    queueExecFile();
    await applyPostProcessing({
      inputPath: '/a.mp4',
      outputPath: '/b.mp4',
      audioTargets: { voiceover_lufs: -14, music_ducking_db: -12 },
    });
    const [, args] = mockExecFile.mock.calls[0];
    const af = args[args.indexOf('-af') + 1];
    expect(af).toContain('I=-14');
  });

  it('logs ffmpeg stderr at debug level without rejecting', async () => {
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    queueExecFile('some ffmpeg warning');
    await expect(
      applyPostProcessing({ inputPath: '/a.mp4', outputPath: '/b.mp4' }),
    ).resolves.toBeUndefined();
    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining('some ffmpeg warning'),
    );
    debugSpy.mockRestore();
  });

  it('wraps execFile failures in a descriptive error', async () => {
    queueExecFileError('exit code 1');
    await expect(
      applyPostProcessing({ inputPath: '/a.mp4', outputPath: '/b.mp4' }),
    ).rejects.toThrow(/FFmpeg post-processing failed.*exit code 1/);
  });
});
