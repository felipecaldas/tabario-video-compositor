/**
 * Unit tests for ensureH264 and its private probeVideoCodec helper in
 * src/postprocess/ffmpeg.ts.  Mocks child_process.execFile via util.promisify.
 */

jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

import { execFile } from 'child_process';
import { ensureH264 } from '../../src/postprocess/ffmpeg';

const mockExecFile = execFile as unknown as jest.Mock;

/**
 * The source uses `promisify(execFile)` so our mock must match the
 * callback signature `(cmd, args, cb)`.  Each call in the test queues
 * one response.
 */
function queueProbe(codec: string | null): void {
  mockExecFile.mockImplementationOnce((cmd: string, args: string[], cb: Function) => {
    if (codec === null) {
      cb(new Error('ffprobe failed'), { stdout: '', stderr: '' });
      return;
    }
    cb(null, { stdout: codec + '\n', stderr: '' });
  });
}

function queueTranscode(): void {
  mockExecFile.mockImplementationOnce((cmd: string, args: string[], cb: Function) => {
    cb(null, { stdout: '', stderr: '' });
  });
}

describe('ensureH264', () => {
  beforeEach(() => {
    mockExecFile.mockReset();
  });

  it('skips transcoding when the probe reports h264', async () => {
    queueProbe('h264');
    const result = await ensureH264('/data/shared/run/video_000.mp4');
    expect(result).toBe('/data/shared/run/video_000.mp4');
    expect(mockExecFile).toHaveBeenCalledTimes(1); // probe only, no transcode
  });

  it('transcodes when probe reports hevc and returns the _h264 suffixed path', async () => {
    queueProbe('hevc');
    queueTranscode();
    const result = await ensureH264('/data/shared/run/video_000.mp4');
    expect(result).toBe('/data/shared/run/video_000_h264.mp4');
    expect(mockExecFile).toHaveBeenCalledTimes(2);

    // Assert the transcode invocation uses libx264 and yuv420p
    const [, transcodeArgs] = mockExecFile.mock.calls[1];
    expect(transcodeArgs).toContain('libx264');
    expect(transcodeArgs).toContain('yuv420p');
    expect(transcodeArgs).toContain('+faststart');
  });

  it('transcodes when ffprobe fails (codec = null)', async () => {
    queueProbe(null);
    queueTranscode();
    const result = await ensureH264('/data/shared/run/video_000.mp4');
    expect(result).toBe('/data/shared/run/video_000_h264.mp4');
  });

  it('transcodes when codec is an empty string', async () => {
    queueProbe('');
    queueTranscode();
    const result = await ensureH264('/tmp/clip.mp4');
    expect(result).toBe('/tmp/clip_h264.mp4');
  });

  it('preserves audio track via -c:a copy during transcode', async () => {
    queueProbe('mpeg4');
    queueTranscode();
    await ensureH264('/tmp/x.mp4');
    const [, transcodeArgs] = mockExecFile.mock.calls[1];
    const idx = transcodeArgs.indexOf('-c:a');
    expect(idx).toBeGreaterThan(-1);
    expect(transcodeArgs[idx + 1]).toBe('copy');
  });

  it('inserts the _h264 suffix before the existing file extension', async () => {
    queueProbe('vp9');
    queueTranscode();
    const result = await ensureH264('/a/b/c.DIR/movie.mov');
    expect(result).toBe('/a/b/c.DIR/movie_h264.mov');
  });
});
