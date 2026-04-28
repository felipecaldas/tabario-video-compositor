/**
 * Unit tests for ensureH264 and deterministic clip-normalization args.
 */

import { execFile } from 'child_process';
import { buildNormalizeClipArgs, ensureH264 } from '../../src/postprocess/ffmpeg';

jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

const mockExecFile = execFile as unknown as jest.Mock;

let execFileCalls: Array<{ cmd: string; args: string[] }> = [];

function hasArg(args: string[], value: string): boolean {
  return args.some((arg) => arg.includes(value));
}

beforeEach(() => {
  execFileCalls = [];
  mockExecFile.mockImplementation((cmd: string, args: string[], callback: Function) => {
    execFileCalls.push({ cmd, args });

    if (cmd === 'ffprobe' && hasArg(args, 'codec_name')) {
      callback(null, { stdout: 'h264\n', stderr: '' });
      return;
    }

    if (cmd === 'ffprobe' && hasArg(args, 'avg_frame_rate')) {
      callback(null, { stdout: '30/1\n', stderr: '' });
      return;
    }

    if (cmd === 'ffmpeg') {
      callback(null, { stdout: '', stderr: '' });
      return;
    }

    callback(new Error('Unknown command'), { stdout: '', stderr: '' });
  });
});

describe('ensureH264', () => {
  it('skips transcoding when the probe reports an already-normalized h264 clip', async () => {
    const result = await ensureH264('/data/shared/run/video_000_cfr30_h264.mp4', 30);

    expect(result).toBe('/data/shared/run/video_000_cfr30_h264.mp4');
    expect(execFileCalls).toHaveLength(2);
    expect(execFileCalls.every((c) => c.cmd === 'ffprobe')).toBe(true);
  });

  it('normalizes when probe reports hevc and returns the CFR H.264 suffixed path', async () => {
    let callCount = 0;
    mockExecFile.mockImplementation((cmd: string, args: string[], callback: Function) => {
      execFileCalls.push({ cmd, args });

      if (callCount === 0 && cmd === 'ffprobe' && hasArg(args, 'codec_name')) {
        callCount++;
        callback(null, { stdout: 'hevc\n', stderr: '' });
        return;
      }

      if (callCount === 1 && cmd === 'ffprobe' && hasArg(args, 'avg_frame_rate')) {
        callCount++;
        callback(null, { stdout: '30/1\n', stderr: '' });
        return;
      }

      if (callCount === 2 && cmd === 'ffmpeg') {
        callCount++;
        callback(null, { stdout: '', stderr: '' });
        return;
      }

      callback(new Error('Unexpected call'), { stdout: '', stderr: '' });
    });

    const result = await ensureH264('/data/shared/run/video_000.mp4');
    expect(result).toBe('/data/shared/run/video_000_cfr30_h264.mp4');
    expect(execFileCalls).toHaveLength(3);

    const transcodeArgs = execFileCalls[2].args;
    expect(transcodeArgs).toContain('libx264');
    expect(transcodeArgs).toContain('yuv420p');
    expect(transcodeArgs).toContain('+faststart');
    expect(transcodeArgs).toContain('-fps_mode');
    expect(transcodeArgs).toContain('cfr');
    expect(transcodeArgs).toContain('setpts=N/(30*TB)');
    expect(transcodeArgs).not.toContain('-force_key_frames');
  });

  it('normalizes when ffprobe fails', async () => {
    let callCount = 0;
    mockExecFile.mockImplementation((cmd: string, args: string[], callback: Function) => {
      execFileCalls.push({ cmd, args });

      if (callCount === 0 && cmd === 'ffprobe') {
        callCount++;
        callback(new Error('ffprobe failed'), { stdout: '', stderr: '' });
        return;
      }

      if (callCount === 1 && cmd === 'ffprobe' && hasArg(args, 'avg_frame_rate')) {
        callCount++;
        callback(new Error('ffprobe failed'), { stdout: '', stderr: '' });
        return;
      }

      if (callCount === 2 && cmd === 'ffmpeg') {
        callCount++;
        callback(null, { stdout: '', stderr: '' });
        return;
      }

      callback(new Error('Unexpected call'), { stdout: '', stderr: '' });
    });

    const result = await ensureH264('/data/shared/run/video_000.mp4');
    expect(result).toBe('/data/shared/run/video_000_cfr30_h264.mp4');
    expect(execFileCalls[2].cmd).toBe('ffmpeg');
  });

  it('preserves audio track via -c:a copy during transcode', async () => {
    mockExecFile.mockImplementation((cmd: string, args: string[], callback: Function) => {
      execFileCalls.push({ cmd, args });

      if (cmd === 'ffprobe' && hasArg(args, 'codec_name')) {
        callback(null, { stdout: 'mpeg4\n', stderr: '' });
        return;
      }

      if (cmd === 'ffprobe' && hasArg(args, 'avg_frame_rate')) {
        callback(null, { stdout: '30/1\n', stderr: '' });
        return;
      }

      if (cmd === 'ffmpeg') {
        callback(null, { stdout: '', stderr: '' });
        return;
      }

      callback(new Error('Unexpected call'), { stdout: '', stderr: '' });
    });

    await ensureH264('/tmp/x.mp4');
    const transcodeArgs = execFileCalls[2].args;
    const idx = transcodeArgs.indexOf('-c:a');
    expect(idx).toBeGreaterThan(-1);
    expect(transcodeArgs[idx + 1]).toBe('copy');
  });

  it('inserts the CFR H.264 suffix before the existing file extension', async () => {
    mockExecFile.mockImplementation((cmd: string, args: string[], callback: Function) => {
      execFileCalls.push({ cmd, args });

      if (cmd === 'ffprobe' && hasArg(args, 'codec_name')) {
        callback(null, { stdout: 'vp9\n', stderr: '' });
        return;
      }

      if (cmd === 'ffprobe' && hasArg(args, 'avg_frame_rate')) {
        callback(null, { stdout: '30/1\n', stderr: '' });
        return;
      }

      if (cmd === 'ffmpeg') {
        callback(null, { stdout: '', stderr: '' });
        return;
      }

      callback(new Error('Unexpected call'), { stdout: '', stderr: '' });
    });

    const result = await ensureH264('/a/b/c.DIR/movie.mov', 32);
    expect(result).toBe('/a/b/c.DIR/movie_cfr32_h264.mov');
  });

  it('normalizes when codec is an empty string', async () => {
    mockExecFile.mockImplementation((cmd: string, args: string[], callback: Function) => {
      execFileCalls.push({ cmd, args });

      if (cmd === 'ffprobe' && hasArg(args, 'codec_name')) {
        callback(null, { stdout: '\n', stderr: '' });
        return;
      }

      if (cmd === 'ffprobe' && hasArg(args, 'avg_frame_rate')) {
        callback(null, { stdout: '30/1\n', stderr: '' });
        return;
      }

      if (cmd === 'ffmpeg') {
        callback(null, { stdout: '', stderr: '' });
        return;
      }

      callback(new Error('Unexpected call'), { stdout: '', stderr: '' });
    });

    const result = await ensureH264('/tmp/clip.mp4');
    expect(result).toBe('/tmp/clip_cfr30_h264.mp4');
  });

  it('uses an fps filter only when source fps differs from target fps', () => {
    const sameFpsArgs = buildNormalizeClipArgs({
      inputPath: '/in.mp4',
      outputPath: '/out.mp4',
      targetFps: 32,
      sourceFps: 32,
    });
    expect(sameFpsArgs[sameFpsArgs.indexOf('-vf') + 1]).toBe('setpts=N/(32*TB)');

    const convertedArgs = buildNormalizeClipArgs({
      inputPath: '/in.mp4',
      outputPath: '/out.mp4',
      targetFps: 24,
      sourceFps: 32,
    });
    expect(convertedArgs[convertedArgs.indexOf('-vf') + 1]).toBe('fps=24,setpts=N/(24*TB)');
  });
});
